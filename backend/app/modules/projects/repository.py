from datetime import UTC, datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.mongo_utils import to_object_id


class ProjectRepository:
    """`projects` - 11-Database.md §11.4."""

    def __init__(self, db: AsyncIOMotorDatabase[dict[str, Any]]) -> None:
        self.db = db

    async def create(self, *, workspace_id: str, name: str, target_origin: str) -> dict[str, Any]:
        now = datetime.now(UTC)
        doc = {
            "workspace_id": workspace_id,
            "name": name,
            "target_origin": target_origin,
            "settings_json": {"proxy_mode": False, "snippet_installed": False},
            "archived_at": None,
            "created_at": now,
            "updated_at": now,
        }
        result = await self.db.projects.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    async def find_by_id(self, project_id: str) -> dict[str, Any] | None:
        oid = to_object_id(project_id)
        if oid is None:
            return None
        # workspace-scope-exempt: single-document lookup by its own unique _id; every
        # caller checks doc["workspace_id"] against the caller's workspace immediately
        # after (e.g. get_project in projects/service.py).
        return await self.db.projects.find_one({"_id": oid})

    async def list_for_workspace(
        self, workspace_id: str, *, include_archived: bool = False
    ) -> list[dict[str, Any]]:
        query: dict[str, Any] = {"workspace_id": workspace_id}
        if not include_archived:
            query["archived_at"] = None
        cursor = self.db.projects.find(query).sort("created_at", -1)
        return [doc async for doc in cursor]

    async def update(self, project_id: str, *, name: str | None, target_origin: str | None) -> None:
        patch: dict[str, Any] = {"updated_at": datetime.now(UTC)}
        if name is not None:
            patch["name"] = name
        if target_origin is not None:
            patch["target_origin"] = target_origin
        # workspace-scope-exempt: update_project (projects/service.py) already verified
        # doc["workspace_id"] == workspace_id via find_by_id before calling this.
        await self.db.projects.update_one({"_id": to_object_id(project_id)}, {"$set": patch})

    async def archive(self, project_id: str) -> None:
        # workspace-scope-exempt: archive_project already verified ownership via
        # find_by_id before calling this, same as update() above.
        await self.db.projects.update_one(
            {"_id": to_object_id(project_id)},
            {"$set": {"archived_at": datetime.now(UTC), "updated_at": datetime.now(UTC)}},
        )
