"""Email notifications (17-Notifications-Integrations.md §17.6): the daily digest and
the guest "your feedback was addressed" opt-in notice. `send_email` itself already logs
instead of sending without a configured RESEND_API_KEY (app/core/email.py, since M1) -
these tests monkeypatch it directly to assert on calls, the same way M1's auth tests do."""

from typing import Any
from unittest.mock import AsyncMock

import pytest
from bson import ObjectId
from httpx import AsyncClient
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.modules.notifications import digest as digest_module
from tests.helpers import create_project_with_guest_session
from tests.test_integrations import _register_page_and_comment

SAMPLE_ANCHOR = {
    "tier": 1,
    "dom_fingerprint": {
        "selector_path": "body > button",
        "tag": "button",
        "attributes": {},
        "node_hash": "sha256:a",
        "ancestor_path_hash": "sha256:b",
    },
    "text_fingerprint": {"normalized_text": "hi", "text_similarity_hash": "0" * 16},
}
SAMPLE_CONTEXT = {
    "browser": "Chrome",
    "os": "macOS",
    "viewport": {"width": 1440, "height": 900},
    "device_type": "desktop",
    "url": "https://reviewable.example.com/",
}


async def test_first_digest_run_establishes_checkpoint_without_emailing(
    client: AsyncClient, db: AsyncIOMotorDatabase[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="digest1@example.com", code="950001", workspace_name="DIG1"
    )
    await _register_page_and_comment(client, ctx)

    sent = AsyncMock()
    monkeypatch.setattr(digest_module, "send_email", sent)

    workspace_doc = await db.workspaces.find_one({"_id": ObjectId(ctx["workspace_id"])})
    assert workspace_doc["last_digest_sent_at"] is None

    count = await digest_module.run_digest_for_workspace(db, workspace_doc)

    assert count == 0
    sent.assert_not_called()
    updated = await db.workspaces.find_one({"_id": workspace_doc["_id"]})
    assert updated["last_digest_sent_at"] is not None


async def test_second_run_emails_every_member_with_new_comments_grouped_by_project(
    client: AsyncClient, db: AsyncIOMotorDatabase[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="digest2@example.com", code="950002", workspace_name="DIG2"
    )
    workspace_doc = await db.workspaces.find_one({"_id": ObjectId(ctx["workspace_id"])})

    sent = AsyncMock()
    monkeypatch.setattr(digest_module, "send_email", sent)

    # First run just sets the checkpoint (no comments exist yet at that point either way).
    await digest_module.run_digest_for_workspace(db, workspace_doc)
    sent.reset_mock()

    await _register_page_and_comment(client, ctx)
    await _register_page_and_comment(client, ctx)

    workspace_doc = await db.workspaces.find_one({"_id": ObjectId(ctx["workspace_id"])})
    count = await digest_module.run_digest_for_workspace(db, workspace_doc)

    assert count == 2
    # Exactly one workspace member (the owner) - one email, mentioning both comments.
    assert sent.call_count == 1
    call_kwargs = sent.call_args.kwargs
    assert call_kwargs["to"] == "digest2@example.com"
    assert "2 new comment" in call_kwargs["subject"]


async def test_no_new_comments_sends_nothing(
    client: AsyncClient, db: AsyncIOMotorDatabase[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="digest3@example.com", code="950003", workspace_name="DIG3"
    )
    workspace_doc = await db.workspaces.find_one({"_id": ObjectId(ctx["workspace_id"])})

    sent = AsyncMock()
    monkeypatch.setattr(digest_module, "send_email", sent)
    await digest_module.run_digest_for_workspace(db, workspace_doc)
    sent.reset_mock()

    workspace_doc = await db.workspaces.find_one({"_id": ObjectId(ctx["workspace_id"])})
    count = await digest_module.run_digest_for_workspace(db, workspace_doc)

    assert count == 0
    sent.assert_not_called()


async def test_guest_resolved_email_is_enqueued_when_opted_in(
    client: AsyncClient, db: AsyncIOMotorDatabase[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="digest4@example.com", code="950004", workspace_name="DIG4"
    )
    link_resp = await client.post(
        f"/api/v1/projects/{ctx['project_id']}/share-links",
        json={"mode": "snippet"},
        headers=ctx["owner_headers"],
    )
    share_token = link_resp.json()["token"]
    guest_resp = await client.post(
        "/api/v1/guest-sessions",
        json={
            "share_token": share_token,
            "display_name": "Opted In Guest",
            "email": "guest@example.com",
        },
        headers={"User-Agent": "pytest", "X-Forwarded-For": "10.9.9.9"},
    )
    assert guest_resp.status_code == 201
    guest_headers = {"X-Guest-Session": guest_resp.json()["guest_session_token"]}

    page_resp = await client.post(
        "/api/v1/pages",
        json={"project_id": ctx["project_id"], "url": "https://reviewable.example.com/"},
        headers=guest_headers,
    )
    page_id = page_resp.json()["id"]
    comment_resp = await client.post(
        f"/api/v1/pages/{page_id}/comments",
        json={
            "body": "Please fix this",
            "layer": "client",
            "anchor": SAMPLE_ANCHOR,
            "context": SAMPLE_CONTEXT,
            "screenshot_key": None,
            "capture_status": "ok",
        },
        headers=guest_headers,
    )
    comment_id = comment_resp.json()["id"]

    import redis.asyncio as redis

    from app.core.config import get_settings

    settings = get_settings()
    redis_client: redis.Redis = redis.from_url(settings.redis_url)  # type: ignore[no-untyped-call]
    queue_len_before = await redis_client.zcard("arq:queue")

    resp = await client.patch(
        f"/api/v1/comments/{comment_id}",
        json={"status": "resolved"},
        headers=ctx["owner_headers"],
    )
    assert resp.status_code == 200

    queue_len_after = await redis_client.zcard("arq:queue")
    assert queue_len_after == queue_len_before + 1
    await redis_client.aclose()
