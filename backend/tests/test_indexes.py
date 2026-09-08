from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.indexes import AUDIT_BATCH_02_INDEXES, ensure_additive_indexes
from scripts.capture_audit_batch_02_index_evidence import QUERIES, _plan_stages, _seed


async def test_index_migration_is_idempotent_and_preserves_ttl(
    db: AsyncIOMotorDatabase[dict[str, Any]],
) -> None:
    before = {
        collection: await db[collection].index_information()
        for collection in {spec.collection for spec in AUDIT_BATCH_02_INDEXES}
    }
    await ensure_additive_indexes(db, AUDIT_BATCH_02_INDEXES)
    await ensure_additive_indexes(db, AUDIT_BATCH_02_INDEXES)
    after = {collection: await db[collection].index_information() for collection in before}
    for spec in AUDIT_BATCH_02_INDEXES:
        assert spec.name in after[spec.collection]
        assert after[spec.collection][spec.name]["key"] == list(spec.keys)
    for collection, indexes in before.items():
        assert set(indexes).issubset(after[collection])

    guest_indexes = await db.guest_sessions.index_information()
    ttl = next(row for row in guest_indexes.values() if row["key"] == [("last_seen_at", 1)])
    assert ttl["expireAfterSeconds"] == 180 * 24 * 60 * 60


async def test_hot_query_explain_plans_do_not_collection_scan(
    db: AsyncIOMotorDatabase[dict[str, Any]],
) -> None:
    await _seed(db, rows=1000)
    for name, (collection, filter_, sort) in QUERIES.items():
        find: dict[str, Any] = {"find": collection, "filter": filter_}
        if sort:
            find["sort"] = sort
        explain = await db.command({"explain": find, "verbosity": "executionStats"})
        stages = _plan_stages(explain["queryPlanner"]["winningPlan"])
        assert "IXSCAN" in stages, (name, stages)
        assert "COLLSCAN" not in stages, (name, stages)
        assert explain["executionStats"]["totalDocsExamined"] < 25, name
