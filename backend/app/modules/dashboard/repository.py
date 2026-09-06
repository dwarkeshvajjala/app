import re
from datetime import UTC, datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.mongo_utils import to_object_id
from app.modules.dashboard.schemas import TicketFilters


def root_pipeline(workspace_id: str) -> list[dict[str, Any]]:
    """Legacy comments derive project_id through their real page; standalone uses the same join."""
    return [
        {"$match": {"workspace_id": workspace_id, "deleted_at": None, "parent_id": None}},
        {
            "$set": {
                "_page_oid": {
                    "$convert": {
                        "input": "$page_id",
                        "to": "objectId",
                        "onError": None,
                        "onNull": None,
                    }
                },
                "assignee_ids": {
                    "$ifNull": [
                        "$assignee_ids",
                        {"$cond": [{"$ifNull": ["$assignee_id", False]}, ["$assignee_id"], []]},
                    ]
                },
                "priority": {"$ifNull": ["$priority", "medium"]},
            }
        },
        {
            "$lookup": {
                "from": "pages",
                "localField": "_page_oid",
                "foreignField": "_id",
                "as": "_page",
            }
        },
        {"$unwind": "$_page"},
        {"$match": {"_page.workspace_id": workspace_id}},
        {
            "$set": {
                "_project_oid": {
                    "$convert": {
                        "input": "$_page.project_id",
                        "to": "objectId",
                        "onError": None,
                        "onNull": None,
                    }
                }
            }
        },
        {
            "$lookup": {
                "from": "projects",
                "localField": "_project_oid",
                "foreignField": "_id",
                "as": "_project",
            }
        },
        {"$unwind": "$_project"},
        {"$match": {"_project.workspace_id": workspace_id, "_project.archived_at": None}},
    ]


