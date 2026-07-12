from collections import defaultdict
from typing import Any

from fastapi import WebSocket

# This module deliberately doesn't follow the router/service/repository/schemas shape
# (06-Backend-Architecture.md §6.1) - there's no Mongo-backed resource here, just an
# in-process fan-out registry. `pubsub.py` is what makes broadcast_local correct across
# more than one backend process (12-API-WebSocket.md §12.6): Redis is the actual source
# of truth for "who gets this message," this class is just the last hop to a live socket.


class ConnectionManager:
    def __init__(self) -> None:
        self._channels: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, channel: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._channels[channel].add(websocket)

    def disconnect(self, channel: str, websocket: WebSocket) -> None:
        self._channels[channel].discard(websocket)
        if not self._channels[channel]:
            del self._channels[channel]

    async def broadcast_local(self, channel: str, message: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for websocket in self._channels.get(channel, ()):
            try:
                await websocket.send_json(message)
            except Exception:
                dead.append(websocket)
        for websocket in dead:
            self.disconnect(channel, websocket)


manager = ConnectionManager()
