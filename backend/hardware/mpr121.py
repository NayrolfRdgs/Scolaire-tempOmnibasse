"""
hardware/mpr121.py — Driver MPR121 pour Raspberry Pi (via smbus2/I2C).

Détection automatique au démarrage :
  - smbus2 importable ET /dev/i2c-1 accessible → MPR121HardwarePi
  - Sinon → MockHardware

Mapping 24 canaux → (corde, section) :
  Chip A (0x5A) : canaux 0-11
    → corde 0 : canaux 0-5  (sections 0-5)
    → corde 1 : canaux 6-11 (sections 0-5)
  Chip B (0x5B) : canaux 0-11
    → corde 2 : canaux 0-5  (sections 0-5)
    → corde 3 : canaux 6-11 (sections 0-5)

Les valeurs lues sont les "filtered data" des registres MPR121
(EFD registers 0x04-0x1D) soustrait de la baseline pour obtenir
un delta capacitif positif lors d'un contact.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Registres MPR121
# ---------------------------------------------------------------------------

MPR121_SOFTRESET_REG   = 0x80
MPR121_SOFTRESET_VAL   = 0x63
MPR121_ECR_REG         = 0x5E    # Electrode Configuration Register
MPR121_MHDR_REG        = 0x2B
MPR121_NHDR_REG        = 0x2C
MPR121_NCLR_REG        = 0x2D
MPR121_FDLR_REG        = 0x2E
MPR121_MHDF_REG        = 0x2F
MPR121_NHDF_REG        = 0x30
MPR121_NCLF_REG        = 0x31
MPR121_FDLF_REG        = 0x32
MPR121_NHDT_REG        = 0x33
MPR121_NCLT_REG        = 0x34
MPR121_FDLT_REG        = 0x35
MPR121_TOUCHTH_0       = 0x41    # Seuil de touche électrode 0
MPR121_RELEASETH_0     = 0x42    # Seuil de relâche électrode 0
MPR121_DEBOUNCE_REG    = 0x5B
MPR121_CONFIG1_REG     = 0x5C
MPR121_CONFIG2_REG     = 0x5D
# Filtered data LSB pour l'électrode 0 (les 12 électrodes suivent par paires)
MPR121_FILTDATA_0L     = 0x04
# Baseline value pour l'électrode 0
MPR121_BASELINE_0      = 0x1E

NUM_ELECTRODES = 12


# ---------------------------------------------------------------------------
# Détection hardware
# ---------------------------------------------------------------------------

def _smbus2_available() -> bool:
    """Vérifie si smbus2 est importable."""
    try:
        import smbus2  # type: ignore  # noqa: F401
        return True
    except ImportError:
        return False


def _i2c_device_present() -> bool:
    """Vérifie si /dev/i2c-1 est accessible (Linux/Raspberry Pi uniquement)."""
    return os.path.exists("/dev/i2c-1")


def _hardware_available() -> bool:
    """Retourne True si le vrai hardware MPR121 est utilisable."""
    return _smbus2_available() and _i2c_device_present()


# ---------------------------------------------------------------------------
# Implémentation MPR121 réelle
# ---------------------------------------------------------------------------

class MPR121HardwarePi:
    """
    Driver MPR121 pour Raspberry Pi via I2C/smbus2.
    Gère deux puces MPR121 (0x5A et 0x5B) pour 24 électrodes au total.
    """

    ADDR_A: int = 0x5A   # Chip A : cordes 0 et 1
    ADDR_B: int = 0x5B   # Chip B : cordes 2 et 3

    # Seuils par défaut (overridden par config dans main.py)
    DEFAULT_TOUCH_THRESHOLD:   int = 12
    DEFAULT_RELEASE_THRESHOLD: int = 6

    def __init__(
        self,
        touch_threshold: int = DEFAULT_TOUCH_THRESHOLD,
        release_threshold: int = DEFAULT_RELEASE_THRESHOLD,
        bus_number: int = 1,
    ) -> None:
        import smbus2  # type: ignore

        self._bus = smbus2.SMBus(bus_number)
        self._touch_th = touch_threshold
        self._release_th = release_threshold

        # Initialiser les deux puces
        self._init_chip(self.ADDR_A)
        self._init_chip(self.ADDR_B)
        logger.info("MPR121HardwarePi initialisé (0x5A + 0x5B).")

    def _init_chip(self, addr: int) -> None:
        """Initialise une puce MPR121 avec les paramètres recommandés."""
        bus = self._bus
        # Soft reset
        bus.write_byte_data(addr, MPR121_SOFTRESET_REG, MPR121_SOFTRESET_VAL)
        import time; time.sleep(0.001)

        # Sortie de mode run (ECR = 0)
        bus.write_byte_data(addr, MPR121_ECR_REG, 0x00)

        # Paramètres de filtrage baseline
        bus.write_byte_data(addr, MPR121_MHDR_REG, 0x01)
        bus.write_byte_data(addr, MPR121_NHDR_REG, 0x01)
        bus.write_byte_data(addr, MPR121_NCLR_REG, 0x0E)
        bus.write_byte_data(addr, MPR121_FDLR_REG, 0x00)
        bus.write_byte_data(addr, MPR121_MHDF_REG, 0x01)
        bus.write_byte_data(addr, MPR121_NHDF_REG, 0x05)
        bus.write_byte_data(addr, MPR121_NCLF_REG, 0x01)
        bus.write_byte_data(addr, MPR121_FDLF_REG, 0x00)
        bus.write_byte_data(addr, MPR121_NHDT_REG, 0x00)
        bus.write_byte_data(addr, MPR121_NCLT_REG, 0x00)
        bus.write_byte_data(addr, MPR121_FDLT_REG, 0x00)

        # Seuils de touche/relâche pour chaque électrode
        for i in range(NUM_ELECTRODES):
            bus.write_byte_data(addr, MPR121_TOUCHTH_0   + i * 2, self._touch_th)
            bus.write_byte_data(addr, MPR121_RELEASETH_0 + i * 2, self._release_th)

        # Debounce
        bus.write_byte_data(addr, MPR121_DEBOUNCE_REG, 0x00)
        # Configuration CDT=16µs, ESI=1ms
        bus.write_byte_data(addr, MPR121_CONFIG1_REG, 0x10)
        bus.write_byte_data(addr, MPR121_CONFIG2_REG, 0x20)

        # Activer les 12 électrodes (ECR = 0x8C)
        bus.write_byte_data(addr, MPR121_ECR_REG, 0x8C)

    def _read_filtered(self, addr: int) -> list[int]:
        """
        Lit les 12 valeurs "filtered data" d'une puce MPR121 et calcule
        le delta par rapport à la baseline (valeur positive = contact).

        Les registres filtered data sont 10 bits sur 2 octets (little-endian).
        Les registres baseline sont 8 bits (valeur × 4 → 10 bits).
        """
        bus = self._bus
        raw_filtered: list[int] = []
        raw_baseline: list[int] = []

        for i in range(NUM_ELECTRODES):
            lsb = bus.read_byte_data(addr, MPR121_FILTDATA_0L + i * 2)
            msb = bus.read_byte_data(addr, MPR121_FILTDATA_0L + i * 2 + 1)
            filtered_val = ((msb & 0x03) << 8) | lsb
            raw_filtered.append(filtered_val)

            baseline_raw = bus.read_byte_data(addr, MPR121_BASELINE_0 + i)
            raw_baseline.append(baseline_raw << 2)  # étendre à 10 bits

        # Delta = baseline - filtered (contact = baseline > filtered)
        deltas: list[int] = []
        for f, b in zip(raw_filtered, raw_baseline):
            delta = max(0, b - f)  # positif si contact
            deltas.append(delta)

        return deltas

    def read_raw(self) -> dict[int, int]:
        """
        Lit les 24 canaux des deux puces MPR121.

        Mapping interne :
          Chip A (0x5A) canal 0-5  → global canal 0-5  (corde 0, sections 0-5)
          Chip A (0x5A) canal 6-11 → global canal 6-11 (corde 1, sections 0-5)
          Chip B (0x5B) canal 0-5  → global canal 12-17 (corde 2, sections 0-5)
          Chip B (0x5B) canal 6-11 → global canal 18-23 (corde 3, sections 0-5)
        """
        try:
            deltas_a = self._read_filtered(self.ADDR_A)
            deltas_b = self._read_filtered(self.ADDR_B)
        except Exception as exc:
            logger.error(f"Erreur lecture MPR121: {exc}")
            return {ch: 0 for ch in range(24)}

        result: dict[int, int] = {}
        for i in range(12):
            result[i] = deltas_a[i]       # 0-11 → chip A
        for i in range(12):
            result[12 + i] = deltas_b[i]  # 12-23 → chip B

        return result

    def read_pots(self) -> dict[str, float]:
        """
        Les potentiomètres ne sont pas gérés par MPR121.
        Retourne des valeurs neutres (à implémenter via MCP3xxx si besoin).
        """
        return {
            "volume": 0.8,
            "filter": 1.0,
            "reverb": 0.0,
            "bank":   0.0,
            "key":    0.5,
        }

    def close(self) -> None:
        """Ferme le bus I2C."""
        try:
            self._bus.close()
        except Exception:
            pass
        logger.info("MPR121HardwarePi fermé.")


# ---------------------------------------------------------------------------
# Fabrique auto-détectée
# ---------------------------------------------------------------------------

def create_hardware_backend(
    touch_threshold: int = 12,
    release_threshold: int = 6,
) -> "HardwareBackend":  # type: ignore[name-defined]
    """
    Fabrique qui retourne automatiquement le bon backend :
      - MPR121HardwarePi si smbus2 et /dev/i2c-1 sont disponibles
      - MockHardware sinon
    """
    from hardware.base import HardwareBackend  # noqa: F401

    if _hardware_available():
        logger.info("Hardware MPR121 détecté → MPR121HardwarePi")
        try:
            return MPR121HardwarePi(  # type: ignore[return-value]
                touch_threshold=touch_threshold,
                release_threshold=release_threshold,
            )
        except Exception as exc:
            logger.error(f"Échec init MPR121: {exc} → fallback MockHardware")

    logger.info("Hardware absent → MockHardware (mode développement)")
    from hardware.mock import MockHardware
    return MockHardware()  # type: ignore[return-value]
