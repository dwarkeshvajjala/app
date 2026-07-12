from datetime import UTC, datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.mongo_utils import to_object_id


class ShareLinkRepository:
    """`share_links` - 11-Database.md §11.5."""

    def __init__(self, db: AsyncIOMotorDatabase[dict[str, Any]]) -> None:
        self.db = db

    async def create(
        self,
        *,
        project_id: str,
        workspace_id: str,
        token: str,
        mode: str,
        passcode_hash: str | None,
        expires_at: datetime | None,
        created_by: str,
    ) -> dict[str, Any]:
        doc = {
            "project_id": project_id,
            "workspace_id": workspace_id,
            "token": token,
            "mode": mode,
            "passcode_hash": passcode_hash,
            "expires_at": expires_at,
            "revoked_at": None,
            "created_by": created_by,
            "created_at": datetime.now(UTC),
        }
        result = await self.db.share_links.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    async def find_by_token(self, token: str) -> dict[str, Any] | None:
        return await self.db.share_links.find_one({"token": token})

    async def find_by_id(self, share_link_id: str) -> dict[str, Any] | None:
        oid = to_object_id(share_link_id)
        if oid is None:
            return None
        return await self.db.share_links.find_one({"_id": oid})

    async def list_for_project(self, project_id: str) -> list[dict[str, Any]]:
        cursor = self.db.share_links.find({"project_id": project_id}).sort("created_at", -1)
        return [doc async for doc in cursor]

    async def revoke(self, share_link_id: str) -> None:
        await self.db.share_links.update_one(
            {"_id": to_object_id(share_link_id)}, {"$set": {"revoked_at": datetime.now(UTC)}}
        )


class GuestSessionRepository:
    """`guest_sessions` - 11-Database.md §11.6."""

    def __init__(self, db: AsyncIOMotorDatabase[dict[str, Any]]) -> None:
        self.db = db

    async def create(
        self,
        *,
        share_link_id: str,
        workspace_id: str,
        display_name: str,
        email: str | None,
        ua_fingerprint: str,
    ) -> dict[str, Any]:
        now = datetime.now(UTC)
        doc = {
            "share_link_id": share_link_id,
            "workspace_id": workspace_id,
            "display_name": display_name,
            "email": email,
            "ua_fingerprint": ua_fingerprint,
            "created_at": now,
            "last_seen_at": now,
        }
        result = await self.db.guest_sessions.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    async def find_by_id(self, guest_session_id: str) -> dict[str, Any] | None:
        oid = to_object_id(guest_session_id)
        if oid is None:
            return None
        return await self.db.guest_sessions.find_one({"_id": oid})

    async def touch_last_seen(self, guest_session_id: str) -> None:
        oid = to_object_id(guest_session_id)
        if oid is None:
            return
        await self.db.guest_sessions.update_one(
            {"_id": oid}, {"$set": {"last_seen_at": datetime.now(UTC)}}
        )
