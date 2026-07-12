import secrets
import time

import redis.asyncio as redis
from fastapi import Request, status

from app.core.errors import BacklineError


class RateLimitedError(BacklineError):
    code = "RATE_LIMITED"
    status_code = status.HTTP_429_TOO_MANY_REQUESTS


def get_client_ip(request: Request) -> str:
    """Prefers X-Forwarded-For (set by Railway's proxy in production) over the raw
    socket peer, falling back to the latter for local dev where there's no proxy."""
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def check_rate_limit(
    client: redis.Redis, *, key: str, limit: int, window_seconds: int
) -> None:
    """Sliding window log (12-API-WebSocket.md §12.7): a Redis sorted set keyed per
    rate-limit bucket, scored by request timestamp. Old entries fall out of the window
    on every call, so the count is always an exact sliding count, not a fixed-window
    approximation that can double-allow requests at bucket boundaries."""
    now = time.time()
    window_start = now - window_seconds

    pipe = client.pipeline()
    pipe.zremrangebyscore(key, 0, window_start)
    pipe.zadd(key, {f"{now}:{secrets.token_hex(4)}": now})
    pipe.zcard(key)
    pipe.expire(key, window_seconds)
    results = await pipe.execute()
    count = results[2]

    if count > limit:
        raise RateLimitedError("Too many requests. Try again later.")
