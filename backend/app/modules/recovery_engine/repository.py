from datetime import UTC, datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase


class RecoveryLogRepository:
    """`recovery_logs` - 11-Database.md §11.11."""

    def __init__(self, db: AsyncIOMotorDatabase[dict[str, Any]]) -> None:
        self.db = db

    async def create(
        self,
        *,
        comment_id: str,
        workspace_id: str,
        from_revision_id: str,
        to_revision_id: str,
        strategy_used: str,
        confidence: float,
        candidates_considered: int,
        outcome: str,
    ) -> dict[str, Any]:
        doc = {
            "comment_id": comment_id,
            "workspace_id": workspace_id,
            "from_revision_id": from_revision_id,
            "to_revision_id": to_revision_id,
            "strategy_used": strategy_used,
            "confidence": confidence,
            "candidates_considered": candidates_considered,
            "outcome": outcome,
            "created_at": datetime.now(UTC),
        }
        result = await self.db.recovery_logs.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    async def list_for_comment(
        self, *, workspace_id: str, comment_id: str, limit: int = 100
    ) -> list[dict[str, Any]]:
        cursor = (
            self.db.recovery_logs.find(
                {"workspace_id": workspace_id, "comment_id": comment_id}
            )
            .sort("created_at", -1)
            .limit(limit)
        )
        return [doc async for doc in cursor]
