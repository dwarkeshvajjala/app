from datetime import UTC, datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.mongo_utils import to_object_id


class CommentRepository:
    """`comments` - 11-Database.md §11.10."""

    def __init__(self, db: AsyncIOMotorDatabase[dict[str, Any]]) -> None:
        self.db = db

    async def create(self, doc: dict[str, Any]) -> dict[str, Any]:
        result = await self.db.comments.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    async def find_by_id(self, comment_id: str) -> dict[str, Any] | None:
        oid = to_object_id(comment_id)
        if oid is None:
            return None
        return await self.db.comments.find_one({"_id": oid})

    async def list_for_member(
        self, workspace_id: str, page_id: str, *, since: datetime | None = None
    ) -> list[dict[str, Any]]:
        """A member sees every layer - the layer filter here is a no-op, present only
        so both list methods have the same shape and a reviewer of this file sees the
        asymmetry explicitly rather than having to infer it."""
        query: dict[str, Any] = {"workspace_id": workspace_id, "page_id": page_id}
        if since is not None:
            query["created_at"] = {"$gt": since}
        cursor = self.db.comments.find(query).sort("created_at", 1)
        return [doc async for doc in cursor]

    async def list_for_guest_session(
        self, workspace_id: str, page_id: str, *, since: datetime | None = None
    ) -> list[dict[str, Any]]:
        """`layer: "client"` is hard-coded into the query filter - there is no parameter
        that lets a caller ask for `team` layer comments on behalf of a guest session
        (11-Database.md §11.10's server-side enforcement note). This is the concrete
        implementation of "a client session can never render, fetch, or receive
        team-only content" - not a UI-level hide."""
        query: dict[str, Any] = {
            "workspace_id": workspace_id,
            "page_id": page_id,
            "layer": "client",
        }
        if since is not None:
            query["created_at"] = {"$gt": since}
        cursor = self.db.comments.find(query).sort("created_at", 1)
        return [doc async for doc in cursor]

    async def list_for_project(
        self, workspace_id: str, page_ids: list[str]
    ) -> list[dict[str, Any]]:
        """Member-only (12-API-WebSocket.md §12.4's `/projects/{id}/comments` - the
        Board's data source, 16-Dashboard.md §16.1). Every layer, across every page in
        the project - matches the `page_id: {"$in": page_ids}` query 11-Database.md
        §11.14's kanban-counts aggregation already assumes."""
        query: dict[str, Any] = {"workspace_id": workspace_id, "page_id": {"$in": page_ids}}
        cursor = self.db.comments.find(query).sort("created_at", 1)
        return [doc async for doc in cursor]

    async def update(self, comment_id: str, patch: dict[str, Any]) -> None:
        patch["edited_at"] = datetime.now(UTC)
        await self.db.comments.update_one({"_id": to_object_id(comment_id)}, {"$set": patch})
