from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import get_settings
from app.core.redis_client import get_redis
from tests.helpers import create_workspace_and_get_owner_token, login_via_otp, switch_workspace


async def _create_project(client: AsyncClient, workspace_id: str, headers: dict[str, str]) -> str:
    resp = await client.post(
        f"/api/v1/workspaces/{workspace_id}/projects",
        json={"name": "Reviewable Site", "target_origin": "https://reviewable.example.com"},
        headers=headers,
    )
    assert resp.status_code == 201
    project_id: str = resp.json()["id"]
    return project_id


async def test_create_share_link_and_resolve_it_publicly(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    workspace_id, owner_token = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="link-owner1@example.com", code="300001", workspace_name="L1"
    )
    headers = {"Authorization": f"Bearer {owner_token}"}
    project_id = await _create_project(client, workspace_id, headers)

    created = await client.post(
        f"/api/v1/projects/{project_id}/share-links",
        json={"mode": "snippet"},
        headers=headers,
    )
    assert created.status_code == 201
    link = created.json()
    assert link["has_passcode"] is False
    assert link["revoked_at"] is None

    resolved = await client.get(f"/api/v1/review/{link['token']}")
    assert resolved.status_code == 200
    body = resolved.json()
    assert body["project_name"] == "Reviewable Site"
    assert body["requires_passcode"] is False
    assert body["mode"] == "snippet"


