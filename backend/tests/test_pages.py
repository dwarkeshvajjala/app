import pytest
from httpx import AsyncClient

from tests.helpers import create_project_with_guest_session, create_workspace_and_get_owner_token


async def test_guest_can_register_a_page(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="pages1@example.com", code="500001", workspace_name="P1"
    )

    resp = await client.post(
        "/api/v1/pages",
        json={
            "project_id": ctx["project_id"],
            "url": "https://Reviewable.Example.com/Pricing/?utm_source=x#section",
            "title": "Pricing",
        },
        headers=ctx["guest_headers"],
    )
    assert resp.status_code == 201
    body = resp.json()
    # lowercased scheme/host, trailing slash + fragment stripped, query kept, path case preserved.
    assert body["url_normalized"] == "https://reviewable.example.com/Pricing?utm_source=x"
    assert body["latest_revision_id"] is None


async def test_page_registration_is_idempotent_on_normalized_url(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="pages2@example.com", code="500002", workspace_name="P2"
    )

    first = await client.post(
        "/api/v1/pages",
        json={"project_id": ctx["project_id"], "url": "https://reviewable.example.com/about/"},
        headers=ctx["guest_headers"],
    )
    second = await client.post(
        "/api/v1/pages",
        json={"project_id": ctx["project_id"], "url": "https://reviewable.example.com/about"},
        headers=ctx["guest_headers"],
    )
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] == second.json()["id"]

    listing = await client.get(
        f"/api/v1/projects/{ctx['project_id']}/pages", headers=ctx["owner_headers"]
    )
    assert len(listing.json()) == 1


async def test_member_can_also_register_a_page(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="pages3@example.com", code="500003", workspace_name="P3"
    )
    resp = await client.post(
        "/api/v1/pages",
        json={"project_id": ctx["project_id"], "url": "https://reviewable.example.com/team"},
        headers=ctx["owner_headers"],
    )
    assert resp.status_code == 201


async def test_guest_cannot_register_page_for_another_project(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="pages4@example.com", code="500004", workspace_name="P4"
    )
    other_workspace_id, other_owner_token = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="pages4b@example.com", code="500005", workspace_name="Other"
    )
    other_project = await client.post(
        f"/api/v1/workspaces/{other_workspace_id}/projects",
        json={"name": "Other", "target_origin": "https://other.example.com"},
        headers={"Authorization": f"Bearer {other_owner_token}"},
    )
    other_project_id = other_project.json()["id"]

    resp = await client.post(
        "/api/v1/pages",
        json={"project_id": other_project_id, "url": "https://other.example.com/"},
        headers=ctx["guest_headers"],
    )
    assert resp.status_code == 403


async def test_list_pages_requires_member(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="pages5@example.com", code="500006", workspace_name="P5"
    )
    resp = await client.get(
        f"/api/v1/projects/{ctx['project_id']}/pages", headers=ctx["guest_headers"]
    )
    assert resp.status_code == 401
