from typing import Any

import pytest
from bson import ObjectId
from httpx import AsyncClient
from motor.motor_asyncio import AsyncIOMotorDatabase

from tests.helpers import create_project_with_guest_session

SIMPLE_NODE_TREE = {"node_id": "n_0", "tag": "html", "children": []}
SIMPLE_NODES_INDEX = {
    "n_1": {
        "tag": "button",
        "attributes": {"class": "btn"},
        "text": "Upgrade",
        "node_hash": "sha256:aaa",
        "ancestor_path_hash": "sha256:bbb",
    }
}


async def _register_page(client: AsyncClient, ctx: dict[str, Any]) -> str:
    resp = await client.post(
        "/api/v1/pages",
        json={"project_id": ctx["project_id"], "url": "https://reviewable.example.com/"},
        headers=ctx["guest_headers"],
    )
    assert resp.status_code == 201
    page_id: str = resp.json()["id"]
    return page_id


async def test_first_snapshot_creates_a_revision(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="snap1@example.com", code="600001", workspace_name="SN1"
    )
    page_id = await _register_page(client, ctx)

    resp = await client.post(
        f"/api/v1/pages/{page_id}/snapshots",
        json={
            "viewport": {"width": 1440, "height": 900},
            "node_tree": SIMPLE_NODE_TREE,
            "nodes_index": SIMPLE_NODES_INDEX,
            "full_page_hash": "sha256:page-v1",
        },
        headers=ctx["guest_headers"],
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["created_new"] is True
    assert body["is_current"] is True
    assert body["full_page_hash"] == "sha256:page-v1"

    page_detail = await client.get(
        f"/api/v1/projects/{ctx['project_id']}/pages", headers=ctx["owner_headers"]
    )
    assert page_detail.json()[0]["latest_revision_id"] == body["id"]


async def test_identical_hash_does_not_create_a_new_revision(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, db: AsyncIOMotorDatabase[dict[str, Any]]
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="snap2@example.com", code="600002", workspace_name="SN2"
    )
    page_id = await _register_page(client, ctx)

    payload = {
        "viewport": {"width": 1440, "height": 900},
        "node_tree": SIMPLE_NODE_TREE,
        "nodes_index": SIMPLE_NODES_INDEX,
        "full_page_hash": "sha256:stable",
    }

    first = await client.post(
        f"/api/v1/pages/{page_id}/snapshots", json=payload, headers=ctx["guest_headers"]
    )
    second = await client.post(
        f"/api/v1/pages/{page_id}/snapshots", json=payload, headers=ctx["guest_headers"]
    )

    assert first.json()["created_new"] is True
    assert second.json()["created_new"] is False
    assert first.json()["id"] == second.json()["id"]

    count = await db.revisions.count_documents({"page_id": page_id})
    assert count == 1


async def test_changed_hash_creates_new_revision_and_retires_the_old_one(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, db: AsyncIOMotorDatabase[dict[str, Any]]
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="snap3@example.com", code="600003", workspace_name="SN3"
    )
    page_id = await _register_page(client, ctx)

    base_payload = {
        "viewport": {"width": 1440, "height": 900},
        "node_tree": SIMPLE_NODE_TREE,
        "nodes_index": SIMPLE_NODES_INDEX,
    }

    first = await client.post(
        f"/api/v1/pages/{page_id}/snapshots",
        json={**base_payload, "full_page_hash": "sha256:v1"},
        headers=ctx["guest_headers"],
    )
    second = await client.post(
        f"/api/v1/pages/{page_id}/snapshots",
        json={**base_payload, "full_page_hash": "sha256:v2"},
        headers=ctx["guest_headers"],
    )

    assert first.json()["created_new"] is True
    assert second.json()["created_new"] is True
    assert first.json()["id"] != second.json()["id"]

    old_revision = await db.revisions.find_one({"_id": ObjectId(first.json()["id"])})
    assert old_revision is not None
    assert old_revision["is_current"] is False

    count = await db.revisions.count_documents({"page_id": page_id})
    assert count == 2


async def test_snapshot_submission_requires_auth(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/pages/000000000000000000000000/snapshots",
        json={
            "viewport": {"width": 100, "height": 100},
            "node_tree": {},
            "nodes_index": {},
            "full_page_hash": "sha256:x",
        },
    )
    assert resp.status_code == 401


async def test_snapshot_submission_rejects_unknown_page(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="snap4@example.com", code="600004", workspace_name="SN4"
    )
    resp = await client.post(
        "/api/v1/pages/000000000000000000000000/snapshots",
        json={
            "viewport": {"width": 100, "height": 100},
            "node_tree": {},
            "nodes_index": {},
            "full_page_hash": "sha256:x",
        },
        headers=ctx["guest_headers"],
    )
    assert resp.status_code == 404
