"""
config.py — Modèles de configuration et d'événements pour Omnibasse.
Utilise Pydantic v2 pour la validation et la sérialisation.
"""

from __future__ import annotations

import time
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Événements runtime (non persistés, circulant via WebSocket)
# ---------------------------------------------------------------------------

class TouchEvent(BaseModel):
    """Événement de contact sur un pad capacitif."""
    type: Literal["touch"] = "touch"
    state: Literal["down", "move", "up"]
    string: int = Field(..., ge=0, le=3, description="Corde touchée (0-3)")
    section: int = Field(..., ge=0, le=5, description="Section touchée (0-5)")
    pos: float = Field(..., ge=0.0, le=1.0, description="Position interpolée sur la corde (0.0-1.0)")
    pressure: float = Field(..., ge=0.0, le=1.0, description="Pression normalisée (0.0-1.0)")
    source: Literal["hardware", "simulator"] = "hardware"
    t: float = Field(default_factory=time.time, description="Horodatage UNIX")


class PotEvent(BaseModel):
    """Événement potentiomètre (encodeur ou fader)."""
    type: Literal["pot"] = "pot"
    id: Literal["volume", "filter", "reverb", "bank", "key"]
    value: float = Field(..., ge=0.0, le=1.0, description="Valeur normalisée (0.0-1.0)")
    source: Literal["hardware", "simulator"] = "hardware"
    t: float = Field(default_factory=time.time)


# ---------------------------------------------------------------------------
# Configuration persistée (AppConfig)
# ---------------------------------------------------------------------------

class LayoutConfig(BaseModel):
    """Disposition physique de l'instrument."""
    strings: int = Field(4, ge=1, le=8)
    sections: int = Field(6, ge=1, le=12)


class StringConfig(BaseModel):
    """Configuration d'une corde individuelle."""
    id: int = Field(..., ge=0, le=7)
    base_note: str = Field(..., description="Note de base ex: E1, A1, D2, G2")


class ScaleConfig(BaseModel):
    """Gamme active sur l'instrument."""
    root: str = Field("E", description="Fondamentale de la gamme")
    mode: str = Field("minor_pentatonic_octave", description="Mode/gamme")


class TouchConfig(BaseModel):
    """Paramètres de détection de contact."""
    threshold: int = Field(12, ge=1, le=100, description="Seuil de déclenchement capacitif")
    release: int = Field(6, ge=1, le=100, description="Seuil de relâchement capacitif")
    hysteresis: float = Field(0.05, ge=0.0, le=1.0, description="Hysterèse d'interpolation de position")


class PotConfig(BaseModel):
    """Mapping d'un potentiomètre."""
    id: Literal["volume", "filter", "reverb", "bank", "key"]
    channel: int = Field(..., ge=0, le=15, description="Canal ADC/MCP3xxx")


class SamplesConfig(BaseModel):
    """Configuration de la banque de samples."""
    bank: str = Field("bass-default", description="Nom du dossier dans samples/")


class AppConfig(BaseModel):
    """Configuration principale de l'application Omnibasse."""
    schema_version: int = Field(1, frozen=True)
    layout: LayoutConfig = Field(default_factory=LayoutConfig)
    strings: list[StringConfig] = Field(
        default_factory=lambda: [
            StringConfig(id=0, base_note="E1"),
            StringConfig(id=1, base_note="A1"),
            StringConfig(id=2, base_note="D2"),
            StringConfig(id=3, base_note="G2"),
        ]
    )
    scale: ScaleConfig = Field(default_factory=ScaleConfig)
    play_mode: Literal["notes", "free"] = Field("notes", description="Mode de jeu")
    touch: TouchConfig = Field(default_factory=TouchConfig)
    pots: list[PotConfig] = Field(
        default_factory=lambda: [
            PotConfig(id="volume",  channel=0),
            PotConfig(id="filter",  channel=1),
            PotConfig(id="reverb",  channel=2),
            PotConfig(id="bank",    channel=3),
            PotConfig(id="key",     channel=4),
        ]
    )
    samples: SamplesConfig = Field(default_factory=SamplesConfig)
