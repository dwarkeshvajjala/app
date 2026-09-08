import re
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.modules.dashboard.repository import root_pipeline


class SearchRepository:
    def __init__(self, db: AsyncIOMotorDatabase[dict[str, Any]]) -> None:
        self.db = db

    async def search(self, workspace_id: str, term: str, limit: int) -> list[dict[str, Any]]:
        # Literal matching: user input can never introduce a costly regex expression.
        match = {"$regex": re.escape(term), "$options": "i"}
        results: list[dict[str, Any]] = []
        for collection, kind, field, extras in [
            ("projects", "project", "name", {"archived_at": None}),
            ("clients", "client", "name", {"archived_at": None}),
        ]:
            cursor = (
                self.db[collection]
                .find(
                    {
                        "workspace_id": workspace_id,
                        field: match,
                        **extras,
                    }
                )
                .sort([("updated_at", -1), ("_id", -1)])
                .limit(limit + 1)
                .max_time_ms(2000)
            )
            async for row in cursor:
                results.append({"kind": kind, "id": str(row["_id"]), "title": row[field]})

        # Validate the active project in Mongo, before limiting results. This excludes
        # comments from archived/deleted projects without fetching an unbounded ID list.
        pipeline = root_pipeline(workspace_id)
        pipeline.insert(1, {"$match": {"body": match}})
        pipeline += [{"$sort": {"created_at": -1, "_id": -1}}, {"$limit": limit + 1}]
        async for row in self.db.comments.aggregate(pipeline, maxTimeMS=2000):
            results.append(
                {
                    "kind": "ticket",
                    "id": str(row["_id"]),
                    "title": row["body"][:240],
                    "project_id": row["_page"]["project_id"],
                    "page_id": row.get("page_id"),
                }
            )

        # Users are global; only the membership join may expose a person to this search.
        pipeline = [
            {"$match": {"workspace_id": workspace_id}},
            {
                "$lookup": {
                    "from": "users",
                    "let": {"uid": "$user_id"},
                    "pipeline": [
                        {
                            "$match": {
                                "$expr": {"$eq": [{"$toString": "$_id"}, "$$uid"]},
                                "$or": [{"name": match}, {"email": match}],
                            }
                        },
                        {"$project": {"name": 1}},
                    ],
                    "as": "person",
                }
            },
            {"$unwind": "$person"},
            {"$sort": {"person.name": 1, "_id": 1}},
            {"$limit": limit + 1},
        ]
        async for row in self.db.memberships.aggregate(pipeline, maxTimeMS=2000):
            results.append(
                {"kind": "person", "id": str(row["person"]["_id"]), "title": row["person"]["name"]}
            )
        return results
