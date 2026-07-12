from datetime import UTC, datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.mongo_utils import to_object_id


class PageRepository:
    """`pages` - 11-Database.md §11.7."""

    def __init__(self, db: AsyncIOMotorDatabase[dict[str, Any]]) -> None:
        self.db = db

    async def find_by_normalized_url(
        self, project_id: str, url_normalized: str
    ) -> dict[str, Any] | None:
        # workspace-scope-exempt: project_id is a globally-unique id the caller
        # (register_page) already verified against the actor's workspace via
        # resolve_actor_project_access before calling this.
        return await self.db.pages.find_one(
            {"project_id": project_id, "url_normalized": url_normalized}
        )

    async def find_by_id(self, page_id: str) -> dict[str, Any] | None:
        oid = to_object_id(page_id)
        if oid is None:
            return None
        # workspace-scope-exempt: single-document lookup by its own unique _id; every
        # caller checks doc["workspace_id"]/doc["project_id"] against the caller's
        # context before acting (e.g. _resolve_page_and_access in comments/service.py).
        return await self.db.pages.find_one({"_id": oid})

    async def create(
        self, *, project_id: str, workspace_id: str, url_normalized: str, title: str | None
    ) -> dict[str, Any]:
        now = datetime.now(UTC)
        doc = {
            "project_id": project_id,
            "workspace_id": workspace_id,
            "url_normalized": url_normalized,
            "title": title,
            "first_seen_at": now,
            "latest_revision_id": None,
        }
        result = await self.db.pages.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    async def list_for_project(self, project_id: str) -> list[dict[str, Any]]:
        # workspace-scope-exempt: project_id is verified against the caller's workspace
        # in list_pages (pages/service.py) before this is called.
        cursor = self.db.pages.find({"project_id": project_id}).sort("first_seen_at", -1)
        return [doc async for doc in cursor]

    async def update_latest_revision(self, page_id: str, revision_id: str) -> None:
        # workspace-scope-exempt: page_id was already resolved+access-checked earlier in
        # the same submit_snapshot call (snapshot_engine/service.py).
        await self.db.pages.update_one(
            {"_id": to_object_id(page_id)}, {"$set": {"latest_revision_id": revision_id}}
        )
