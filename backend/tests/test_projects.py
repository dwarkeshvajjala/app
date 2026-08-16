import pytest
from httpx import AsyncClient

from app.core.security import decode_access_token
from tests.helpers import create_workspace_and_get_owner_token


async def test_create_and_list_projects(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    workspace_id, owner_token = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="proj-owner1@example.com", code="200001", workspace_name="P1"
    )
    headers = {"Authorization": f"Bearer {owner_token}"}

    created = await client.post(
        f"/api/v1/workspaces/{workspace_id}/projects",
        json={"name": "Marketing Site", "target_origin": "https://example.com"},
        headers=headers,
    )
    assert created.status_code == 201
    project = created.json()
    assert project["name"] == "Marketing Site"
    assert project["settings"] == {"proxy_mode": False, "snippet_installed": False}
    assert project["archived_at"] is None
    # Card attribution on the workspace dashboard needs to know who created it.
    assert project["created_by"] == decode_access_token(owner_token).sub

    listing = await client.get(f"/api/v1/workspaces/{workspace_id}/projects", headers=headers)
    assert listing.status_code == 200
    # 2, not 1: every workspace is seeded with an "Example Project" on creation
    # (F7, Milestone 9's onboarding empty state) - this asserts the newly-created one
    # is present alongside it, not that it's the only project.
    names = {p["name"] for p in listing.json()}
    assert names == {"Marketing Site", "Example Project"}


async def test_archived_projects_excluded_from_default_list(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    workspace_id, owner_token = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="proj-owner2@example.com", code="200002", workspace_name="P2"
    )
    headers = {"Authorization": f"Bearer {owner_token}"}

    created = await client.post(
        f"/api/v1/workspaces/{workspace_id}/projects",
        json={"name": "Old Site", "target_origin": "https://old.example.com"},
        headers=headers,
    )
    project_id = created.json()["id"]

    archive_resp = await client.delete(f"/api/v1/projects/{project_id}", headers=headers)
    assert archive_resp.status_code == 204

    listing = await client.get(f"/api/v1/workspaces/{workspace_id}/projects", headers=headers)
    # Only the seeded "Example Project" remains (F7) - "Old Site" is archived out.
    names = {p["name"] for p in listing.json()}
    assert names == {"Example Project"}

    # Still individually fetchable (soft archive, not a hard delete).
    detail = await client.get(f"/api/v1/projects/{project_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["archived_at"] is not None


async def test_project_not_visible_across_workspaces(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    workspace_a, token_a = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="proj-owner3@example.com", code="200003", workspace_name="A"
    )
    headers_a = {"Authorization": f"Bearer {token_a}"}
    project = await client.post(
        f"/api/v1/workspaces/{workspace_a}/projects",
        json={"name": "Secret Project", "target_origin": "https://secret.example.com"},
        headers=headers_a,
    )
    project_id = project.json()["id"]

    _, token_b = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="proj-owner4@example.com", code="200004", workspace_name="B"
    )
    headers_b = {"Authorization": f"Bearer {token_b}"}

    cross_tenant = await client.get(f"/api/v1/projects/{project_id}", headers=headers_b)
    assert cross_tenant.status_code == 404


async def test_update_project(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    workspace_id, owner_token = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="proj-owner5@example.com", code="200005", workspace_name="P5"
    )
    headers = {"Authorization": f"Bearer {owner_token}"}

    created = await client.post(
        f"/api/v1/workspaces/{workspace_id}/projects",
        json={"name": "Draft Name", "target_origin": "https://draft.example.com"},
        headers=headers,
    )
    project_id = created.json()["id"]

    updated = await client.patch(
        f"/api/v1/projects/{project_id}",
        json={"name": "Final Name"},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Final Name"
    assert updated.json()["target_origin"] == "https://draft.example.com"
