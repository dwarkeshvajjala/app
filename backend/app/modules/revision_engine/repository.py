from datetime import UTC, datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.modules.revision_engine.diff import DiffResult


class RevisionDiffRepository:
    """`revision_diffs` - 11-Database.md §11.9."""

    def __init__(self, db: AsyncIOMotorDatabase[dict[str, Any]]) -> None:
        self.db = db

    async def create(
        self,
        *,
        page_id: str,
        workspace_id: str,
        from_revision_id: str,
        to_revision_id: str,
        diff: DiffResult,
    ) -> dict[str, Any]:
        doc = {
            "page_id": page_id,
            "workspace_id": workspace_id,
            "from_revision_id": from_revision_id,
            "to_revision_id": to_revision_id,
            "moved_node_ids": diff.moved,
            "modified_node_ids": diff.modified,
            "removed_node_ids": diff.removed,
            "added_node_ids": diff.added,
            "created_at": datetime.now(UTC),
        }
        result = await self.db.revision_diffs.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc
