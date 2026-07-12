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
        # workspace-scope-exempt: tokens are cryptographically random and globally
        # unique by design - this is the public, unauthenticated share-link resolution
        # path (GET /review/{token}); the workspace is *derived from* the token here,
        # not known in advance.
        return await self.db.share_links.find_one({"token": token})

    async def find_by_id(self, share_link_id: str) -> dict[str, Any] | None:
        oid = to_object_id(share_link_id)
        if oid is None:
            return None
        # workspace-scope-exempt: single-document lookup by its own unique _id; every
        # caller checks doc["workspace_id"] against the caller's workspace immediately
        # after (e.g. revoke_share_link in share_links/service.py).
        return await self.db.share_links.find_one({"_id": oid})

    async def list_for_project(self, project_id: str) -> list[dict[str, Any]]:
        # workspace-scope-exempt: project_id is verified against the caller's workspace
        # in list_share_links (share_links/service.py) before this is called.
        cursor = self.db.share_links.find({"project_id": project_id}).sort("created_at", -1)
        return [doc async for doc in cursor]

    async def revoke(self, share_link_id: str) -> None:
        # workspace-scope-exempt: revoke_share_link already verified
        # doc["workspace_id"] == workspace_id via find_by_id before calling this.
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
        # workspace-scope-exempt: single-document lookup by its own unique _id, resolved
        # from a guest token whose claims are cryptographically verified before this is
        # ever called (get_guest_session in core/session.py).
        return await self.db.guest_sessions.find_one({"_id": oid})
