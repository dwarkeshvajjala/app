"""Capture before/after explain evidence in a unique isolated Mongo database."""

import argparse
import asyncio
import json
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import get_settings
from app.core.indexes import AUDIT_BATCH_02_INDEXES, ensure_additive_indexes


def _find_command(filter_: dict[str, Any], sort: dict[str, int] | None = None) -> dict[str, Any]:
    command: dict[str, Any] = {"find": "", "filter": filter_}
    if sort:
        command["sort"] = sort
    return command


QUERIES: dict[str, tuple[str, dict[str, Any], dict[str, int] | None]] = {
    "notifications_unread": (
        "notifications",
        {"workspace_id": "ws-target", "user_id": "user-target", "read_at": None},
        {"created_at": -1},
    ),
    "share_links_project": (
        "share_links",
        {"workspace_id": "ws-target", "project_id": "project-target"},
        {"created_at": -1},
    ),
    "pages_by_url": (
        "pages",
        {
            "workspace_id": "ws-target",
            "project_id": "project-target",
            "url_normalized": "https://example.test/target",
        },
        None,
    ),
    "revisions_current": (
        "revisions",
        {"workspace_id": "ws-target", "page_id": "page-target", "is_current": True},
        None,
    ),
    "revisions_history": (
        "revisions",
        {"workspace_id": "ws-target", "page_id": "page-target"},
        {"captured_at": -1},
    ),
    "recovery_history": (
        "recovery_logs",
        {"workspace_id": "ws-target", "comment_id": "comment-target"},
        {"created_at": -1},
    ),
    "refresh_family_owner": (
        "refresh_tokens",
        {"user_id": "user-target", "family_id": "family-target"},
        None,
    ),
    "refresh_family_revoke": (
        "refresh_tokens",
        {"family_id": "family-target", "revoked_at": None},
        None,
    ),
    "events_feed": (
        "events",
        {"workspace_id": "ws-target"},
        {"created_at": -1, "_id": -1},
    ),
    "events_feed_filtered": (
        "events",
        {"workspace_id": "ws-target", "type": "comment.created"},
        {"created_at": -1, "_id": -1},
    ),
    "otp_active": (
        "otp_codes",
        {
            "email": "target@example.test",
            "consumed_at": None,
            "expires_at": {"$gt": datetime.now(UTC)},
        },
        {"created_at": -1},
    ),
}


def _plan_stages(value: Any) -> list[str]:
    stages: list[str] = []
    if isinstance(value, dict):
        if isinstance(value.get("stage"), str):
            stages.append(value["stage"])
        for child in value.values():
            stages.extend(_plan_stages(child))
    elif isinstance(value, list):
        for child in value:
            stages.extend(_plan_stages(child))
    return stages


async def _seed(db: AsyncIOMotorDatabase[dict[str, Any]], rows: int = 2500) -> None:
    now = datetime.now(UTC)
    for name in {collection for collection, _, _ in QUERIES.values()}:
        docs: list[dict[str, Any]] = []
        for i in range(rows):
            target = i == rows - 1
            doc: dict[str, Any] = {
                "workspace_id": "ws-target" if target else f"ws-{i % 100}",
                "user_id": "user-target" if target else f"user-{i}",
                "read_at": None if target or i % 3 else now,
                "created_at": now - timedelta(seconds=i),
                "project_id": "project-target" if target else f"project-{i}",
                "url_normalized": (
                    "https://example.test/target" if target else f"https://example.test/{i}"
                ),
                "page_id": "page-target" if target else f"page-{i}",
                "captured_at": now - timedelta(seconds=i),
                "is_current": target,
                "comment_id": "comment-target" if target else f"comment-{i}",
                "family_id": "family-target" if target else f"family-{i}",
                "token": f"share-token-{i}",
                "token_hash": f"refresh-token-{i}",
                "revoked_at": None,
                "type": "comment.created" if target else "project.updated",
                "email": "target@example.test" if target else f"user-{i}@example.test",
                "consumed_at": None,
                "expires_at": now + timedelta(hours=1),
            }
            docs.append(doc)
        await db[name].insert_many(docs)


async def _explain(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    collection: str,
    filter_: dict[str, Any],
    sort: dict[str, int] | None,
) -> dict[str, Any]:
    find = _find_command(filter_, sort)
    find["find"] = collection
    raw = await db.command({"explain": find, "verbosity": "executionStats"})
    winning = raw["queryPlanner"]["winningPlan"]
    stats = raw["executionStats"]
    return {
        "stages": sorted(set(_plan_stages(winning))),
        "n_returned": stats["nReturned"],
        "total_docs_examined": stats["totalDocsExamined"],
        "total_keys_examined": stats["totalKeysExamined"],
    }


async def capture(output: Path) -> None:
    settings = get_settings()
    if not settings.mongo_db_name.endswith("_test"):
        raise RuntimeError("Refusing to seed explain evidence outside a *_test database setting.")
    # MongoDB database names are limited to 63 bytes. Keep the scratch name
    # independent of the configured test-database name after the safety check.
    scratch_name = f"bl_idx_ev_{uuid.uuid4().hex}"
    client: AsyncIOMotorClient[dict[str, Any]] = AsyncIOMotorClient(
        settings.mongo_uri, tz_aware=True
    )
    db = client[scratch_name]
    try:
        await _seed(db)
        before = {
            name: await _explain(db, collection, filter_, sort)
            for name, (collection, filter_, sort) in QUERIES.items()
        }
        await ensure_additive_indexes(db, AUDIT_BATCH_02_INDEXES)
        after = {
            name: await _explain(db, collection, filter_, sort)
            for name, (collection, filter_, sort) in QUERIES.items()
        }
        ttl = await db.guest_sessions.create_index(
            "last_seen_at", expireAfterSeconds=180 * 24 * 60 * 60
        )
        ttl_info = (await db.guest_sessions.index_information())[ttl]
        evidence = {
            "captured_at": datetime.now(UTC).isoformat(),
            "seed_rows_per_collection": 2500,
            "scratch_database": scratch_name,
            "before": before,
            "after": after,
            "guest_last_seen_ttl_seconds": ttl_info["expireAfterSeconds"],
            "existing_indexes_were_dropped": False,
        }
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(evidence, indent=2, default=str) + "\n", encoding="utf-8")
    finally:
        await client.drop_database(scratch_name)
        client.close()


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    await capture(args.output.resolve())


if __name__ == "__main__":
    asyncio.run(main())
