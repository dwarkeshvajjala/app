from arq import ArqRedis, create_pool
from arq.connections import RedisSettings

from app.core.config import get_settings

_pool: ArqRedis | None = None


async def get_arq_pool() -> ArqRedis:
    """Lazily-created singleton (mirrors core/redis_client.py's pattern) - the connection
    used to *enqueue* jobs from request-handling code (06-Backend-Architecture.md §6.5).
    The worker process itself (app/workers/recovery.py) opens its own pool independently;
    this one is never consumed from, only published to."""
    global _pool
    if _pool is None:
        settings = get_settings()
        _pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    return _pool


async def close_arq_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.aclose(close_connection_pool=True)
        _pool = None