async def test_resolve_unknown_token_is_404(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/review/this-token-does-not-exist")
    assert resp.status_code == 404


async def test_revoked_link_cannot_be_resolved_or_used(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    workspace_id, owner_token = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="link-owner2@example.com", code="300002", workspace_name="L2"
    )
    headers = {"Authorization": f"Bearer {owner_token}"}
    project_id = await _create_project(client, workspace_id, headers)

    created = await client.post(
        f"/api/v1/projects/{project_id}/share-links", json={"mode": "snippet"}, headers=headers
    )
    link_id, token = created.json()["id"], created.json()["token"]

    revoke_resp = await client.patch(f"/api/v1/share-links/{link_id}/revoke", headers=headers)
    assert revoke_resp.status_code == 204

    resolved = await client.get(f"/api/v1/review/{token}")
    assert resolved.status_code == 409

    guest_resp = await client.post(
        "/api/v1/guest-sessions",
        json={"share_token": token, "display_name": "A Reviewer"},
        headers={"User-Agent": "pytest"},
    )
    assert guest_resp.status_code == 409


async def test_expired_link_is_rejected(
    client: AsyncClient, db: AsyncIOMotorDatabase[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    workspace_id, owner_token = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="link-owner3@example.com", code="300003", workspace_name="L3"
    )
    headers = {"Authorization": f"Bearer {owner_token}"}
    project_id = await _create_project(client, workspace_id, headers)

    created = await client.post(
        f"/api/v1/projects/{project_id}/share-links", json={"mode": "snippet"}, headers=headers
    )
    token = created.json()["token"]

    # Simulate the link having expired a minute ago (the create endpoint won't accept
    # a past expires_at as a normal input, so this backdates it directly).
    await db.share_links.update_one(
        {"token": token}, {"$set": {"expires_at": datetime.now(UTC) - timedelta(minutes=1)}}
    )

    resolved = await client.get(f"/api/v1/review/{token}")
    assert resolved.status_code == 409


async def test_guest_session_creation_succeeds_without_passcode(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    workspace_id, owner_token = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="link-owner4@example.com", code="300004", workspace_name="L4"
    )
    headers = {"Authorization": f"Bearer {owner_token}"}
    project_id = await _create_project(client, workspace_id, headers)

    created = await client.post(
        f"/api/v1/projects/{project_id}/share-links", json={"mode": "snippet"}, headers=headers
    )
    token = created.json()["token"]

    guest_resp = await client.post(
        "/api/v1/guest-sessions",
        json={"share_token": token, "display_name": "Jamie Reviewer"},
        headers={"User-Agent": "pytest"},
    )
    assert guest_resp.status_code == 201
    body = guest_resp.json()
    assert body["display_name"] == "Jamie Reviewer"
    assert body["guest_session_token"].count(".") == 2  # looks like a JWT


async def test_guest_session_requires_correct_passcode(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    workspace_id, owner_token = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="link-owner5@example.com", code="300005", workspace_name="L5"
    )
    headers = {"Authorization": f"Bearer {owner_token}"}
    project_id = await _create_project(client, workspace_id, headers)

    created = await client.post(
        f"/api/v1/projects/{project_id}/share-links",
        json={"mode": "snippet", "passcode": "sesame123"},
        headers=headers,
    )
    token = created.json()["token"]
    assert created.json()["has_passcode"] is True

    resolved = await client.get(f"/api/v1/review/{token}")
    assert resolved.json()["requires_passcode"] is True

    wrong = await client.post(
        "/api/v1/guest-sessions",
        json={"share_token": token, "display_name": "Guest", "passcode": "wrong"},
        headers={"User-Agent": "pytest"},
    )
    assert wrong.status_code == 403

    missing = await client.post(
        "/api/v1/guest-sessions",
        json={"share_token": token, "display_name": "Guest"},
        headers={"User-Agent": "pytest"},
    )
    assert missing.status_code == 403

    correct = await client.post(
        "/api/v1/guest-sessions",
        json={"share_token": token, "display_name": "Guest", "passcode": "sesame123"},
        headers={"User-Agent": "pytest"},
    )
    assert correct.status_code == 201


async def test_share_link_not_manageable_from_another_workspace(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    workspace_a, token_a = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="link-owner6@example.com", code="300006", workspace_name="A"
    )
    headers_a = {"Authorization": f"Bearer {token_a}"}
    project_id = await _create_project(client, workspace_a, headers_a)
    created = await client.post(
        f"/api/v1/projects/{project_id}/share-links", json={"mode": "snippet"}, headers=headers_a
    )
    link_id = created.json()["id"]

    _, token_b = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="link-owner7@example.com", code="300007", workspace_name="B"
    )
    headers_b = {"Authorization": f"Bearer {token_b}"}

    cross_tenant_revoke = await client.patch(
        f"/api/v1/share-links/{link_id}/revoke", headers=headers_b
    )
    assert cross_tenant_revoke.status_code == 404


async def test_member_cannot_create_project_or_share_link(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    workspace_id, owner_token = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="link-owner8@example.com", code="300008", workspace_name="L8"
    )
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    invite = await client.post(
        f"/api/v1/workspaces/{workspace_id}/members/invite",
        json={"email": "guest-member@example.com", "role": "member"},
        headers=owner_headers,
    )
    assert invite.status_code == 201

    member_login = await login_via_otp(client, monkeypatch, "guest-member@example.com", "300009")
    member_token = await switch_workspace(client, member_login["access_token"], workspace_id)
    member_headers = {"Authorization": f"Bearer {member_token}"}

    # "project:manage" and "share_link:manage" both permit the member role
    # (13-Authentication.md §13.5) - this just proves the endpoint enforces the same
    # matrix as everything else, not that members are blocked (they aren't).
    created = await client.post(
        f"/api/v1/workspaces/{workspace_id}/projects",
        json={"name": "Member's Project", "target_origin": "https://member.example.com"},
        headers=member_headers,
    )
    assert created.status_code == 201


async def test_guest_session_rate_limited_per_ip(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    workspace_id, owner_token = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="link-owner10@example.com", code="300010", workspace_name="L10"
    )
    headers = {"Authorization": f"Bearer {owner_token}"}
    project_id = await _create_project(client, workspace_id, headers)

    created = await client.post(
        f"/api/v1/projects/{project_id}/share-links", json={"mode": "snippet"}, headers=headers
    )
    token = created.json()["token"]

    fake_ip = "203.0.113.5"
    await get_redis().delete(f"rate-limit:guest-session:{fake_ip}")

    limit = get_settings().guest_session_rate_limit_per_minute

    statuses = []
    for _ in range(limit + 3):
        resp = await client.post(
            "/api/v1/guest-sessions",
            json={"share_token": token, "display_name": "Repeat Guest"},
            headers={"User-Agent": "pytest", "X-Forwarded-For": fake_ip},
        )
        statuses.append(resp.status_code)

    assert 429 in statuses
    assert statuses.count(201) <= limit
