"""
hardware/mock.py — Implémentation MockHardware pour développement PC.

Simule les 24 capteurs capacitifs et les 5 potentiomètres avec des
valeurs à zéro (aucun contact). Le simulateur frontend injecte les
événements via le WebSocket, ce backend sert uniquement de fallback
quand le vrai hardware n'est pas disponible.
"""

from __future__ import annotations

import logging

from hardware.base import HardwareBackend

logger = logging.getLogger(__name__)


class MockHardware(HardwareBackend):
    """
    Backend hardware simulé.
    Toutes les lectures retournent zéro (pas de contact, pots à mi-course).
    Les véritables événements de test sont injectés via le WebSocket.
    """

    NUM_CHANNELS: int = 24
    POT_IDS: list[str] = ["volume", "filter", "reverb", "bank", "key"]

    def __init__(self) -> None:
        logger.info("MockHardware initialisé (mode développement PC).")
        # État interne des pots (mi-course par défaut)
        self._pots: dict[str, float] = {pid: 0.5 for pid in self.POT_IDS}

    def read_raw(self) -> dict[int, int]:
        """Retourne 24 canaux à zéro (aucun contact)."""
        return {ch: 0 for ch in range(self.NUM_CHANNELS)}

    def read_pots(self) -> dict[str, float]:
        """Retourne les potentiomètres à leurs valeurs actuelles."""
        return dict(self._pots)

    def set_pot(self, pot_id: str, value: float) -> None:
        """Permet au simulateur de modifier la valeur d'un pot (test)."""
        if pot_id in self._pots:
            self._pots[pot_id] = max(0.0, min(1.0, value))

    def close(self) -> None:
        """Rien à libérer en mode simulé."""
        logger.info("MockHardware fermé.")
