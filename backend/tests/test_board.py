"""GET /projects/{id}/comments - the dashboard Board's data source (16-Dashboard.md
§16.1, 12-API-WebSocket.md §12.3)."""

from typing import Any

import pytest
from httpx import AsyncClient

from tests.helpers import create_project_with_guest_session, create_workspace_and_get_owner_token

SAMPLE_ANCHOR = {
    "tier": 1,
    "dom_fingerprint": {
        "selector_path": "body > button:nth-of-type(1)",
        "tag": "button",
        "attributes": {"data-testid": "upgrade-cta"},
        "node_hash": "sha256:9f2a",
        "ancestor_path_hash": "sha256:aa11",
    },
    "text_fingerprint": {"normalized_text": "upgrade to pro", "text_similarity_hash": "0" * 16},
}

SAMPLE_CONTEXT = {
    "browser": "Chrome",
    "os": "macOS",
    "viewport": {"width": 1440, "height": 900},
    "device_type": "desktop",
    "url": "https://reviewable.example.com/",
}


def _comment_payload(body: str, layer: str = "client") -> dict[str, Any]:
    return {
        "body": body,
        "layer": layer,
        "anchor": SAMPLE_ANCHOR,
        "context": SAMPLE_CONTEXT,
        "screenshot_key": None,
        "capture_status": "ok",
    }


async def _register_page(client: AsyncClient, ctx: dict[str, Any], url: str) -> str:
    resp = await client.post(
        "/api/v1/pages",
        json={"project_id": ctx["project_id"], "url": url},
        headers=ctx["owner_headers"],
    )
    assert resp.status_code == 201
    page_id: str = resp.json()["id"]
    return page_id


async def test_member_sees_comments_across_every_page_in_the_project(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="board1@example.com", code="800001", workspace_name="B1"
    )
    page_a = await _register_page(client, ctx, "https://reviewable.example.com/pricing")
    page_b = await _register_page(client, ctx, "https://reviewable.example.com/about")

    await client.post(
        f"/api/v1/pages/{page_a}/comments",
        json=_comment_payload("Pricing page issue"),
        headers=ctx["owner_headers"],
    )
    await client.post(
        f"/api/v1/pages/{page_b}/comments",
        json=_comment_payload("About page issue"),
        headers=ctx["owner_headers"],
    )

    resp = await client.get(
        f"/api/v1/projects/{ctx['project_id']}/comments", headers=ctx["owner_headers"]
    )
    assert resp.status_code == 200
    bodies = {c["body"] for c in resp.json()}
    assert bodies == {"Pricing page issue", "About page issue"}


async def test_project_comments_include_both_layers_for_members(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The Board is where a member triages everything, including team-only comments -
    unlike the guest-facing GET /pages/{id}/comments, this is never layer-filtered."""
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="board2@example.com", code="800002", workspace_name="B2"
    )
    page_id = await _register_page(client, ctx, "https://reviewable.example.com/")

    await client.post(
        f"/api/v1/pages/{page_id}/comments",
        json=_comment_payload("Client-visible", layer="client"),
        headers=ctx["owner_headers"],
    )
    await client.post(
        f"/api/v1/pages/{page_id}/comments",
        json=_comment_payload("Internal only", layer="team"),
        headers=ctx["owner_headers"],
    )

    resp = await client.get(
        f"/api/v1/projects/{ctx['project_id']}/comments", headers=ctx["owner_headers"]
    )
    layers = {c["body"]: c["layer"] for c in resp.json()}
    assert layers == {"Client-visible": "client", "Internal only": "team"}


async def test_guest_cannot_list_project_comments(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="board3@example.com", code="800003", workspace_name="B3"
    )
    resp = await client.get(
        f"/api/v1/projects/{ctx['project_id']}/comments", headers=ctx["guest_headers"]
    )
    assert resp.status_code == 401


async def test_project_with_no_pages_returns_empty_list(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="board4@example.com", code="800004", workspace_name="B4"
    )
    resp = await client.get(
        f"/api/v1/projects/{ctx['project_id']}/comments", headers=ctx["owner_headers"]
    )
    assert resp.status_code == 200
    assert resp.json() == []


async def test_cross_tenant_project_comments_are_rejected(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx_a = await create_project_with_guest_session(
        client, monkeypatch, email="board5a@example.com", code="800005", workspace_name="B5A"
    )
    _, owner_token_b = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="board5b@example.com", code="800006", workspace_name="B5B"
    )

    resp = await client.get(
        f"/api/v1/projects/{ctx_a['project_id']}/comments",
        headers={"Authorization": f"Bearer {owner_token_b}"},
    )
    assert resp.status_code == 404
