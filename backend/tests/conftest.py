import os

os.environ.setdefault("MONGO_DB_NAME", "backline_test")

from collections.abc import AsyncIterator
from typing import Any

import pytest
import redis.asyncio as redis
from httpx import ASGITransport, AsyncClient
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

import app.core.db as db_module
import app.core.redis_client as redis_module
from app.core.config import get_settings
from app.core.indexes import ensure_indexes
from app.main import app
from app.modules.storage.r2_client import ensure_bucket_exists


@pytest.fixture(autouse=True)
async def _fresh_motor_client_per_test() -> AsyncIterator[None]:
    # Motor (and redis.asyncio) bind their client to the event loop active at creation
    # time, but pytest-asyncio gives each test function its own loop - so the app's
    # cached singletons (app/core/db.py, app/core/redis_client.py) must be reset every
    # test, not reused across loops.
    db_module._client = None
    redis_module._client = None
    yield
    if db_module._client is not None:
        db_module._client.close()
        db_module._client = None
    if redis_module._client is not None:
        await redis_module._client.aclose()
        redis_module._client = None


@pytest.fixture
async def db() -> AsyncIterator[AsyncIOMotorDatabase[dict[str, Any]]]:
    settings = get_settings()
    client: AsyncIOMotorClient[dict[str, Any]] = AsyncIOMotorClient(
        settings.mongo_uri, tz_aware=True
    )
    database = client[settings.mongo_db_name]
    for name in await database.list_collection_names():
        await database[name].delete_many({})

    # Unlike Mongo, Redis state (rate-limit counters) isn't scoped to a per-test
    # database - it's the same real Redis instance across the whole run, so without
    # this, one test's rate-limit hits count against every test after it.
    redis_client: redis.Redis = redis.from_url(settings.redis_url)  # type: ignore[no-untyped-call]
    async for key in redis_client.scan_iter(match="rate-limit:*"):
        await redis_client.delete(key)
    await redis_client.aclose()

    # httpx's ASGITransport does not run the app's lifespan (startup/shutdown), so
    # index/bucket creation - normally done once at process startup - has to happen
    # here instead, idempotently, per test. Without this, a genuinely fresh environment
    # (CI, a new contributor's machine) would never create them at all.
    await ensure_indexes(database)
    await ensure_bucket_exists()
    yield database
    client.close()


@pytest.fixture
async def client(db: AsyncIOMotorDatabase[dict[str, Any]]) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
