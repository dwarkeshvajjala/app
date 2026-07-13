from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase


class FeatureFlagRepository:
    """`feature_flags` - 18-Storage-Deployment.md §18.7: `{ key, workspace_id?, enabled }`,
    `workspace_id: null` meaning a global default a workspace-specific row can override."""

    def __init__(self, db: AsyncIOMotorDatabase[dict[str, Any]]) -> None:
        self.db = db

    async def list_for_workspace(self, workspace_id: str | None) -> list[dict[str, Any]]:
        # workspace-scope-exempt: this is the one query that's meant to read across the
        # global/workspace-specific split itself (that's the whole point of the
        # $or) - load_feature_flags (core/feature_flags.py) resolves the merge, workspace
        # rows deliberately overriding the global default, not filtering to one or the
        # other.
        cursor = self.db.feature_flags.find(
            {"$or": [{"workspace_id": None}, {"workspace_id": workspace_id}]}
        )
        return [doc async for doc in cursor]

    async def set_flag(self, key: str, *, workspace_id: str | None, enabled: bool) -> None:
        await self.db.feature_flags.update_one(
            {"key": key, "workspace_id": workspace_id},
            {"$set": {"enabled": enabled}},
            upsert=True,
        )
