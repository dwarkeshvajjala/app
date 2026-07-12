from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase


async def ensure_indexes(db: AsyncIOMotorDatabase[dict[str, Any]]) -> None:
    """Indexes per 11-Database.md, created idempotently on startup rather than via a
    separate migration step (no schema migrations exist yet at this scale)."""
    await db.users.create_index("email", unique=True)

    await db.workspaces.create_index("slug", unique=True)

    await db.memberships.create_index([("workspace_id", 1), ("user_id", 1)], unique=True)
    await db.memberships.create_index("user_id")

    await db.refresh_tokens.create_index("token_hash", unique=True)
    await db.refresh_tokens.create_index("user_id")
    await db.refresh_tokens.create_index("expires_at", expireAfterSeconds=0)

    await db.otp_codes.create_index([("email", 1), ("created_at", -1)])
    await db.otp_codes.create_index("expires_at", expireAfterSeconds=0)

    await db.events.create_index([("workspace_id", 1), ("created_at", -1)])
    await db.events.create_index([("type", 1), ("created_at", -1)])
