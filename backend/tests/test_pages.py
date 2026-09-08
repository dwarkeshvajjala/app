import pytest
from bson import ObjectId
from httpx import AsyncClient
from motor.motor_asyncio import AsyncIOMotorDatabase

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


# M-01: pages/router.py PATCH/DELETE previously used get_current_actor (member OR
# guest) - a guest could rename/delete pages via resolve_actor_project_access, despite
# 13-Authentication.md §13.5 having no guest row for page management at all. Both
# routes are now member-only (require_permission("project:manage")); a guest's
# X-Guest-Session header carries no Authorization bearer, so get_current_session
# rejects it with 401 before role/workspace checks ever run.
async def test_guest_cannot_update_a_page(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="pages6@example.com", code="500007", workspace_name="P6"
    )
    page = await client.post(
        "/api/v1/pages",
        json={"project_id": ctx["project_id"], "url": "https://reviewable.example.com/x"},
        headers=ctx["guest_headers"],
    )
    page_id = page.json()["id"]

    resp = await client.patch(
        f"/api/v1/pages/{page_id}", json={"title": "Hijacked"}, headers=ctx["guest_headers"]
    )
    assert resp.status_code == 401


async def test_guest_cannot_delete_a_page(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="pages7@example.com", code="500008", workspace_name="P7"
    )
    page = await client.post(
        "/api/v1/pages",
        json={"project_id": ctx["project_id"], "url": "https://reviewable.example.com/y"},
        headers=ctx["guest_headers"],
    )
    page_id = page.json()["id"]

    resp = await client.delete(f"/api/v1/pages/{page_id}", headers=ctx["guest_headers"])
    assert resp.status_code == 401


async def test_member_can_rename_a_page_but_not_across_workspaces(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="pages8@example.com", code="500009", workspace_name="P8"
    )
    page = await client.post(
        "/api/v1/pages",
        json={"project_id": ctx["project_id"], "url": "https://reviewable.example.com/z"},
        headers=ctx["owner_headers"],
    )
    page_id = page.json()["id"]

    ok = await client.patch(
        f"/api/v1/pages/{page_id}", json={"title": "Renamed"}, headers=ctx["owner_headers"]
    )
    assert ok.status_code == 200
    assert ok.json()["title"] == "Renamed"

    other_workspace_id, other_owner_token = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="pages8b@example.com", code="500010", workspace_name="Other8"
    )
    cross = await client.patch(
        f"/api/v1/pages/{page_id}",
        json={"title": "Stolen"},
        headers={"Authorization": f"Bearer {other_owner_token}"},
    )
    assert cross.status_code == 404


async def test_page_delete_blocks_when_review_history_exists(
    client: AsyncClient,
    db: AsyncIOMotorDatabase,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="pages9@example.com", code="500011", workspace_name="P9"
    )
    page = await client.post(
        "/api/v1/pages",
        json={"project_id": ctx["project_id"], "url": "https://reviewable.example.com/history"},
        headers=ctx["owner_headers"],
    )
    page_id = page.json()["id"]
    await db.revisions.insert_one(
        {
            "workspace_id": ctx["workspace_id"],
            "page_id": page_id,
            "captured_at": page.headers.get("date"),
            "is_current": True,
        }
    )

    response = await client.delete(f"/api/v1/pages/{page_id}", headers=ctx["owner_headers"])
    assert response.status_code == 409
    assert response.json()["error"]["details"]["references"]["revisions"] == 1
    assert await db.pages.count_documents({"_id": ObjectId(page_id)}) == 1


async def test_empty_page_delete_is_scoped_and_audited(
    client: AsyncClient,
    db: AsyncIOMotorDatabase,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="pages10@example.com", code="500012", workspace_name="P10"
    )
    page = await client.post(
        "/api/v1/pages",
        json={"project_id": ctx["project_id"], "url": "https://reviewable.example.com/empty"},
        headers=ctx["owner_headers"],
    )
    page_id = page.json()["id"]

    response = await client.delete(f"/api/v1/pages/{page_id}", headers=ctx["owner_headers"])
    assert response.status_code == 204
    assert await db.pages.count_documents({"_id": ObjectId(page_id)}) == 0
    event = await db.events.find_one(
        {
            "workspace_id": ctx["workspace_id"],
            "type": "page.deleted",
            "payload_json.page_id": page_id,
        }
    )
    assert event is not None and event["actor_id"]
