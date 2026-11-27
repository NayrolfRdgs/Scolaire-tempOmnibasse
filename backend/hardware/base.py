"""
hardware/base.py — Classe abstraite HardwareBackend pour Omnibasse.

Définit l'interface que toutes les implémentations hardware doivent respecter
(MPR121 réel sur Raspberry Pi, MockHardware sur PC de développement, etc.).
"""

from __future__ import annotations

from abc import ABC, abstractmethod


class HardwareBackend(ABC):
    """
    Interface abstraite pour le backend hardware.

    Chaque implémentation doit :
    - lire les 24 canaux capacitifs
    - exposer les 5 potentiomètres
    - gérer son propre cycle de vie (initialisation, fermeture)
    """

    @abstractmethod
    def read_raw(self) -> dict[int, int]:
        """
        Lit les 24 valeurs brutes delta-capacitives des capteurs MPR121.

        :return: dict canal (0-23) → valeur delta (int)
                 0 = pas de contact, >0 = contact détecté
        """
        ...

    @abstractmethod
    def read_pots(self) -> dict[str, float]:
        """
        Lit les potentiomètres/encodeurs.

        :return: dict id → valeur normalisée [0.0, 1.0]
                 Clés possibles : 'volume', 'filter', 'reverb', 'bank', 'key'
        """
        ...

    @abstractmethod
    def close(self) -> None:
        """Libère les ressources hardware."""
        ...

    def __enter__(self) -> "HardwareBackend":
        return self

    def __exit__(self, *args: object) -> None:
        self.close()
