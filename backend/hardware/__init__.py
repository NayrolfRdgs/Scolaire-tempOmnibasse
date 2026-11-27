"""
hardware/__init__.py — Package hardware pour Omnibasse.
Expose la fabrique auto-détectée comme point d'entrée principal.
"""

from hardware.base import HardwareBackend
from hardware.mpr121 import create_hardware_backend
from hardware.mock import MockHardware

__all__ = ["HardwareBackend", "MockHardware", "create_hardware_backend"]
