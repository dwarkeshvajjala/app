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

    await db.projects.create_index("workspace_id")

    await db.share_links.create_index("token", unique=True)
    await db.share_links.create_index("project_id")

    await db.guest_sessions.create_index("share_link_id")
    await db.guest_sessions.create_index("last_seen_at", expireAfterSeconds=180 * 24 * 60 * 60)

    await db.pages.create_index([("project_id", 1), ("url_normalized", 1)], unique=True)

    await db.revisions.create_index([("page_id", 1), ("captured_at", -1)])
    await db.revisions.create_index([("page_id", 1), ("is_current", 1)])

    await db.comments.create_index([("page_id", 1), ("status", 1)])
    await db.comments.create_index([("workspace_id", 1), ("assignee_id", 1)])
    await db.comments.create_index("parent_id")
    await db.comments.create_index([("workspace_id", 1), ("layer", 1)])

    await db.revision_diffs.create_index([("page_id", 1), ("to_revision_id", 1)])
    await db.recovery_logs.create_index([("comment_id", 1), ("created_at", -1)])

    await db.integrations.create_index([("workspace_id", 1), ("type", 1)])

    # notifications: shape/indexes documented in docs/tdr/0009 (11-Database.md never
    # gave this collection an explicit schema, unlike every other one).
    await db.notifications.create_index([("workspace_id", 1), ("user_id", 1), ("created_at", -1)])
