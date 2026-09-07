import pytest
from httpx import AsyncClient

from tests.helpers import create_workspace_and_get_owner_token, login_via_otp


async def test_workspace_search_returns_only_active_workspace_documents(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The same account owns both workspaces: the active-token guard and every search
    # query must still prevent a result from workspace B appearing in workspace A.
    login = await login_via_otp(client, monkeypatch, "search-owner@example.com", "901001")
    headers = {"Authorization": f"Bearer {login['access_token']}"}
    first = await client.post("/api/v1/workspaces", json={"name": "Search Alpha"}, headers=headers)
    second = await client.post("/api/v1/workspaces", json={"name": "Search Beta"}, headers=headers)
    assert first.status_code == second.status_code == 201

    from tests.helpers import switch_workspace

    alpha_id, beta_id = first.json()["id"], second.json()["id"]
    alpha_token = await switch_workspace(client, login["access_token"], alpha_id)
    beta_token = await switch_workspace(client, login["access_token"], beta_id)
    for workspace_id, token, name in (
        (alpha_id, alpha_token, "Shared Search Alpha"),
        (beta_id, beta_token, "Shared Search Beta"),
    ):
        created = await client.post(
            f"/api/v1/workspaces/{workspace_id}/projects",
            json={"name": name, "target_origin": "https://search.example.test"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert created.status_code == 201

    response = await client.get(
        f"/api/v1/workspaces/{alpha_id}/search?q=Shared+Search",
        headers={"Authorization": f"Bearer {alpha_token}"},
    )
    assert response.status_code == 200
    assert [item["title"] for item in response.json()["items"]] == ["Shared Search Alpha"]

    cross_workspace = await client.get(
        f"/api/v1/workspaces/{beta_id}/search?q=Shared+Search",
        headers={"Authorization": f"Bearer {alpha_token}"},
    )
    assert cross_workspace.status_code == 403


async def test_workspace_search_rejects_empty_query(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    workspace_id, token = await create_workspace_and_get_owner_token(
        client,
        monkeypatch,
        email="search-empty@example.com",
        code="901002",
        workspace_name="Search Empty",
    )
    response = await client.get(
        f"/api/v1/workspaces/{workspace_id}/search?q=",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422
