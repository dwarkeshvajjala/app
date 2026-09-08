from datetime import UTC, datetime

import pytest
from botocore.exceptions import ClientError
from bson import ObjectId
from httpx import AsyncClient
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.modules.projects import deletion_service
from app.modules.projects.deletion_repository import ProjectDeletionRepository
from app.modules.storage.r2_client import download_bytes, upload_bytes
from tests.helpers import (
    create_workspace_and_get_owner_token,
    login_via_otp,
    switch_workspace,
)


async def _seed_project_graph(
    client: AsyncClient,
    db: AsyncIOMotorDatabase,
    monkeypatch: pytest.MonkeyPatch,
) -> dict[str, object]:
    workspace_id, owner_token = await create_workspace_and_get_owner_token(
        client,
        monkeypatch,
        email="delete-owner@example.com",
        code="810001",
        workspace_name="Deletion workspace",
    )
    headers = {"Authorization": f"Bearer {owner_token}"}
    created = await client.post(
        f"/api/v1/workspaces/{workspace_id}/projects",
        json={"name": "Delete me", "target_origin": "https://delete.example.test"},
        headers=headers,
    )
    project_id = created.json()["id"]
    page_id = str(ObjectId())
    comment_id = str(ObjectId())
    reply_id = str(ObjectId())
    revision_a = str(ObjectId())
    revision_b = str(ObjectId())
    share_link = await db.share_links.find_one(
        {"workspace_id": workspace_id, "project_id": project_id}
    )
    assert share_link is not None
    now = datetime.now(UTC)
    await db.pages.insert_one(
        {
            "_id": ObjectId(page_id),
            "workspace_id": workspace_id,
            "project_id": project_id,
            "url_normalized": "https://delete.example.test/page",
            "title": "Delete page",
            "first_seen_at": now,
            "latest_revision_id": revision_b,
        }
    )
    await db.project_assets.insert_one(
        {
            "workspace_id": workspace_id,
            "project_id": project_id,
            "page_id": page_id,
            "key": f"assets/{workspace_id}/{project_id}/asset-1",
            "created_at": now,
        }
    )
    await db.revisions.insert_many(
        [
            {
                "_id": ObjectId(revision_a),
                "workspace_id": workspace_id,
                "page_id": page_id,
                "snapshot_key": f"snapshots/{project_id}/{revision_a}/snapshot.json.gz",
                "captured_at": now,
                "is_current": False,
            },
            {
                "_id": ObjectId(revision_b),
                "workspace_id": workspace_id,
                "page_id": page_id,
                "snapshot_key": f"snapshots/{project_id}/{revision_b}/snapshot.json.gz",
                "captured_at": now,
                "is_current": True,
            },
        ]
    )
    await db.revision_diffs.insert_one(
        {
            "workspace_id": workspace_id,
            "page_id": page_id,
            "from_revision_id": revision_a,
            "to_revision_id": revision_b,
            "created_at": now,
        }
    )
    await db.comments.insert_many(
        [
            {
                "_id": ObjectId(comment_id),
                "workspace_id": workspace_id,
                "project_id": project_id,
                "page_id": page_id,
                "parent_id": None,
                "screenshot_key": f"screenshots/{workspace_id}/{project_id}/shot.jpg",
                "attachments": [
                    {
                        "key": f"uploads/{workspace_id}/{project_id}/brief.pdf",
                        "filename": "brief.pdf",
                    }
                ],
                "created_at": now,
            },
            {
                "_id": ObjectId(reply_id),
                "workspace_id": workspace_id,
                "page_id": page_id,
                "parent_id": comment_id,
                "attachments": [],
                "created_at": now,
            },
        ]
    )
    await db.recovery_logs.insert_one(
        {
            "workspace_id": workspace_id,
            "comment_id": comment_id,
            "from_revision_id": revision_a,
            "to_revision_id": revision_b,
            "created_at": now,
        }
    )
    await db.guest_sessions.insert_one(
        {
            "workspace_id": workspace_id,
            "share_link_id": str(share_link["_id"]),
            "display_name": "Reviewer",
            "created_at": now,
            "last_seen_at": now,
        }
    )
    await db.notifications.insert_one(
        {
            "workspace_id": workspace_id,
            "user_id": "recipient",
            "type": "comment_assigned",
            "payload_json": {"project_id": project_id, "comment_id": comment_id},
            "read_at": None,
            "created_at": now,
        }
    )
    await db.integrations.insert_one(
        {
            "workspace_id": workspace_id,
            "type": "slack",
            "project_scope": project_id,
            "config_json": {},
            "created_at": now,
        }
    )
    return {
        "workspace_id": workspace_id,
        "project_id": project_id,
        "page_id": page_id,
        "comment_id": comment_id,
        "headers": headers,
    }


