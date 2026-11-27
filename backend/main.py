"""
main.py — Point d'entrée FastAPI + uvicorn pour Omnibasse.

Endpoints REST :
  GET  /api/config        → configuration courante
  PUT  /api/config        → mise à jour + application à chaud
  GET  /api/state         → état runtime (voix actives, pots)
  GET  /api/calibration   → données de calibration hardware
  GET  /api/samples       → liste des banques de samples disponibles
  POST /api/samples       → changer de banque active

WebSocket :
  WS /ws → reçoit événements JSON du simulateur, broadcast à tous les clients

Boucle hardware :
  Asyncio à 100 Hz en background (lecture MPR121 + traitement TouchEngine)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import uvicorn
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from audio_engine import AudioEngine
from config import AppConfig, PotEvent, TouchEvent
from hardware.mpr121 import create_hardware_backend
from scales import get_string_section_notes, note_to_freq
from touch_engine import TouchEngine
from ws_manager import ConnectionManager

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Dossier des samples (relatif à ce fichier)
# ---------------------------------------------------------------------------
SAMPLES_DIR = Path(__file__).parent / "samples"
CONFIG_PATH = Path(__file__).parent / "config.json"

# ---------------------------------------------------------------------------
# Application FastAPI (lifespan moderne — remplace on_event déprécié)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def _lifespan(application: FastAPI):
    """Cycle de vie de l'application : démarrage puis arrêt."""
    # --- Startup ---
    global _config, _touch_engine, _audio_engine, _hardware
    _load_config()
    _touch_engine = TouchEngine(_config)
    _audio_engine = AudioEngine(SAMPLES_DIR)
    _refresh_notes()
    try:
        _audio_engine.load_bank(_config.samples.bank)
    except Exception as exc:
        logger.warning(f"Erreur chargement banque audio: {exc}")
    _hardware = create_hardware_backend(
        touch_threshold=_config.touch.threshold,
        release_threshold=_config.touch.release,
    )
    task = asyncio.create_task(_hardware_loop())
    logger.info("Omnibasse démarré.")

    yield  # ← l'application tourne ici

    # --- Shutdown ---
    task.cancel()
    _hardware.close()
    _audio_engine.close()
    logger.info("Omnibasse arrêté.")


app = FastAPI(title="Omnibasse API", version="1.0.0", lifespan=_lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # CORS ouvert pour le simulateur local
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# État global de l'application
# ---------------------------------------------------------------------------

# Configuration chargée au démarrage (ou créée par défaut)
_config: AppConfig = AppConfig()

# Moteurs
_touch_engine: TouchEngine = TouchEngine(_config)
_audio_engine: AudioEngine = AudioEngine(SAMPLES_DIR)

# Gestionnaire WebSocket
_ws_manager: ConnectionManager = ConnectionManager()

# Backend hardware (auto-détecté)
_hardware = create_hardware_backend(
    touch_threshold=_config.touch.threshold,
    release_threshold=_config.touch.release,
)

# Pré-calculer la table notes par corde × section
_string_notes: dict[int, list[str]] = {}


def _refresh_notes() -> None:
    """Recalcule la table (corde, section) → note_name après changement de config."""
    global _string_notes
    _string_notes = {}
    for s in _config.strings:
        try:
            notes = get_string_section_notes(
                base_note=s.base_note,
                scale_root=_config.scale.root,
                mode=_config.scale.mode,
                num_sections=_config.layout.sections,
            )
        except Exception as exc:
            logger.warning(f"Erreur calcul gamme corde {s.id}: {exc}")
            notes = [s.base_note] * _config.layout.sections
        _string_notes[s.id] = notes


def _load_config() -> None:
    """Charge la configuration depuis config.json ou utilise les valeurs par défaut."""
    global _config
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, encoding="utf-8") as f:
                data = json.load(f)
            _config = AppConfig.model_validate(data)
            logger.info("Configuration chargée depuis config.json")
        except Exception as exc:
            logger.warning(f"Erreur lecture config.json: {exc} → config par défaut")
            _config = AppConfig()
    else:
        logger.info("config.json absent → configuration par défaut")


def _save_config() -> None:
    """Persiste la configuration courante dans config.json."""
    try:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(_config.model_dump(), f, indent=2, ensure_ascii=False)
    except Exception as exc:
        logger.error(f"Erreur sauvegarde config.json: {exc}")



# ---------------------------------------------------------------------------
# Boucle hardware asyncio à 100 Hz
# ---------------------------------------------------------------------------

async def _hardware_loop() -> None:
    """
    Tâche de fond : lit le hardware à 100 Hz, traite les événements via
    TouchEngine et les broadcast via WebSocket.
    """
    interval = 1.0 / 100  # 10 ms

    while True:
        try:
            # Lecture hardware dans un thread pour ne pas bloquer l'event loop
            raw = await asyncio.to_thread(_hardware.read_raw)
            events = _touch_engine.process_raw(raw)

            for evt in events:
                # Déclencher l'audio selon le mode de jeu
                _handle_audio_event(evt)
                # Broadcast WebSocket
                await _ws_manager.broadcast(evt.model_dump())

            # Lecture des pots
            pots = await asyncio.to_thread(_hardware.read_pots)
            for pot_id, value in pots.items():
                _audio_engine.set_param(pot_id, value)

        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error(f"Erreur boucle hardware: {exc}")

        await asyncio.sleep(interval)


