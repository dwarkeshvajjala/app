import httpx
import pytest
from httpx import AsyncClient

from tests.helpers import create_project_with_guest_session, create_workspace_and_get_owner_token


async def test_member_can_request_and_use_an_upload_url(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="storage1@example.com", code="400001", workspace_name="S1"
    )

    resp = await client.post(
        "/api/v1/uploads",
        json={"project_id": ctx["project_id"], "content_type": "image/jpeg"},
        headers=ctx["owner_headers"],
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["key"].startswith(f"screenshots/{ctx['workspace_id']}/{ctx['project_id']}/")
    assert body["key"].endswith(".jpg")

    # The presigned URL is real - actually PUT a small "image" to it against local MinIO.
    async with httpx.AsyncClient() as raw_client:
        put_resp = await raw_client.put(
            body["upload_url"], content=b"fake-jpeg-bytes", headers={"Content-Type": "image/jpeg"}
        )
    assert put_resp.status_code == 200


async def test_guest_can_request_an_upload_url_for_their_project(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="storage2@example.com", code="400002", workspace_name="S2"
    )

    resp = await client.post(
        "/api/v1/uploads",
        json={"project_id": ctx["project_id"], "content_type": "image/png"},
        headers=ctx["guest_headers"],
    )
    assert resp.status_code == 201
    assert resp.json()["key"].endswith(".png")


async def test_guest_cannot_request_upload_for_another_projects(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="storage3@example.com", code="400003", workspace_name="S3"
    )

    other_workspace_id, other_owner_token = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="storage3b@example.com", code="400004", workspace_name="Other"
    )
    other_project = await client.post(
        f"/api/v1/workspaces/{other_workspace_id}/projects",
        json={"name": "Other Project", "target_origin": "https://other.example.com"},
        headers={"Authorization": f"Bearer {other_owner_token}"},
    )
    other_project_id = other_project.json()["id"]

    resp = await client.post(
        "/api/v1/uploads",
        json={"project_id": other_project_id, "content_type": "image/jpeg"},
        headers=ctx["guest_headers"],
    )
    assert resp.status_code == 403


async def test_upload_requires_auth(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/uploads", json={"project_id": "irrelevant", "content_type": "image/jpeg"}
    )
    assert resp.status_code == 401


async def test_upload_rejects_disallowed_content_type(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="storage4@example.com", code="400005", workspace_name="S4"
    )
    resp = await client.post(
        "/api/v1/uploads",
        json={"project_id": ctx["project_id"], "content_type": "application/pdf"},
        headers=ctx["owner_headers"],
    )
    assert resp.status_code == 422
