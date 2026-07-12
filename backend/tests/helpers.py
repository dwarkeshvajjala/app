from typing import Any

import pytest
from httpx import AsyncClient

from app.modules.auth import service as auth_service


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
