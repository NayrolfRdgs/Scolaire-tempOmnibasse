"""
ws_manager.py — Gestionnaire WebSocket pour Omnibasse.

Maintient la liste des connexions actives et diffuse les événements
à tous les clients connectés (broadcast).
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Gestionnaire de connexions WebSocket.
    Thread-safe pour des accès depuis plusieurs coroutines asyncio.
    """

    def __init__(self) -> None:
        # Ensemble des connexions WebSocket actives
        self._active: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        """Accepte et enregistre une nouvelle connexion WebSocket."""
        await websocket.accept()
        self._active.append(websocket)
        logger.info(f"Nouveau client WS connecté. Total: {len(self._active)}")

    def disconnect(self, websocket: WebSocket) -> None:
        """Retire une connexion de la liste active."""
        if websocket in self._active:
            self._active.remove(websocket)
        logger.info(f"Client WS déconnecté. Restant: {len(self._active)}")

    async def broadcast(self, data: Any) -> None:
        """
        Diffuse un message JSON à tous les clients connectés.
        Retire silencieusement les connexions mortes.
        """
        dead: list[WebSocket] = []
        for ws in list(self._active):
            try:
                await ws.send_json(data)
            except Exception as exc:
                logger.debug(f"Connexion WS morte, retrait: {exc}")
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    async def send_personal(self, websocket: WebSocket, data: Any) -> None:
        """Envoie un message JSON à un seul client."""
        try:
            await websocket.send_json(data)
        except Exception as exc:
            logger.debug(f"Erreur envoi personnel WS: {exc}")
            self.disconnect(websocket)

    @property
    def count(self) -> int:
        """Nombre de clients actuellement connectés."""
        return len(self._active)
