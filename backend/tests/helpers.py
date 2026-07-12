import hashlib
from typing import Any

import pytest
from httpx import AsyncClient

from app.modules.auth import service as auth_service


def _fake_ip_for(seed: str) -> str:
    digest = hashlib.sha256(seed.encode()).hexdigest()
    return ".".join(str(int(digest[i : i + 2], 16)) for i in range(0, 8, 2))


async def login_via_otp(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, email: str, code: str
) -> dict[str, Any]:
    monkeypatch.setattr(auth_service, "generate_otp_code", lambda: code)
    await client.post("/api/v1/auth/otp/request", json={"email": email})
    resp = await client.post("/api/v1/auth/otp/verify", json={"email": email, "code": code})
    assert resp.status_code == 200
    return dict(resp.json())


async def switch_workspace(client: AsyncClient, access_token: str, workspace_id: str) -> str:
    resp = await client.post(
        "/api/v1/auth/switch-workspace",
        json={"workspace_id": workspace_id},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert resp.status_code == 200
    token: str = resp.json()["access_token"]
    return token


async def create_workspace_and_get_owner_token(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    *,
    email: str,
    code: str,
    workspace_name: str,
) -> tuple[str, str]:
    """Returns (workspace_id, workspace-scoped owner access token)."""
    login = await login_via_otp(client, monkeypatch, email, code)
    created = await client.post(
        "/api/v1/workspaces",
        json={"name": workspace_name},
        headers={"Authorization": f"Bearer {login['access_token']}"},
    )
    assert created.status_code == 201
    workspace_id: str = created.json()["id"]
    owner_token = await switch_workspace(client, login["access_token"], workspace_id)
    return workspace_id, owner_token


async def create_project_with_guest_session(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    *,
    email: str,
    code: str,
    workspace_name: str,
    project_name: str = "Test Project",
    target_origin: str = "https://reviewable.example.com",
) -> dict[str, Any]:
    """Full setup for pages/snapshots/uploads tests: workspace -> project -> share link
    -> guest session. Returns everything a test might need to address any of them."""
    workspace_id, owner_token = await create_workspace_and_get_owner_token(
        client, monkeypatch, email=email, code=code, workspace_name=workspace_name
    )
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    project_resp = await client.post(
        f"/api/v1/workspaces/{workspace_id}/projects",
        json={"name": project_name, "target_origin": target_origin},
        headers=owner_headers,
    )
    assert project_resp.status_code == 201
    project_id = project_resp.json()["id"]

    link_resp = await client.post(
        f"/api/v1/projects/{project_id}/share-links",
        json={"mode": "snippet"},
        headers=owner_headers,
    )
    assert link_resp.status_code == 201
    share_token = link_resp.json()["token"]

    guest_resp = await client.post(
        "/api/v1/guest-sessions",
        json={"share_token": share_token, "display_name": "Test Guest"},
        # Every test otherwise shares one apparent client IP under ASGITransport, which
        # means they'd all compete for the same guest-session rate-limit bucket
        # (core/rate_limit.py) - a distinct fake IP per caller keeps tests independent,
        # the same way distinct guests in reality have distinct IPs.
        headers={"User-Agent": "pytest", "X-Forwarded-For": _fake_ip_for(email)},
    )
    assert guest_resp.status_code == 201
    guest_token: str = guest_resp.json()["guest_session_token"]

    return {
        "workspace_id": workspace_id,
        "owner_token": owner_token,
        "owner_headers": owner_headers,
        "project_id": project_id,
        "share_token": share_token,
        "guest_token": guest_token,
        "guest_headers": {"X-Guest-Session": guest_token},
    }
