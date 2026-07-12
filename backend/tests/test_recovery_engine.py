"""Recovery Pipeline orchestration tests (10-Revision-Recovery.md §10.4/§10.5) - the
golden dataset transformation types (19-Testing-CI.md §19.2), driven end-to-end through
real DB state (workspace -> project -> page -> two snapshots -> a comment anchored to
the first), calling `run_recovery_pipeline` directly (the same function the Arq worker
calls - see app/workers/recovery.py) rather than through the queue, since a background
job has no HTTP surface to hit."""

from typing import Any

import pytest
from httpx import AsyncClient
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.modules.recovery_engine.service import run_recovery_pipeline
from tests.helpers import create_project_with_guest_session

STABLE_ATTRS = {"data-testid": "upgrade-cta"}


def _node(
    *,
    tag: str = "button",
    attributes: dict[str, str] | None = None,
    text: str = "Upgrade to Pro",
    node_hash: str = "sha256:node-v1",
    ancestor_path_hash: str = "sha256:pos-v1",
    text_similarity_hash: str = "0" * 16,
) -> dict[str, Any]:
    return {
        "tag": tag,
        "attributes": STABLE_ATTRS if attributes is None else attributes,
        "text": text,
        "node_hash": node_hash,
        "ancestor_path_hash": ancestor_path_hash,
        "text_similarity_hash": text_similarity_hash,
    }


def _anchor(
    *,
    attributes: dict[str, str] | None = None,
    node_hash: str = "sha256:node-v1",
    ancestor_path_hash: str = "sha256:pos-v1",
    normalized_text: str = "Upgrade to Pro",
    text_similarity_hash: str = "0" * 16,
) -> dict[str, Any]:
    return {
        "tier": 1,
        "dom_fingerprint": {
            "selector_path": "body > button:nth-of-type(1)",
            "tag": "button",
            "attributes": STABLE_ATTRS if attributes is None else attributes,
            "node_hash": node_hash,
            "ancestor_path_hash": ancestor_path_hash,
        },
        "text_fingerprint": {
            "normalized_text": normalized_text,
            "text_similarity_hash": text_similarity_hash,
        },
    }


CONTEXT = {
    "browser": "Chrome",
    "os": "macOS",
    "viewport": {"width": 1440, "height": 900},
    "device_type": "desktop",
    "url": "https://reviewable.example.com/",
}


async def _setup(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    *,
    email: str,
    code: str,
    node1: dict[str, Any],
    comment_anchor: dict[str, Any],
) -> dict[str, Any]:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email=email, code=code, workspace_name=f"RE-{code}"
    )
    page_resp = await client.post(
        "/api/v1/pages",
        json={"project_id": ctx["project_id"], "url": "https://reviewable.example.com/"},
        headers=ctx["owner_headers"],
    )
    assert page_resp.status_code == 201
    page_id = page_resp.json()["id"]

    snap1 = await client.post(
        f"/api/v1/pages/{page_id}/snapshots",
        json={
            "viewport": {"width": 1440, "height": 900},
            "node_tree": {"node_id": "n1", "tag": "html", "children": []},
            "nodes_index": {"n1": node1},
            "full_page_hash": "sha256:page-v1",
        },
        headers=ctx["owner_headers"],
    )
    assert snap1.status_code == 201

    comment_resp = await client.post(
        f"/api/v1/pages/{page_id}/comments",
        json={
            "body": "This button needs work",
            "layer": "client",
            "anchor": comment_anchor,
            "context": CONTEXT,
            "screenshot_key": None,
            "capture_status": "ok",
        },
        headers=ctx["owner_headers"],
    )
    assert comment_resp.status_code == 201
    comment_id = comment_resp.json()["id"]

    ctx["page_id"] = page_id
    ctx["comment_id"] = comment_id
    return ctx


