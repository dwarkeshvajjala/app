"""In-app Notification Center (17-Notifications-Integrations.md §17.8)."""

import json
from typing import Any

import pytest
import redis.asyncio as redis
from httpx import AsyncClient
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import get_settings
from tests.helpers import create_project_with_guest_session, login_via_otp, switch_workspace
from tests.test_integrations import _register_page_and_comment


async def _invite_and_login_member(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    ctx: dict[str, Any],
    *,
    email: str,
    code: str,
) -> tuple[str, dict[str, str]]:
    invite = await client.post(
        f"/api/v1/workspaces/{ctx['workspace_id']}/members/invite",
        json={"email": email, "role": "member"},
        headers=ctx["owner_headers"],
    )
    assert invite.status_code == 201
    member_user_id = invite.json()["user_id"]

    login = await login_via_otp(client, monkeypatch, email, code)
    token = await switch_workspace(client, login["access_token"], ctx["workspace_id"])
    return member_user_id, {"Authorization": f"Bearer {token}"}


async def test_assigning_a_comment_to_someone_else_creates_a_notification(
    client: AsyncClient, db: AsyncIOMotorDatabase[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="notif1@example.com", code="940001", workspace_name="NOT1"
    )
    member_user_id, member_headers = await _invite_and_login_member(
        client, monkeypatch, ctx, email="notif1-member@example.com", code="940002"
    )
    _, comment_id = await _register_page_and_comment(client, ctx)

    resp = await client.patch(
        f"/api/v1/comments/{comment_id}",
        json={"assignee_id": member_user_id},
        headers=ctx["owner_headers"],
    )
    assert resp.status_code == 200

    listing = await client.get("/api/v1/notifications", headers=member_headers)
    assert listing.status_code == 200
    notifications = listing.json()
    assert len(notifications) == 1
    assert notifications[0]["type"] == "comment_assigned"
    assert notifications[0]["payload"]["comment_id"] == comment_id
    assert notifications[0]["read_at"] is None


async def test_assigning_a_comment_to_yourself_does_not_notify(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="notif2@example.com", code="940003", workspace_name="NOT2"
    )
    members = await client.get(
        f"/api/v1/workspaces/{ctx['workspace_id']}/members", headers=ctx["owner_headers"]
    )
    owner_user_id = members.json()[0]["user_id"]
    _, comment_id = await _register_page_and_comment(client, ctx)

    await client.patch(
        f"/api/v1/comments/{comment_id}",
        json={"assignee_id": owner_user_id},
        headers=ctx["owner_headers"],
    )

    listing = await client.get("/api/v1/notifications", headers=ctx["owner_headers"])
    assert listing.json() == []


async def test_unread_count_and_mark_read(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="notif3@example.com", code="940004", workspace_name="NOT3"
    )
    member_user_id, member_headers = await _invite_and_login_member(
        client, monkeypatch, ctx, email="notif3-member@example.com", code="940005"
    )
    _, comment_a = await _register_page_and_comment(client, ctx)
    _, comment_b = await _register_page_and_comment(client, ctx)

    for comment_id in (comment_a, comment_b):
        await client.patch(
            f"/api/v1/comments/{comment_id}",
            json={"assignee_id": member_user_id},
            headers=ctx["owner_headers"],
        )

    unread = await client.get("/api/v1/notifications/unread-count", headers=member_headers)
    assert unread.json() == 2

    listing = await client.get("/api/v1/notifications", headers=member_headers)
    first_id = listing.json()[0]["id"]

    mark_one = await client.patch(f"/api/v1/notifications/{first_id}/read", headers=member_headers)
    assert mark_one.status_code == 204

    unread = await client.get("/api/v1/notifications/unread-count", headers=member_headers)
    assert unread.json() == 1

    mark_all = await client.post("/api/v1/notifications/mark-all-read", headers=member_headers)
    assert mark_all.status_code == 204

    unread = await client.get("/api/v1/notifications/unread-count", headers=member_headers)
    assert unread.json() == 0


async def test_notification_read_state_is_scoped_per_user(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Marking a notification read via someone else's session must not affect it -
    NotificationRepository.mark_read filters by user_id, not just notification id."""
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="notif4@example.com", code="940006", workspace_name="NOT4"
    )
    member_user_id, member_headers = await _invite_and_login_member(
        client, monkeypatch, ctx, email="notif4-member@example.com", code="940007"
    )
    _, comment_id = await _register_page_and_comment(client, ctx)
    await client.patch(
        f"/api/v1/comments/{comment_id}",
        json={"assignee_id": member_user_id},
        headers=ctx["owner_headers"],
    )
    notification_id = (await client.get("/api/v1/notifications", headers=member_headers)).json()[0][
        "id"
    ]

    # The owner (a different user) tries to mark it read - should be a no-op.
    await client.patch(
        f"/api/v1/notifications/{notification_id}/read", headers=ctx["owner_headers"]
    )

    listing = await client.get("/api/v1/notifications", headers=member_headers)
    assert listing.json()[0]["read_at"] is None


async def test_notification_new_is_published_over_websocket_channel(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="notif5@example.com", code="940008", workspace_name="NOT5"
    )
    member_user_id, _ = await _invite_and_login_member(
        client, monkeypatch, ctx, email="notif5-member@example.com", code="940009"
    )
    _, comment_id = await _register_page_and_comment(client, ctx)

    settings = get_settings()
    redis_client: redis.Redis = redis.from_url(settings.redis_url)  # type: ignore[no-untyped-call]
    pubsub = redis_client.pubsub()
    workspace_channel = f"ws:workspace:{ctx['workspace_id']}:all"
    await pubsub.subscribe(workspace_channel)
    await pubsub.get_message(timeout=1)

    await client.patch(
        f"/api/v1/comments/{comment_id}",
        json={"assignee_id": member_user_id},
        headers=ctx["owner_headers"],
    )

    envelope = None
    for _ in range(10):
        message = await pubsub.get_message(timeout=1)
        if not message or message["type"] != "message":
            continue
        candidate = json.loads(message["data"])
        if candidate["type"] == "notification.new":
            envelope = candidate
            break
    assert envelope is not None
    assert envelope["payload"]["recipient_user_id"] == member_user_id
    assert envelope["payload"]["type"] == "comment_assigned"

    await pubsub.unsubscribe(workspace_channel)
    await pubsub.aclose()  # type: ignore[no-untyped-call]
    await redis_client.aclose()
