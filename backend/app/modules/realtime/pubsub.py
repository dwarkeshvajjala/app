import asyncio
import json
import logging
from datetime import UTC, datetime
from typing import Any

from app.core.redis_client import get_redis
from app.modules.realtime.manager import manager

logger = logging.getLogger("backline.realtime")

# Every WS channel is published through Redis, even though local dev only ever runs one
# backend process - there is no in-process-only shortcut, so this is already correct the
# day a second instance exists (Rule: build it so nothing breaks when made prod-ready).
CHANNEL_PREFIX = "ws:"


async def publish(
    channel: str, *, event_type: str, workspace_id: str, payload: dict[str, Any]
) -> None:
    """Envelope shape is exactly 12-API-WebSocket.md §12.6's:
    `{ "type": ..., "workspace_id": ..., "payload": ..., "ts": ... }`."""
    envelope = {
        "type": event_type,
        "workspace_id": workspace_id,
        "payload": payload,
        "ts": datetime.now(UTC).isoformat(),
    }
    await get_redis().publish(f"{CHANNEL_PREFIX}{channel}", json.dumps(envelope, default=str))


async def run_subscriber() -> None:
    """Long-running background task (started in main.py's lifespan): the single bridge
    between Redis pub/sub and this process's local WebSocket connections. One pattern
    subscription covers every channel shape (workspace:*, project:*) - a new channel
    never needs new subscriber wiring."""
    redis_client = get_redis()
    pubsub = redis_client.pubsub()
    await pubsub.psubscribe(f"{CHANNEL_PREFIX}*")
    try:
        async for message in pubsub.listen():
            if message["type"] != "pmessage":
                continue
            raw_channel = message["channel"]
            channel = (
                raw_channel.decode() if isinstance(raw_channel, bytes) else raw_channel
            ).removeprefix(CHANNEL_PREFIX)
            try:
                envelope = json.loads(message["data"])
            except (json.JSONDecodeError, TypeError):
                logger.warning("Dropping malformed realtime message on channel %s", channel)
                continue
            await manager.broadcast_local(channel, envelope)
    except asyncio.CancelledError:
        pass
    finally:
        await pubsub.punsubscribe(f"{CHANNEL_PREFIX}*")
        await pubsub.aclose()  # type: ignore[no-untyped-call]