def _handle_audio_event(evt: TouchEvent) -> None:
    """Déclenche la lecture audio appropriée pour un événement de contact."""
    if evt.state == "up":
        return  # Pas de release explicite (les voix s'éteignent naturellement)

    if evt.state not in ("down", "move"):
        return

    # En mode notes, ne jouer qu'au "down"
    if _config.play_mode == "notes" and evt.state != "down":
        return

    string_notes = _string_notes.get(evt.string, [])
    if not string_notes or evt.section >= len(string_notes):
        return

    note_name = string_notes[evt.section]
    string_cfg = next((s for s in _config.strings if s.id == evt.string), None)
    if string_cfg is None:
        return

    target_freq = note_to_freq(note_name)
    source_freq = note_to_freq(string_cfg.base_note)

    _audio_engine.play(
        string_id=evt.string,
        section=evt.section,
        pos=evt.pos,
        pressure=evt.pressure,
        target_freq=target_freq,
        source_freq=source_freq,
    )


# ---------------------------------------------------------------------------
# Routes REST
# ---------------------------------------------------------------------------

@app.get("/api/config", response_model=AppConfig)
async def get_config() -> AppConfig:
    """Retourne la configuration courante."""
    return _config


@app.put("/api/config", response_model=AppConfig)
async def put_config(new_config: AppConfig) -> AppConfig:
    """
    Met à jour la configuration et l'applique à chaud.
    La config est également persistée dans config.json.
    """
    global _config
    _config = new_config
    _touch_engine.update_config(_config)
    _refresh_notes()

    # Recharger la banque si elle a changé
    if new_config.samples.bank != _config.samples.bank:
        try:
            _audio_engine.load_bank(new_config.samples.bank)
        except Exception as exc:
            logger.warning(f"Erreur rechargement banque: {exc}")

    _save_config()
    logger.info("Configuration mise à jour à chaud.")
    return _config


@app.get("/api/state")
async def get_state() -> dict[str, Any]:
    """Retourne l'état runtime de l'application."""
    return {
        "play_mode": _config.play_mode,
        "scale": _config.scale.model_dump(),
        "bank": _config.samples.bank,
        "ws_clients": _ws_manager.count,
        "hardware_mode": type(_hardware).__name__,
    }


@app.get("/api/calibration")
async def get_calibration() -> dict[str, Any]:
    """Retourne les données brutes de calibration hardware (lecture instantanée)."""
    try:
        raw = await asyncio.to_thread(_hardware.read_raw)
        return {"channels": raw, "threshold": _config.touch.threshold}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/samples")
async def get_samples() -> dict[str, Any]:
    """Liste toutes les banques de samples disponibles dans le dossier samples/."""
    if not SAMPLES_DIR.exists():
        return {"banks": [], "current": _config.samples.bank}

    banks = [
        d.name
        for d in SAMPLES_DIR.iterdir()
        if d.is_dir() and not d.name.startswith(".")
    ]
    return {"banks": sorted(banks), "current": _config.samples.bank}


@app.post("/api/samples")
async def post_samples(body: dict[str, str]) -> dict[str, Any]:
    """
    Change la banque de samples active.
    Corps JSON : {"bank": "nom-de-la-banque"}
    """
    bank = body.get("bank", "").strip()
    if not bank:
        raise HTTPException(status_code=400, detail="Champ 'bank' manquant.")

    bank_path = SAMPLES_DIR / bank
    if not bank_path.exists():
        raise HTTPException(status_code=404, detail=f"Banque '{bank}' introuvable.")

    try:
        await asyncio.to_thread(_audio_engine.load_bank, bank)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    global _config
    _config = _config.model_copy(update={"samples": _config.samples.model_copy(update={"bank": bank})})
    _save_config()
    return {"bank": bank, "status": "chargée"}


# ---------------------------------------------------------------------------
# WebSocket /ws
# ---------------------------------------------------------------------------

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """
    WebSocket principal.
    - Accepte les connexions du simulateur et des clients UI.
    - Reçoit des événements JSON (TouchEvent ou PotEvent) et les injecte dans les moteurs.
    - Broadcast à tous les clients connectés.
    """
    await _ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            evt_type = data.get("type")

            if evt_type == "touch":
                try:
                    evt = TouchEvent.model_validate(data)
                    evt = evt.model_copy(update={"source": "simulator"})
                    _handle_audio_event(evt)
                    await _ws_manager.broadcast(evt.model_dump())
                except Exception as exc:
                    logger.debug(f"TouchEvent invalide: {exc}")

            elif evt_type == "pot":
                try:
                    evt = PotEvent.model_validate(data)
                    evt = evt.model_copy(update={"source": "simulator"})
                    _audio_engine.set_param(evt.id, evt.value)
                    await _ws_manager.broadcast(evt.model_dump())
                except Exception as exc:
                    logger.debug(f"PotEvent invalide: {exc}")

            else:
                logger.debug(f"Message WS inconnu: {data}")

    except WebSocketDisconnect:
        _ws_manager.disconnect(websocket)
    except Exception as exc:
        logger.warning(f"Erreur WebSocket: {exc}")
        _ws_manager.disconnect(websocket)


# ---------------------------------------------------------------------------
# Point d'entrée
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info",
    )
