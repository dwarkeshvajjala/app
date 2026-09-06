from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.mongo_utils import to_object_id


class AssetRepository:
    def __init__(self, db: AsyncIOMotorDatabase[dict[str, Any]]) -> None:
        self.db = db

    async def create(self, doc: dict[str, Any]) -> dict[str, Any]:
        result = await self.db.project_assets.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    async def list(self, workspace_id: str, project_id: str) -> list[dict[str, Any]]:
        return [
            doc
            async for doc in self.db.project_assets.find(
                {"workspace_id": workspace_id, "project_id": project_id}
            ).sort([("created_at", 1), ("_id", 1)])
        ]

    async def find(
        self, workspace_id: str, project_id: str, asset_id: str
    ) -> dict[str, Any] | None:
        return await self.db.project_assets.find_one(
            {"workspace_id": workspace_id, "project_id": project_id, "_id": to_object_id(asset_id)}
        )
