import os

os.environ.setdefault("MONGO_DB_NAME", "backline_test")

from collections.abc import AsyncIterator
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

import app.core.db as db_module
from app.core.config import get_settings
from app.main import app


@pytest.fixture(autouse=True)
async def _fresh_motor_client_per_test() -> AsyncIterator[None]:
    # Motor binds its client to the event loop active at creation time, but
    # pytest-asyncio gives each test function its own loop - so the app's cached
    # singleton (app/core/db.py) must be reset every test, not reused across loops.
    db_module._client = None
    yield
    if db_module._client is not None:
        db_module._client.close()
        db_module._client = None


@pytest.fixture
async def db() -> AsyncIterator[AsyncIOMotorDatabase[dict[str, Any]]]:
    settings = get_settings()
    client: AsyncIOMotorClient[dict[str, Any]] = AsyncIOMotorClient(settings.mongo_uri)
    database = client[settings.mongo_db_name]
    for name in await database.list_collection_names():
        await database[name].delete_many({})
    yield database
    client.close()


@pytest.fixture
async def client(db: AsyncIOMotorDatabase[dict[str, Any]]) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