async def _submit_snapshot_and_recover(
    client: AsyncClient,
    db: AsyncIOMotorDatabase[dict[str, Any]],
    ctx: dict[str, Any],
    *,
    nodes_index: dict[str, Any],
    full_page_hash: str,
) -> dict[str, int]:
    resp = await client.post(
        f"/api/v1/pages/{ctx['page_id']}/snapshots",
        json={
            "viewport": {"width": 1440, "height": 900},
            "node_tree": {"node_id": "n1", "tag": "html", "children": []},
            "nodes_index": nodes_index,
            "full_page_hash": full_page_hash,
        },
        headers=ctx["owner_headers"],
    )
    assert resp.status_code == 201
    revision_id = resp.json()["id"]
    assert resp.json()["created_new"] is True
    return await run_recovery_pipeline(db, page_id=ctx["page_id"], revision_id=revision_id)


async def _get_comment(client: AsyncClient, ctx: dict[str, Any]) -> dict[str, Any]:
    resp = await client.get(
        f"/api/v1/pages/{ctx['page_id']}/comments", headers=ctx["owner_headers"]
    )
    assert resp.status_code == 200
    comments = resp.json()
    match = next(c for c in comments if c["id"] == ctx["comment_id"])
    return dict(match)


async def test_identical_page_stays_ok_confidence_1(
    client: AsyncClient, db: AsyncIOMotorDatabase[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await _setup(
        client,
        monkeypatch,
        email="rec1@example.com",
        code="810001",
        node1=_node(),
        comment_anchor=_anchor(),
    )
    summary = await _submit_snapshot_and_recover(
        client,
        db,
        ctx,
        nodes_index={
            "n1": _node(),
            "n2": _node(node_hash="unrelated", ancestor_path_hash="unrelated-pos"),
        },
        full_page_hash="sha256:page-v2",
    )
    assert summary == {"ok": 1}

    comment = await _get_comment(client, ctx)
    assert comment["recovery_status"] == "ok"
    assert comment["anchor"]["dom_fingerprint"]["node_hash"] == "sha256:node-v1"

    logs = (
        await db.recovery_logs.find({"comment_id": ctx["comment_id"]})
        .sort("_id", 1)
        .to_list(length=10)
    )
    assert len(logs) == 1
    assert logs[0]["strategy_used"] == "exact_path"
    assert logs[0]["confidence"] == 1.0


async def test_moved_element_reanchors_via_stable_attribute(
    client: AsyncClient, db: AsyncIOMotorDatabase[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await _setup(
        client,
        monkeypatch,
        email="rec2@example.com",
        code="810002",
        node1=_node(),
        comment_anchor=_anchor(),
    )
    summary = await _submit_snapshot_and_recover(
        client,
        db,
        ctx,
        nodes_index={"n2": _node(ancestor_path_hash="sha256:pos-v2")},
        full_page_hash="sha256:page-v2",
    )
    assert summary == {"ok": 1}

    comment = await _get_comment(client, ctx)
    assert comment["recovery_status"] == "ok"
    assert comment["anchor"]["dom_fingerprint"]["ancestor_path_hash"] == "sha256:pos-v2"


async def test_text_edited_element_becomes_low_confidence(
    client: AsyncClient, db: AsyncIOMotorDatabase[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await _setup(
        client,
        monkeypatch,
        email="rec3@example.com",
        code="810003",
        node1=_node(attributes={}, text_similarity_hash="0000000000000000"),
        comment_anchor=_anchor(attributes={}, text_similarity_hash="0000000000000000"),
    )
    summary = await _submit_snapshot_and_recover(
        client,
        db,
        ctx,
        nodes_index={
            "n2": _node(
                attributes={},
                node_hash="sha256:node-v2",
                ancestor_path_hash="sha256:pos-v2",
                text="Upgrade now",
                text_similarity_hash="0000000000000003",
            )
        },
        full_page_hash="sha256:page-v2",
    )
    assert summary == {"low_confidence": 1}

    comment = await _get_comment(client, ctx)
    assert comment["recovery_status"] == "low_confidence"
    assert comment["anchor"]["dom_fingerprint"]["node_hash"] == "sha256:node-v2"
    assert comment["anchor"]["text_fingerprint"]["normalized_text"] == "Upgrade now"


async def test_removed_element_orphans_then_permanently_orphans_after_two_misses(
    client: AsyncClient, db: AsyncIOMotorDatabase[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await _setup(
        client,
        monkeypatch,
        email="rec4@example.com",
        code="810004",
        node1=_node(attributes={}, text_similarity_hash="0000000000000000"),
        comment_anchor=_anchor(attributes={}, text_similarity_hash="0000000000000000"),
    )
    unrelated_node = _node(
        attributes={},
        tag="div",
        text="totally unrelated section",
        node_hash="sha256:unrelated",
        ancestor_path_hash="sha256:unrelated-pos",
        text_similarity_hash="ffffffffffffffff",
    )

    summary1 = await _submit_snapshot_and_recover(
        client, db, ctx, nodes_index={"n2": unrelated_node}, full_page_hash="sha256:page-v2"
    )
    assert summary1 == {"orphaned": 1}
    comment = await _get_comment(client, ctx)
    assert comment["recovery_status"] == "orphaned"
    # Anchor is untouched on a miss (10-Revision-Recovery.md §10.4 step 5).
    assert comment["anchor"]["dom_fingerprint"]["node_hash"] == "sha256:node-v1"

    summary2 = await _submit_snapshot_and_recover(
        client, db, ctx, nodes_index={"n3": unrelated_node}, full_page_hash="sha256:page-v3"
    )
    assert summary2 == {"permanently_orphaned": 1}
    comment = await _get_comment(client, ctx)
    assert comment["recovery_status"] == "permanently_orphaned"

    logs = (
        await db.recovery_logs.find({"comment_id": ctx["comment_id"]})
        .sort("_id", 1)
        .to_list(length=10)
    )
    assert len(logs) == 2
    assert [log["outcome"] for log in logs] == ["orphaned", "permanently_orphaned"]


async def test_permanently_orphaned_comment_is_no_longer_retried(
    client: AsyncClient, db: AsyncIOMotorDatabase[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Once given up on, the pipeline stops touching it (§10.5) - it takes a manual
    PATCH /comments/{id}/reanchor to bring it back, not another automatic revision."""
    ctx = await _setup(
        client,
        monkeypatch,
        email="rec5@example.com",
        code="810005",
        node1=_node(attributes={}, text_similarity_hash="0000000000000000"),
        comment_anchor=_anchor(attributes={}, text_similarity_hash="0000000000000000"),
    )
    unrelated_node = _node(
        attributes={},
        tag="div",
        text="totally unrelated section",
        node_hash="sha256:unrelated",
        ancestor_path_hash="sha256:unrelated-pos",
        text_similarity_hash="ffffffffffffffff",
    )
    await _submit_snapshot_and_recover(
        client, db, ctx, nodes_index={"n2": unrelated_node}, full_page_hash="sha256:page-v2"
    )
    await _submit_snapshot_and_recover(
        client, db, ctx, nodes_index={"n3": unrelated_node}, full_page_hash="sha256:page-v3"
    )
    comment = await _get_comment(client, ctx)
    assert comment["recovery_status"] == "permanently_orphaned"

    # Even if the original element comes back verbatim, a permanently_orphaned comment
    # is excluded from the recoverable set - it stays permanently_orphaned.
    summary3 = await _submit_snapshot_and_recover(
        client, db, ctx, nodes_index={"n1": _node(attributes={})}, full_page_hash="sha256:page-v4"
    )
    assert summary3 == {}
    comment = await _get_comment(client, ctx)
    assert comment["recovery_status"] == "permanently_orphaned"


async def test_ambiguous_duplicates_yield_low_confidence_not_a_silent_wrong_match(
    client: AsyncClient, db: AsyncIOMotorDatabase[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await _setup(
        client,
        monkeypatch,
        email="rec6@example.com",
        code="810006",
        node1=_node(
            attributes={},
            text="Learn more",
            node_hash="sha256:node-v1",
            text_similarity_hash="0" * 16,
        ),
        comment_anchor=_anchor(
            attributes={},
            normalized_text="Learn more",
            node_hash="sha256:node-v1",
            text_similarity_hash="0" * 16,
        ),
    )
    summary = await _submit_snapshot_and_recover(
        client,
        db,
        ctx,
        nodes_index={
            "n2": _node(
                attributes={},
                node_hash="sha256:content-a",
                ancestor_path_hash="sha256:position-a",
                text="Learn more",
                text_similarity_hash="0" * 16,
            ),
            "n3": _node(
                attributes={},
                node_hash="sha256:content-b",
                ancestor_path_hash="sha256:position-b",
                text="Learn more",
                text_similarity_hash="0" * 16,
            ),
        },
        full_page_hash="sha256:page-v2",
    )
    assert summary == {"low_confidence": 1}

    logs = (
        await db.recovery_logs.find({"comment_id": ctx["comment_id"]})
        .sort("_id", 1)
        .to_list(length=10)
    )
    assert logs[0]["candidates_considered"] == 2


async def test_recovery_status_change_publishes_comment_recovery_updated(
    client: AsyncClient, db: AsyncIOMotorDatabase[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    import json

    import redis.asyncio as redis

    from app.core.config import get_settings

    ctx = await _setup(
        client,
        monkeypatch,
        email="rec7@example.com",
        code="810007",
        node1=_node(attributes={}, text_similarity_hash="0000000000000000"),
        comment_anchor=_anchor(attributes={}, text_similarity_hash="0000000000000000"),
    )

    settings = get_settings()
    redis_client: redis.Redis = redis.from_url(settings.redis_url)  # type: ignore[no-untyped-call]
    pubsub = redis_client.pubsub()
    workspace_channel = f"ws:workspace:{ctx['workspace_id']}:all"
    await pubsub.subscribe(workspace_channel)
    await pubsub.get_message(timeout=1)

    unrelated_node = _node(
        attributes={},
        tag="div",
        text="totally unrelated section",
        node_hash="sha256:unrelated",
        ancestor_path_hash="sha256:unrelated-pos",
        text_similarity_hash="ffffffffffffffff",
    )
    await _submit_snapshot_and_recover(
        client, db, ctx, nodes_index={"n2": unrelated_node}, full_page_hash="sha256:page-v2"
    )

    envelope = None
    for _ in range(10):
        message = await pubsub.get_message(timeout=1)
        if not message or message["type"] != "message":
            continue
        candidate = json.loads(message["data"])
        if candidate["type"] == "comment.recovery_updated":
            envelope = candidate
            break
    assert envelope is not None
    assert envelope["payload"]["comment_id"] == ctx["comment_id"]
    assert envelope["payload"]["recovery_status"] == "orphaned"

    await pubsub.unsubscribe(workspace_channel)
    await pubsub.aclose()  # type: ignore[no-untyped-call]
    await redis_client.aclose()


async def test_new_snapshot_enqueues_a_recovery_job(
    client: AsyncClient, db: AsyncIOMotorDatabase[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Proves submit_snapshot actually enqueues via Arq (not just that the pipeline
    function works when called directly) - inspects the real Arq-managed Redis queue."""
    import redis.asyncio as redis

    from app.core.config import get_settings

    ctx = await _setup(
        client,
        monkeypatch,
        email="rec8@example.com",
        code="810008",
        node1=_node(),
        comment_anchor=_anchor(),
    )

    settings = get_settings()
    redis_client: redis.Redis = redis.from_url(settings.redis_url)  # type: ignore[no-untyped-call]
    queue_len_before = await redis_client.zcard("arq:queue")

    resp = await client.post(
        f"/api/v1/pages/{ctx['page_id']}/snapshots",
        json={
            "viewport": {"width": 1440, "height": 900},
            "node_tree": {"node_id": "n1", "tag": "html", "children": []},
            "nodes_index": {"n2": _node(ancestor_path_hash="sha256:pos-v2")},
            "full_page_hash": "sha256:page-v2",
        },
        headers=ctx["owner_headers"],
    )
    assert resp.status_code == 201

    queue_len_after = await redis_client.zcard("arq:queue")
    assert queue_len_after == queue_len_before + 1

    await redis_client.aclose()
