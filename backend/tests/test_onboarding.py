"""Milestone 9 onboarding polish: F7's seeded sample project (16-Dashboard.md's
"teach by doing" empty state) and the "install-free path first" default share link
created alongside every new project (03-System-Architecture.md §3.3)."""

import pytest
from httpx import AsyncClient

from app.core.security import decode_access_token
from tests.helpers import create_workspace_and_get_owner_token, login_via_otp, switch_workspace


async def test_new_workspace_is_seeded_with_an_example_project(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    workspace_id, owner_token = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="onboard1@example.com", code="910001", workspace_name="OB1"
    )
    headers = {"Authorization": f"Bearer {owner_token}"}

    projects = await client.get(f"/api/v1/workspaces/{workspace_id}/projects", headers=headers)
    assert projects.status_code == 200
    names = [p["name"] for p in projects.json()]
    assert names == ["Example Project"]
    project_id = projects.json()[0]["id"]
    assert projects.json()[0]["created_by"] == decode_access_token(owner_token).sub

    comments = await client.get(f"/api/v1/projects/{project_id}/comments", headers=headers)
    assert comments.status_code == 200
    seeded = comments.json()
    assert len(seeded) == 3
    layers = {c["layer"] for c in seeded}
    assert layers == {"client", "team"}
    statuses = {c["status"] for c in seeded}
    assert statuses == {"todo", "in_progress", "resolved"}

    # The team-only comment is a *reply* to the client-visible one (Milestone 12 fix -
    # previously seeded with parent_id: None regardless, so the dashboard's new thread
    # view showed it as an unrelated top-level card instead of demonstrating a thread).
    top_level = [c for c in seeded if c["parent_id"] is None]
    replies = [c for c in seeded if c["parent_id"] is not None]
    assert len(top_level) == 2
    assert len(replies) == 1

    # The seeded project also needs a default share link (dashboard "open the live
    # site" canvas) - seed_sample_project builds the project directly via
    # ProjectRepository rather than going through projects.service.create_project, so
    # it never got the same "shareable the instant it exists" default link every
    # normally-created project gets (Milestone 9) until this was fixed.
    links = await client.get(f"/api/v1/projects/{project_id}/share-links", headers=headers)
    assert links.status_code == 200
    assert len(links.json()) == 1
    assert links.json()[0]["mode"] == "proxy"
    assert links.json()[0]["revoked_at"] is None
    assert replies[0]["layer"] == "team"
    original = next(c for c in top_level if "punchier headline" in c["body"])
    assert replies[0]["parent_id"] == original["id"]


async def test_second_workspace_from_the_same_user_is_also_seeded(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Every new workspace gets its own sample project, not just the user's first
    ever - each workspace is its own onboarding experience."""
    await create_workspace_and_get_owner_token(
        client, monkeypatch, email="onboard2@example.com", code="910002", workspace_name="OB2-A"
    )
    login = await login_via_otp(client, monkeypatch, "onboard2@example.com", "910003")
    raw_token = login["access_token"]

    second_ws = await client.post(
        "/api/v1/workspaces",
        json={"name": "OB2-B"},
        headers={"Authorization": f"Bearer {raw_token}"},
    )
    assert second_ws.status_code == 201
    second_workspace_id = second_ws.json()["id"]
    second_token = await switch_workspace(client, raw_token, second_workspace_id)

    projects = await client.get(
        f"/api/v1/workspaces/{second_workspace_id}/projects",
        headers={"Authorization": f"Bearer {second_token}"},
    )
    assert [p["name"] for p in projects.json()] == ["Example Project"]


async def test_new_project_is_created_with_a_default_proxy_share_link(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    workspace_id, owner_token = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="onboard3@example.com", code="910004", workspace_name="OB3"
    )
    headers = {"Authorization": f"Bearer {owner_token}"}

    created = await client.post(
        f"/api/v1/workspaces/{workspace_id}/projects",
        json={"name": "Client Site", "target_origin": "https://client-site.example.com"},
        headers=headers,
    )
    assert created.status_code == 201
    project_id = created.json()["id"]

    links = await client.get(f"/api/v1/projects/{project_id}/share-links", headers=headers)
    assert links.status_code == 200
    assert len(links.json()) == 1
    link = links.json()[0]
    assert link["mode"] == "proxy"
    assert link["has_passcode"] is False
    assert link["revoked_at"] is None