async def test_hard_delete_requires_dry_run_and_leaves_zero_orphans(
    client: AsyncClient,
    db: AsyncIOMotorDatabase,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ctx = await _seed_project_graph(client, db, monkeypatch)
    workspace_id = str(ctx["workspace_id"])
    project_id = str(ctx["project_id"])
    headers = ctx["headers"]
    graph = await ProjectDeletionRepository(db).snapshot_graph(workspace_id, project_id)
    object_keys = set(graph.referenced_object_keys) | {
        f"uploads/{workspace_id}/{project_id}/unattached.png",
        f"snapshots/{project_id}/old/snapshot.json.gz",
    }
    for key in object_keys:
        await upload_bytes(key, b"deletion-test", "application/octet-stream")

    preview = await client.post(
        f"/api/v1/projects/{project_id}/hard-delete/preview", headers=headers
    )
    assert preview.status_code == 200
    plan = preview.json()
    assert plan["archived"] is False
    assert (
        plan["counts"]
        | {
            "pages": 1,
            "project_assets": 1,
            "comments": 2,
            "revisions": 2,
            "revision_diffs": 1,
            "recovery_logs": 1,
            "share_links": 1,
            "guest_sessions": 1,
            "notifications": 1,
            "project_integrations": 1,
            "object_keys": 7,
        }
        == plan["counts"]
    )
    assert await db.projects.count_documents({"_id": ObjectId(project_id)}) == 1

    active_confirm = await client.post(
        f"/api/v1/projects/{project_id}/hard-delete/confirm",
        json={
            "correlation_id": plan["correlation_id"],
            "project_name": "Delete me",
            "acknowledge_permanent_deletion": True,
        },
        headers=headers,
    )
    assert active_confirm.status_code == 409

    archived = await client.delete(f"/api/v1/projects/{project_id}", headers=headers)
    assert archived.status_code == 204
    confirmed = await client.post(
        f"/api/v1/projects/{project_id}/hard-delete/confirm",
        json={
            "correlation_id": plan["correlation_id"],
            "project_name": "Delete me",
            "acknowledge_permanent_deletion": True,
        },
        headers=headers,
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["status"] == "deleted"
    assert plan["counts"]["object_keys"] == len(object_keys)
    for key in object_keys:
        with pytest.raises(ClientError):
            await download_bytes(key)

    for collection in (
        "projects",
        "pages",
        "project_assets",
        "comments",
        "revisions",
        "revision_diffs",
        "recovery_logs",
        "share_links",
        "guest_sessions",
        "notifications",
        "integrations",
    ):
        assert (
            await db[collection].count_documents(
                {
                    "$or": [
                        {"workspace_id": workspace_id, "project_id": project_id},
                        {"workspace_id": workspace_id, "page_id": ctx["page_id"]},
                        {"workspace_id": workspace_id, "comment_id": ctx["comment_id"]},
                        {"workspace_id": workspace_id, "payload_json.project_id": project_id},
                        {"workspace_id": workspace_id, "project_scope": project_id},
                        {"_id": ObjectId(project_id)},
                    ]
                }
            )
            == 0
        ), collection
    assert await db.guest_sessions.count_documents({"workspace_id": workspace_id}) == 0

    summary_events = await db.events.find(
        {"correlation_id": plan["correlation_id"], "type": "project.hard_deleted"}
    ).to_list(length=None)
    assert len(summary_events) == 1
    assert summary_events[0]["payload_json"]["counts"]["comments"] == 2

    retry = await client.post(
        f"/api/v1/projects/{project_id}/hard-delete/confirm",
        json={
            "correlation_id": plan["correlation_id"],
            "project_name": "Delete me",
            "acknowledge_permanent_deletion": True,
        },
        headers=headers,
    )
    assert retry.status_code == 200
    assert await db.events.count_documents({"correlation_id": plan["correlation_id"]}) == 1


async def _async(value: object) -> object:
    return value


async def test_hard_delete_has_no_direct_bypass_and_requires_admin_role(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    workspace_id, owner_token = await create_workspace_and_get_owner_token(
        client,
        monkeypatch,
        email="delete-auth-owner@example.com",
        code="810002",
        workspace_name="Delete auth",
    )
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    created = await client.post(
        f"/api/v1/workspaces/{workspace_id}/projects",
        json={"name": "Protected", "target_origin": "https://protected.example.test"},
        headers=owner_headers,
    )
    project_id = created.json()["id"]
    invite = await client.post(
        f"/api/v1/workspaces/{workspace_id}/members/invite",
        json={"email": "delete-member@example.com", "role": "member"},
        headers=owner_headers,
    )
    assert invite.status_code == 201
    login = await login_via_otp(client, monkeypatch, "delete-member@example.com", "810003")
    member_token = await switch_workspace(client, login["access_token"], workspace_id)

    preview = await client.post(
        f"/api/v1/projects/{project_id}/hard-delete/preview",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert preview.status_code == 403
    direct = await client.delete(f"/api/v1/projects/{project_id}/hard", headers=owner_headers)
    assert direct.status_code in (404, 405)


async def test_storage_failure_keeps_mongo_and_tombstone_is_retryable(
    client: AsyncClient,
    db: AsyncIOMotorDatabase,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ctx = await _seed_project_graph(client, db, monkeypatch)
    project_id = str(ctx["project_id"])
    headers = ctx["headers"]
    key = f"uploads/{ctx['workspace_id']}/{project_id}/retry.png"
    monkeypatch.setattr(deletion_service, "list_object_keys", lambda prefixes: _async([key]))

    async def no_enqueue(workspace_id: str, project_id: str, correlation_id: str) -> None:
        del workspace_id, project_id, correlation_id

    monkeypatch.setattr(deletion_service, "_enqueue_gc_retry", no_enqueue)
    preview = await client.post(
        f"/api/v1/projects/{project_id}/hard-delete/preview", headers=headers
    )
    await client.delete(f"/api/v1/projects/{project_id}", headers=headers)
    plan = preview.json()
    confirmation = {
        "correlation_id": plan["correlation_id"],
        "project_name": "Delete me",
        "acknowledge_permanent_deletion": True,
    }

    async def fail_delete(object_key: str) -> None:
        raise OSError(f"unavailable: {object_key}")

    monkeypatch.setattr("app.modules.storage.gc.delete_object", fail_delete)
    failed = await client.post(
        f"/api/v1/projects/{project_id}/hard-delete/confirm",
        json=confirmation,
        headers=headers,
    )
    assert failed.status_code == 502
    assert await db.projects.count_documents({"_id": ObjectId(project_id)}) == 1
    tombstone = await db.object_gc_tombstones.find_one({"key": key})
    assert tombstone is not None and tombstone["status"] == "failed"
    failed_plan = await db.deletion_plans.find_one({"correlation_id": plan["correlation_id"]})
    assert failed_plan is not None
    assert failed_plan["status"] == "storage_failed"
    assert "purge_after" not in failed_plan

    retried_keys: list[str] = []

    async def succeed_delete(object_key: str) -> None:
        retried_keys.append(object_key)

    monkeypatch.setattr("app.modules.storage.gc.delete_object", succeed_delete)
    retried = await client.post(
        f"/api/v1/projects/{project_id}/hard-delete/confirm",
        json=confirmation,
        headers=headers,
    )
    assert retried.status_code == 200
    assert key in retried_keys
    assert await db.projects.count_documents({"_id": ObjectId(project_id)}) == 0
    completed_plan = await db.deletion_plans.find_one({"correlation_id": plan["correlation_id"]})
    assert completed_plan is not None
    assert completed_plan["status"] == "complete"
    assert completed_plan["purge_after"] > datetime.now(UTC)
