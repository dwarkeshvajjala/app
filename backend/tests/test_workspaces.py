from typing import Any

import pytest
from httpx import AsyncClient

from app.modules.auth import service as auth_service


async def _login(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, email: str, code: str
) -> dict[str, Any]:
    monkeypatch.setattr(auth_service, "generate_otp_code", lambda: code)
    await client.post("/api/v1/auth/otp/request", json={"email": email})
    resp = await client.post("/api/v1/auth/otp/verify", json={"email": email, "code": code})
    assert resp.status_code == 200
    return dict(resp.json())


async def _switch(client: AsyncClient, access_token: str, workspace_id: str) -> str:
    resp = await client.post(
        "/api/v1/auth/switch-workspace",
        json={"workspace_id": workspace_id},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert resp.status_code == 200
    token: str = resp.json()["access_token"]
    return token


async def test_create_workspace_makes_creator_owner(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    login = await _login(client, monkeypatch, "owner1@example.com", "100001")

    created = await client.post(
        "/api/v1/workspaces",
        json={"name": "Acme Agency"},
        headers={"Authorization": f"Bearer {login['access_token']}"},
    )
    assert created.status_code == 201
    body = created.json()
    assert body["slug"] == "acme-agency"
    assert body["role"] == "owner"


async def test_duplicate_workspace_names_get_distinct_slugs(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    login = await _login(client, monkeypatch, "owner2@example.com", "100002")
    headers = {"Authorization": f"Bearer {login['access_token']}"}

    first = await client.post("/api/v1/workspaces", json={"name": "Acme"}, headers=headers)
    second = await client.post("/api/v1/workspaces", json={"name": "Acme"}, headers=headers)

    assert first.json()["slug"] == "acme"
    assert second.json()["slug"] == "acme-2"


async def test_member_role_forbidden_from_inviting(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner = await _login(client, monkeypatch, "owner3@example.com", "100003")
    owner_headers = {"Authorization": f"Bearer {owner['access_token']}"}

    workspace = await client.post(
        "/api/v1/workspaces", json={"name": "Member Test Co"}, headers=owner_headers
    )
    workspace_id = workspace.json()["id"]
    owner_ws_token = await _switch(client, owner["access_token"], workspace_id)

    invite = await client.post(
        f"/api/v1/workspaces/{workspace_id}/members/invite",
        json={"email": "teammate3@example.com", "role": "member"},
        headers={"Authorization": f"Bearer {owner_ws_token}"},
    )
    assert invite.status_code == 201

    member_login = await _login(client, monkeypatch, "teammate3@example.com", "100004")
    member_ws_token = await _switch(client, member_login["access_token"], workspace_id)

    forbidden = await client.post(
        f"/api/v1/workspaces/{workspace_id}/members/invite",
        json={"email": "someone-else@example.com", "role": "member"},
        headers={"Authorization": f"Bearer {member_ws_token}"},
    )
    assert forbidden.status_code == 403
    assert forbidden.json()["error"]["code"] == "PERMISSION_DENIED"

    # But a plain member can still view the roster (13-Authentication.md §13.5).
    listing = await client.get(
        f"/api/v1/workspaces/{workspace_id}/members",
        headers={"Authorization": f"Bearer {member_ws_token}"},
    )
    assert listing.status_code == 200
    assert len(listing.json()) == 2


async def test_token_scoped_to_one_workspace_cannot_touch_another(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner = await _login(client, monkeypatch, "owner4@example.com", "100005")
    owner_headers = {"Authorization": f"Bearer {owner['access_token']}"}

    ws_a = await client.post("/api/v1/workspaces", json={"name": "Tenant A"}, headers=owner_headers)
    ws_b = await client.post("/api/v1/workspaces", json={"name": "Tenant B"}, headers=owner_headers)
    ws_a_id, ws_b_id = ws_a.json()["id"], ws_b.json()["id"]

    token_scoped_to_a = await _switch(client, owner["access_token"], ws_a_id)

    # Cross-tenant guarantee (03-System-Architecture.md §3.5): even the same owner's
    # token, once scoped to workspace A, must not authorize workspace B's resources.
    cross_tenant = await client.get(
        f"/api/v1/workspaces/{ws_b_id}/members",
        headers={"Authorization": f"Bearer {token_scoped_to_a}"},
    )
    assert cross_tenant.status_code == 403


async def test_cannot_remove_or_demote_the_owner(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner = await _login(client, monkeypatch, "owner5@example.com", "100006")
    owner_headers = {"Authorization": f"Bearer {owner['access_token']}"}

    workspace = await client.post(
        "/api/v1/workspaces", json={"name": "Owner Safety Co"}, headers=owner_headers
    )
    workspace_id = workspace.json()["id"]
    owner_ws_token = await _switch(client, owner["access_token"], workspace_id)
    owner_ws_headers = {"Authorization": f"Bearer {owner_ws_token}"}

    members = await client.get(
        f"/api/v1/workspaces/{workspace_id}/members", headers=owner_ws_headers
    )
    owner_membership_id = members.json()[0]["id"]

    demote = await client.patch(
        f"/api/v1/workspaces/{workspace_id}/members/{owner_membership_id}",
        json={"role": "admin"},
        headers=owner_ws_headers,
    )
    assert demote.status_code == 422

    remove = await client.delete(
        f"/api/v1/workspaces/{workspace_id}/members/{owner_membership_id}",
        headers=owner_ws_headers,
    )
    assert remove.status_code == 422


async def test_no_workspace_context_yet_gets_permission_denied(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    login = await _login(client, monkeypatch, "no-context@example.com", "100007")
    workspace = await client.post(
        "/api/v1/workspaces",
        json={"name": "No Context Co"},
        headers={"Authorization": f"Bearer {login['access_token']}"},
    )
    workspace_id = workspace.json()["id"]

    # Using the raw pre-workspace-selection token (no switch-workspace call yet)
    # against a role-gated endpoint must fail, not silently pass.
    resp = await client.get(
        f"/api/v1/workspaces/{workspace_id}/members",
        headers={"Authorization": f"Bearer {login['access_token']}"},
    )
    assert resp.status_code == 403
