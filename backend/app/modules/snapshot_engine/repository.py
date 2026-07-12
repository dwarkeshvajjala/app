from datetime import UTC, datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.mongo_utils import to_object_id


class RevisionRepository:
    """`revisions` - 11-Database.md §11.8. Only the create-a-new-revision-on-hash-change
    path lands in Milestone 3; the diff engine (10-Revision-Recovery.md) is Milestone 8."""

    def __init__(self, db: AsyncIOMotorDatabase[dict[str, Any]]) -> None:
        self.db = db

    async def find_current(self, page_id: str) -> dict[str, Any] | None:
        # workspace-scope-exempt: page_id is a globally-unique id already verified
        # against the actor's workspace by the caller (submit_snapshot resolves +
        # access-checks the page before calling this).
        return await self.db.revisions.find_one({"page_id": page_id, "is_current": True})

    async def find_previous(
        self, page_id: str, *, exclude_revision_id: str
    ) -> dict[str, Any] | None:
        """The revision that was current immediately before `exclude_revision_id` (the
        new one) - used by the recovery pipeline (10-Revision-Recovery.md §10.4) to diff
        against. Not simply "is_current: False", since a page can have many old
        revisions; this is the most recent one that isn't the new one itself."""
        cursor = (
            # workspace-scope-exempt: page_id already verified by run_recovery_pipeline's
            # own page lookup before this is called.
            self.db.revisions.find(
                {"page_id": page_id, "_id": {"$ne": to_object_id(exclude_revision_id)}}
            )
            .sort("captured_at", -1)
            .limit(1)
        )
        async for doc in cursor:
            result: dict[str, Any] = doc
            return result
        return None

    async def create(
        self, *, page_id: str, workspace_id: str, full_page_hash: str
    ) -> dict[str, Any]:
        doc = {
            "page_id": page_id,
            "workspace_id": workspace_id,
            "snapshot_key": None,
            "full_page_hash": full_page_hash,
            "captured_at": datetime.now(UTC),
            "is_current": True,
        }
        result = await self.db.revisions.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    async def set_snapshot_key(self, revision_id: str, snapshot_key: str) -> None:
        # workspace-scope-exempt: revision_id comes from create() earlier in the same
        # submit_snapshot call, whose page/access was already verified.
        await self.db.revisions.update_one(
            {"_id": to_object_id(revision_id)}, {"$set": {"snapshot_key": snapshot_key}}
        )

    async def mark_not_current(self, revision_id: str) -> None:
        # workspace-scope-exempt: revision_id comes from find_current earlier in the
        # same submit_snapshot call, whose page/access was already verified.
        await self.db.revisions.update_one(
            {"_id": to_object_id(revision_id)}, {"$set": {"is_current": False}}
        )
