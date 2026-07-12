from datetime import UTC, datetime, timedelta
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase


class UserRepository:
    """`users` is a global collection (not workspace-scoped) - 11-Database.md §11.2,
    03-System-Architecture.md §3.5. Agency members only; guests never appear here."""

    def __init__(self, db: AsyncIOMotorDatabase[dict[str, Any]]) -> None:
        self.db = db

    async def find_by_email(self, email: str) -> dict[str, Any] | None:
        return await self.db.users.find_one({"email": email})

    async def find_by_id(self, user_id: str) -> dict[str, Any] | None:
        return await self.db.users.find_one({"_id": ObjectId(user_id)})

    async def create(
        self, *, email: str, name: str, avatar_url: str | None, auth_provider: str
    ) -> dict[str, Any]:
        doc = {
            "email": email,
            "name": name,
            "avatar_url": avatar_url,
            "auth_providers": [auth_provider],
            "created_at": datetime.now(UTC),
            "last_login_at": datetime.now(UTC),
        }
        result = await self.db.users.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    async def touch_login(self, user_id: ObjectId, auth_provider: str) -> None:
        await self.db.users.update_one(
            {"_id": user_id},
            {
                "$set": {"last_login_at": datetime.now(UTC)},
                "$addToSet": {"auth_providers": auth_provider},
            },
        )


class RefreshTokenRepository:
    """`refresh_tokens` - 11-Database.md §11.14."""

    def __init__(self, db: AsyncIOMotorDatabase[dict[str, Any]]) -> None:
        self.db = db

    async def create(
        self, *, user_id: ObjectId, token_hash: str, family_id: str, ttl_days: int
    ) -> None:
        now = datetime.now(UTC)
        await self.db.refresh_tokens.insert_one(
            {
                "user_id": user_id,
                "token_hash": token_hash,
                "family_id": family_id,
                "issued_at": now,
                "expires_at": now + timedelta(days=ttl_days),
                "revoked_at": None,
                "replaced_by_token_hash": None,
            }
        )

    async def find_by_hash(self, token_hash: str) -> dict[str, Any] | None:
        return await self.db.refresh_tokens.find_one({"token_hash": token_hash})

    async def rotate(self, *, old_token_hash: str, new_token_hash: str) -> None:
        await self.db.refresh_tokens.update_one(
            {"token_hash": old_token_hash},
            {"$set": {"revoked_at": datetime.now(UTC), "replaced_by_token_hash": new_token_hash}},
        )

    async def revoke_family(self, family_id: str) -> None:
        """Theft detection (13-Authentication.md §13.6): reuse of an already-rotated
        token revokes every token descended from the same login."""
        await self.db.refresh_tokens.update_many(
            {"family_id": family_id, "revoked_at": None},
            {"$set": {"revoked_at": datetime.now(UTC)}},
        )

    async def revoke_by_hash(self, token_hash: str) -> None:
        await self.db.refresh_tokens.update_one(
            {"token_hash": token_hash}, {"$set": {"revoked_at": datetime.now(UTC)}}
        )


class OtpRepository:
    """`otp_codes` - 11-Database.md §11.15."""

    def __init__(self, db: AsyncIOMotorDatabase[dict[str, Any]]) -> None:
        self.db = db

    async def create(self, *, email: str, code_hash: str, ttl_minutes: int) -> None:
        now = datetime.now(UTC)
        await self.db.otp_codes.insert_one(
            {
                "email": email,
                "code_hash": code_hash,
                "attempts": 0,
                "expires_at": now + timedelta(minutes=ttl_minutes),
                "consumed_at": None,
                "created_at": now,
            }
        )

    async def find_latest_active(self, email: str) -> dict[str, Any] | None:
        return await self.db.otp_codes.find_one(
            {"email": email, "consumed_at": None, "expires_at": {"$gt": datetime.now(UTC)}},
            sort=[("created_at", -1)],
        )

    async def increment_attempts(self, otp_id: ObjectId) -> None:
        await self.db.otp_codes.update_one({"_id": otp_id}, {"$inc": {"attempts": 1}})

    async def mark_consumed(self, otp_id: ObjectId) -> None:
        await self.db.otp_codes.update_one(
            {"_id": otp_id}, {"$set": {"consumed_at": datetime.now(UTC)}}
        )
