from datetime import UTC, datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.mongo_utils import to_object_id


class ClientRepository:
    def __init__(self, db: AsyncIOMotorDatabase[dict[str, Any]]) -> None:
        self.db = db

    async def list(self, workspace_id: str) -> list[dict[str, Any]]:
        cursor = self.db.clients.find({"workspace_id": workspace_id, "archived_at": None})
        return [doc async for doc in cursor.sort([("name", 1), ("_id", 1)])]

    async def find(self, workspace_id: str, client_id: str) -> dict[str, Any] | None:
        return await self.db.clients.find_one(
            {"workspace_id": workspace_id, "_id": to_object_id(client_id), "archived_at": None}
        )

    async def create(self, workspace_id: str, fields: dict[str, Any]) -> dict[str, Any]:
        now = datetime.now(UTC)
        doc = {
            **fields,
            "workspace_id": workspace_id,
            "created_at": now,
            "updated_at": now,
            "archived_at": None,
        }
        result = await self.db.clients.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    async def update(self, workspace_id: str, client_id: str, fields: dict[str, Any]) -> None:
        await self.db.clients.update_one(
            {"workspace_id": workspace_id, "_id": to_object_id(client_id), "archived_at": None},
            {"$set": {**fields, "updated_at": datetime.now(UTC)}},
        )
