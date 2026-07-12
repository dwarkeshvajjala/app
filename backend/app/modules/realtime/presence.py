from app.core.redis_client import get_redis

# Safety-net TTL only - presence is actively cleared on graceful disconnect (the
# websocket endpoint's `finally` block). This just bounds how long a stale entry can
# linger after an ungraceful process kill, the same "WS keeps it fresh, TTL/staleTime is
# just the fallback" pattern used for comment lists (14-State-Management.md §14.4).
PRESENCE_TTL_SECONDS = 60


def _key(page_id: str) -> str:
    return f"presence:page:{page_id}"


async def mark_present(page_id: str, session_key: str, display_name: str) -> None:
    redis_client = get_redis()
    await redis_client.hset(_key(page_id), session_key, display_name)  # type: ignore[misc]
    await redis_client.expire(_key(page_id), PRESENCE_TTL_SECONDS)


async def mark_absent(page_id: str, session_key: str) -> None:
    await get_redis().hdel(_key(page_id), session_key)  # type: ignore[misc]


async def list_present(page_id: str) -> list[str]:
    values = await get_redis().hvals(_key(page_id))  # type: ignore[misc]
    return [v.decode() if isinstance(v, bytes) else v for v in values]
