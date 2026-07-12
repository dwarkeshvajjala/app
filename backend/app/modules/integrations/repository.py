from datetime import UTC, datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.mongo_utils import to_object_id


class IntegrationRepository:
    """`integrations` - 11-Database.md §11.12."""

    def __init__(self, db: AsyncIOMotorDatabase[dict[str, Any]]) -> None:
        self.db = db

    async def create(
        self,
        *,
        workspace_id: str,
        type: str,
        config_json: dict[str, Any],
        connected_by: str,
        project_scope: str | None = None,
    ) -> dict[str, Any]:
        doc = {
            "workspace_id": workspace_id,
            "type": type,
            "config_json": config_json,
            "project_scope": project_scope,
            "connected_by": connected_by,
            "created_at": datetime.now(UTC),
        }
        result = await self.db.integrations.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    async def find_by_id(self, integration_id: str) -> dict[str, Any] | None:
        oid = to_object_id(integration_id)
        if oid is None:
            return None
        return await self.db.integrations.find_one({"_id": oid})

    async def list_for_workspace(self, workspace_id: str) -> list[dict[str, Any]]:
        cursor = self.db.integrations.find({"workspace_id": workspace_id})
        return [doc async for doc in cursor]

    async def list_for_workspace_by_type(
        self, workspace_id: str, type: str
    ) -> list[dict[str, Any]]:
        cursor = self.db.integrations.find({"workspace_id": workspace_id, "type": type})
        return [doc async for doc in cursor]

    async def update_config(self, integration_id: str, config_json: dict[str, Any]) -> None:
        await self.db.integrations.update_one(
            {"_id": to_object_id(integration_id)}, {"$set": {"config_json": config_json}}
        )

    async def delete(self, integration_id: str) -> None:
        await self.db.integrations.delete_one({"_id": to_object_id(integration_id)})