class DashboardRepository:
    def __init__(self, db: AsyncIOMotorDatabase[dict[str, Any]]) -> None:
        self.db = db

    async def tickets(
        self, workspace_id: str, user_id: str, filters: TicketFilters
    ) -> dict[str, Any]:
        pipeline = root_pipeline(workspace_id)
        match: dict[str, Any] = {"workspace_id": workspace_id}
        if filters.comment_id:
            match["_id"] = to_object_id(filters.comment_id)
        for key in ("status", "priority"):
            value = getattr(filters, key)
            if value:
                match[key] = value
        if filters.project_id:
            match["_page.project_id"] = filters.project_id
        if filters.tag:
            match["tags"] = filters.tag
        if filters.search.strip():
            escaped = re.escape(filters.search.strip())
            match["$or"] = [
                {key: {"$regex": escaped, "$options": "i"}}
                for key in ("body", "_project.name", "_page.title")
            ]
        if filters.assignee:
            match["assignee_ids"] = (
                {"$size": 0} if filters.assignee == "unassigned" else filters.assignee
            )
        if filters.view == "mine":
            match.setdefault("$and", []).append({"assignee_ids": user_id})
        elif filters.view == "reply":
            match["waiting_on_ids"] = user_id
        elif filters.view == "client":
            match["waiting_on_client"] = True
        elif filters.view == "overdue":
            match["due_at"] = {
                "$lt": datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0),
                "$ne": None,
            }
        if filters.view in ("reply", "client", "overdue"):
            match.setdefault("$and", []).append({"status": {"$nin": ["resolved", "wont_fix"]}})
        pipeline.append({"$match": match})
        pipeline.append(
            {
                "$set": {
                    "_due": {"$ifNull": ["$due_at", datetime(9999, 1, 1, tzinfo=UTC)]},
                    "_priority": {"$indexOfArray": [["high", "medium", "low"], "$priority"]},
                    "_status": {
                        "$indexOfArray": [
                            ["todo", "in_progress", "in_review", "blocked", "resolved", "wont_fix"],
                            "$status",
                        ]
                    },
                }
            }
        )
        sort = {
            "newest": {"created_at": -1, "_id": -1},
            "oldest": {"created_at": 1, "_id": 1},
            "due": {"_due": 1, "_id": 1},
            "priority": {"_priority": 1, "_id": 1},
            "status": {"_status": 1, "_id": 1},
            "project": {"_project.name": 1, "_id": 1},
        }[filters.sort]
        pipeline.append(
            {
                "$facet": {
                    "items": [
                        {"$sort": sort},
                        {"$skip": filters.offset},
                        {"$limit": filters.limit},
                    ],
                    "count": [{"$count": "total"}],
                }
            }
        )
        result = await self.db.comments.aggregate(pipeline).to_list(length=1)
        row: dict[str, Any] = result[0]
        return row

    async def summary(self, workspace_id: str, user_id: str) -> dict[str, Any]:
        pipeline = root_pipeline(workspace_id)
        open_expr = {"$not": [{"$in": ["$status", ["resolved", "wont_fix"]]}]}
        today = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        pipeline.append(
            {
                "$facet": {
                    "statuses": [{"$group": {"_id": "$status", "count": {"$sum": 1}}}],
                    "projects": [
                        {
                            "$group": {
                                "_id": "$_page.project_id",
                                "total": {"$sum": 1},
                                "open": {"$sum": {"$cond": [open_expr, 1, 0]}},
                                "resolved": {
                                    "$sum": {"$cond": [{"$eq": ["$status", "resolved"]}, 1, 0]}
                                },
                                "last_activity_at": {
                                    "$max": {"$ifNull": ["$edited_at", "$created_at"]}
                                },
                            }
                        }
                    ],
                    "personal": [
                        {
                            "$group": {
                                "_id": None,
                                "assigned_to_me": {
                                    "$sum": {"$cond": [{"$in": [user_id, "$assignee_ids"]}, 1, 0]}
                                },
                                "needs_reply": {
                                    "$sum": {
                                        "$cond": [
                                            {
                                                "$and": [
                                                    open_expr,
                                                    {
                                                        "$in": [
                                                            user_id,
                                                            {"$ifNull": ["$waiting_on_ids", []]},
                                                        ]
                                                    },
                                                ]
                                            },
                                            1,
                                            0,
                                        ]
                                    }
                                },
                                "waiting_on_client": {
                                    "$sum": {
                                        "$cond": [
                                            {
                                                "$and": [
                                                    open_expr,
                                                    {"$eq": ["$waiting_on_client", True]},
                                                ]
                                            },
                                            1,
                                            0,
                                        ]
                                    }
                                },
                                "overdue": {
                                    "$sum": {
                                        "$cond": [
                                            {
                                                "$and": [
                                                    open_expr,
                                                    {"$ne": [{"$ifNull": ["$due_at", None]}, None]},
                                                    {"$lt": ["$due_at", today]},
                                                ]
                                            },
                                            1,
                                            0,
                                        ]
                                    }
                                },
                            }
                        }
                    ],
                }
            }
        )
        result = await self.db.comments.aggregate(pipeline).to_list(length=1)
        active = await self.db.projects.count_documents(
            {"workspace_id": workspace_id, "archived_at": None}
        )
        archived = await self.db.projects.count_documents(
            {"workspace_id": workspace_id, "archived_at": {"$ne": None}}
        )
        return {**result[0], "active_projects": active, "archived_projects": archived}

    async def activity(
        self, workspace_id: str, offset: int, limit: int, event_type: str
    ) -> tuple[list[dict[str, Any]], int]:
        query: dict[str, Any] = {"workspace_id": workspace_id}
        if event_type:
            query["type"] = {"$regex": "^" + re.escape(event_type)}
        cursor = (
            self.db.events.find(query)
            .sort([("created_at", -1), ("_id", -1)])
            .skip(offset)
            .limit(limit)
        )
        return [doc async for doc in cursor], await self.db.events.count_documents(query)

    async def standalone_page(self, workspace_id: str, project_id: str) -> dict[str, Any]:
        from pymongo import ReturnDocument

        url = f"backline://projects/{project_id}/tickets"
        doc = await self.db.pages.find_one_and_update(
            {"workspace_id": workspace_id, "project_id": project_id, "url_normalized": url},
            {
                "$setOnInsert": {
                    "title": "Project tickets",
                    "kind": "standalone",
                    "first_seen_at": datetime.now(UTC),
                    "latest_revision_id": None,
                }
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        assert doc is not None
        return doc
