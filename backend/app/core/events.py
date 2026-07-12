from datetime import UTC, datetime
from typing import Any, Literal

from motor.motor_asyncio import AsyncIOMotorDatabase

ActorType = Literal["member", "guest", "system"]


async def append_event(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    *,
    workspace_id: str,
    type: str,
    actor_type: ActorType,
    actor_id: str | None,
    payload: dict[str, Any],
) -> None:
    """Append-only audit log (06-Backend-Architecture.md §6.6, 11-Database.md §11.13).
    Called once per state-changing service method, alongside the state change itself."""
    await db.events.insert_one(
        {
            "workspace_id": workspace_id,
            "type": type,
            "actor_type": actor_type,
            "actor_id": actor_id,
            "payload_json": payload,
            "created_at": datetime.now(UTC),
        }
    )
