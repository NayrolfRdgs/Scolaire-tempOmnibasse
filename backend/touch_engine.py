"""
touch_engine.py — Moteur de traitement des contacts capacitifs pour Omnibasse.

Responsabilités :
- Réception des 24 valeurs brutes delta-capacitives (canaux 0-23)
- Détection des touches/relâchements avec hystérésis configurable
- Interpolation inter-pads adjacents d'une même corde pour `pos` continu
- Arbitrage corde dominante en cas de chevauchement multi-cordes
- Modes Notes (re-trigger sur changement de section) et Libre (pitch-bend continu)
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Optional

from config import AppConfig, TouchEvent


# ---------------------------------------------------------------------------
# Structures internes
# ---------------------------------------------------------------------------

@dataclass
class StringState:
    """État interne pour une corde (string)."""
    string_id: int
    # Dernière section déclenchée (pour mode notes)
    last_section: Optional[int] = None
    # Position initiale en mode libre (origine du pitch-bend)
    free_origin: Optional[float] = None
    # État actuel : True = touché
    active: bool = False
    # Pression maximale observée sur les pads actifs
    max_pressure: float = 0.0
    # Valeurs brutes du dernier frame pour cette corde (sections 0-5)
    raw: list[int] = field(default_factory=lambda: [0] * 6)


# ---------------------------------------------------------------------------
# Moteur principal
# ---------------------------------------------------------------------------

class TouchEngine:
    """
    Traite les valeurs brutes MPR121 et produit des TouchEvent normalisés.

    Mapping des canaux → (corde, section) :
        Canal k → corde = k // 6, section = k % 6
        (canaux 0-5 : corde 0 sections 0-5)
        (canaux 6-11: corde 1 sections 0-5)
        (canaux 12-17: corde 2 sections 0-5)
        (canaux 18-23: corde 3 sections 0-5)
    """

    NUM_STRINGS: int = 4
    NUM_SECTIONS: int = 6

    def __init__(self, config: AppConfig) -> None:
        self.config = config
        # Un état par corde
        self._states: list[StringState] = [
            StringState(string_id=i) for i in range(self.NUM_STRINGS)
        ]
        # Canaux en cours de contact (au-dessus du seuil)
        self._active_channels: set[int] = set()

    def update_config(self, config: AppConfig) -> None:
        """Met à jour la configuration à chaud."""
        self.config = config

    # ------------------------------------------------------------------
    # Méthode publique principale
    # ------------------------------------------------------------------

    def process_raw(self, raw_values: dict[int, int]) -> list[TouchEvent]:
        """
        Traite 24 valeurs brutes delta-capacitives et retourne les événements.

        :param raw_values: dict canal (0-23) → valeur delta (int, positif = contact)
        :return: liste de TouchEvent normalisés
        """
        events: list[TouchEvent] = []
        threshold = self.config.touch.threshold
        release_th = self.config.touch.release
        now = time.time()

        # Regrouper les valeurs par corde
        string_raws: list[list[int]] = [
            [raw_values.get(s * self.NUM_SECTIONS + sec, 0) for sec in range(self.NUM_SECTIONS)]
            for s in range(self.NUM_STRINGS)
        ]

        # Déterminer les cordes actives (au moins un pad au-dessus du seuil)
        active_strings: list[int] = []
        for s in range(self.NUM_STRINGS):
            if any(v >= threshold for v in string_raws[s]):
                active_strings.append(s)

        # Arbitrage : si plusieurs cordes actives simultanément, on garde
        # uniquement la corde avec la valeur maximale (corde dominante)
        dominant: Optional[int] = None
        if active_strings:
            dominant = max(active_strings, key=lambda s: max(string_raws[s]))

        for s in range(self.NUM_STRINGS):
            state = self._states[s]
            raws = string_raws[s]
            state.raw = raws

            # Pression = max des valeurs brutes, normalisée 0-1 (seuil de saturation à 100)
            max_raw = max(raws)
            pressure = min(max_raw / 100.0, 1.0)

            # Si cette corde n'est pas la dominante, forcer release
            is_touching = (s == dominant) and any(v >= threshold for v in raws)

            if is_touching:
                # --- Interpolation de position ---
                pos = self._interpolate_pos(raws, threshold)
                section = self._dominant_section(raws)

                if not state.active:
                    # Nouveau contact (down)
                    state.active = True
                    state.last_section = section
                    state.max_pressure = pressure

                    if self.config.play_mode == "free":
                        state.free_origin = pos

                    events.append(TouchEvent(
                        state="down",
                        string=s,
                        section=section,
                        pos=pos,
                        pressure=pressure,
                        source="hardware",
                        t=now,
                    ))

                else:
                    # Contact en cours (move)
                    state.max_pressure = max(state.max_pressure, pressure)

                    if self.config.play_mode == "notes":
                        # Re-trigger uniquement si changement de section
                        if section != state.last_section:
                            state.last_section = section
                            events.append(TouchEvent(
                                state="down",
                                string=s,
                                section=section,
                                pos=pos,
                                pressure=pressure,
                                source="hardware",
                                t=now,
                            ))
                        else:
                            events.append(TouchEvent(
                                state="move",
                                string=s,
                                section=section,
                                pos=pos,
                                pressure=pressure,
                                source="hardware",
                                t=now,
                            ))

                    else:  # mode libre
                        # pos continu depuis position initiale
                        origin = state.free_origin if state.free_origin is not None else pos
                        relative_pos = max(0.0, min(1.0, pos))
                        events.append(TouchEvent(
                            state="move",
                            string=s,
                            section=section,
                            pos=relative_pos,
                            pressure=pressure,
                            source="hardware",
                            t=now,
                        ))

            else:
                # Pas de contact sur cette corde
                if state.active:
                    # Vérifier l'hystérésis : ne relâcher que si TOUS les pads
                    # sont sous le seuil de release
                    if all(v <= release_th for v in raws):
                        state.active = False
                        section = state.last_section if state.last_section is not None else 0
                        pos = self._interpolate_pos(raws, 0) if any(v > 0 for v in raws) else 0.0
                        state.last_section = None
                        state.free_origin = None
                        state.max_pressure = 0.0

                        events.append(TouchEvent(
                            state="up",
                            string=s,
                            section=section,
                            pos=pos,
                            pressure=0.0,
                            source="hardware",
                            t=now,
                        ))

        return events

    # ------------------------------------------------------------------
    # Méthodes privées
    # ------------------------------------------------------------------

    def _interpolate_pos(self, raws: list[int], threshold: int) -> float:
        """
        Calcule la position continue sur la corde [0.0, 1.0] par interpolation
        barycentrique des valeurs brutes des pads adjacents.

        Chaque pad occupe 1/6 de la longueur totale ; le centre du pad k est à k/5.
        """
        total = sum(raws)
        if total == 0:
            return 0.0

        # Centre de masse pondéré
        weighted_sum = sum(v * i for i, v in enumerate(raws))
        center_idx = weighted_sum / total  # 0.0 à 5.0

        # Normaliser en [0.0, 1.0]
        return center_idx / (self.NUM_SECTIONS - 1)

    def _dominant_section(self, raws: list[int]) -> int:
        """Retourne l'index de la section avec la valeur brute maximale."""
        return max(range(len(raws)), key=lambda i: raws[i])

    def _apply_hysteresis(self, pos: float, last_pos: Optional[float]) -> float:
        """
        Applique l'hystérésis de position : ne met à jour que si le mouvement
        dépasse le seuil configuré.
        """
        if last_pos is None:
            return pos
        hysteresis = self.config.touch.hysteresis
        if abs(pos - last_pos) >= hysteresis:
            return pos
        return last_pos
