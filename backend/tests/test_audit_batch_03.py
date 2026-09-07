"""Test Audit Batch 03 (M-04/M-06/M-08) implementation over the real HTTP surface.

Follows the same client-fixture / helpers.create_project_with_guest_session pattern
as test_comments.py, test_projects.py, etc. - no direct service-layer calls, no
fixtures beyond what conftest.py already provides.

Covers:
- M-04: project review settings enforcement (capture_device_details,
  reviewer_can_resolve, show_board_to_client)
- M-06: reply/mention notifications fire without erroring, guarded by membership
- M-08: client_request_id idempotency for comments and replies
"""

from typing import Any
from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.helpers import create_project_with_guest_session

SAMPLE_ANCHOR = {
    "tier": 1,
    "dom_fingerprint": {
        "selector_path": "body > button:nth-of-type(1)",
        "tag": "button",
        "attributes": {"class": "btn btn-primary", "data-testid": "upgrade-cta"},
        "node_hash": "sha256:9f2a",
        "ancestor_path_hash": "sha256:aa11",
    },
    "text_fingerprint": {
        "normalized_text": "upgrade to pro",
        "text_similarity_hash": "0" * 16,
    },
}

SAMPLE_CONTEXT = {
    "browser": "Chrome",
    "os": "macOS",
    "viewport": {"width": 1440, "height": 900},
    "device_type": "desktop",
    "url": "https://reviewable.example.com/",
}


async def _register_page(client: AsyncClient, ctx: dict[str, Any]) -> str:
    resp = await client.post(
        "/api/v1/pages",
        json={"project_id": ctx["project_id"], "url": "https://reviewable.example.com/"},
        headers=ctx["guest_headers"],
    )
    assert resp.status_code == 201
    page_id: str = resp.json()["id"]
    return page_id


def _comment_payload(
    body: str = "Something's off here.",
    layer: str = "client",
    client_request_id: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "body": body,
        "layer": layer,
        "anchor": SAMPLE_ANCHOR,
        "context": SAMPLE_CONTEXT,
        "screenshot_key": None,
        "capture_status": "ok",
    }
    if client_request_id is not None:
        payload["client_request_id"] = client_request_id
    return payload


async def _patch_settings(client: AsyncClient, ctx: dict[str, Any], **settings: bool) -> None:
    resp = await client.patch(
        f"/api/v1/projects/{ctx['project_id']}/settings",
        json=settings,
        headers=ctx["owner_headers"],
    )
    assert resp.status_code == 200, resp.text


# ---------------------------------------------------------------------------
# M-04: capture_device_details gates context redaction
# ---------------------------------------------------------------------------


async def test_capture_device_details_off_redacts_context(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="ab3-1@example.com", code="710001", workspace_name="AB3-1"
    )
    page_id = await _register_page(client, ctx)
    # capture_device_details defaults to False - no explicit PATCH needed.
    resp = await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(), headers=ctx["guest_headers"]
    )
    assert resp.status_code == 201
    context = resp.json()["context"]
    assert context["browser"] == ""
    assert context["os"] == ""
    assert context["device_type"] == ""
    assert context["viewport"] == {}
    # url survives redaction - it identifies the page, not a device fingerprint.
    assert context["url"] == SAMPLE_CONTEXT["url"]


async def test_capture_device_details_on_preserves_context(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="ab3-2@example.com", code="710002", workspace_name="AB3-2"
    )
    await _patch_settings(client, ctx, capture_device_details=True)
    page_id = await _register_page(client, ctx)

    resp = await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(), headers=ctx["guest_headers"]
    )
    assert resp.status_code == 201
    context = resp.json()["context"]
    assert context["browser"] == "Chrome"
    assert context["os"] == "macOS"
    assert context["device_type"] == "desktop"
    assert context["viewport"] == {"width": 1440, "height": 900}


# ---------------------------------------------------------------------------
# M-04: show_board_to_client gates the guest board endpoint
# ---------------------------------------------------------------------------


async def test_guest_board_hidden_by_default(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="ab3-3@example.com", code="710003", workspace_name="AB3-3"
    )
    resp = await client.get(
        f"/api/v1/projects/{ctx['project_id']}/guest-board", headers=ctx["guest_headers"]
    )
    assert resp.status_code == 403


async def test_guest_board_visible_when_enabled(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="ab3-4@example.com", code="710004", workspace_name="AB3-4"
    )
    await _patch_settings(client, ctx, show_board_to_client=True)
    page_id = await _register_page(client, ctx)

    # Client-layer comment should show up on the guest board.
    created = await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(layer="client"),
        headers=ctx["guest_headers"],
    )
    assert created.status_code == 201

    board = await client.get(
        f"/api/v1/projects/{ctx['project_id']}/guest-board", headers=ctx["guest_headers"]
    )
    assert board.status_code == 200
    body = board.json()
    assert body["project_id"] == ctx["project_id"]
    assert len(body["items"]) == 1
    item = body["items"][0]
    assert item["body"] == "Something's off here."
    # Client-safe DTO: no assignee_id/waiting_on/tags — just names.
    assert "assignee_names" in item
    assert "waiting_on_ids" not in item


async def test_guest_board_excludes_team_only_comments(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="ab3-5@example.com", code="710005", workspace_name="AB3-5"
    )
    await _patch_settings(client, ctx, show_board_to_client=True)
    page_id = await _register_page(client, ctx)

    # A member-authored team-only comment must never appear on the client board.
    await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(layer="team"),
        headers=ctx["owner_headers"],
    )

    board = await client.get(
        f"/api/v1/projects/{ctx['project_id']}/guest-board", headers=ctx["guest_headers"]
    )
    assert board.status_code == 200
    assert board.json()["items"] == []


# ---------------------------------------------------------------------------
# M-04: reviewer_can_resolve gates guest self-resolve
# ---------------------------------------------------------------------------


async def test_guest_cannot_resolve_own_comment_by_default(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="ab3-6@example.com", code="710006", workspace_name="AB3-6"
    )
    page_id = await _register_page(client, ctx)
    created = await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(), headers=ctx["guest_headers"]
    )
    comment_id = created.json()["id"]

    resp = await client.patch(
        f"/api/v1/comments/{comment_id}/resolve", headers=ctx["guest_headers"]
    )
    assert resp.status_code == 403


async def test_guest_can_resolve_own_comment_when_enabled(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="ab3-7@example.com", code="710007", workspace_name="AB3-7"
    )
    await _patch_settings(client, ctx, reviewer_can_resolve=True)
    page_id = await _register_page(client, ctx)
    created = await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(), headers=ctx["guest_headers"]
    )
    comment_id = created.json()["id"]

    resp = await client.patch(
        f"/api/v1/comments/{comment_id}/resolve", headers=ctx["guest_headers"]
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "resolved"

    # Idempotent: resolving an already-resolved comment is a no-op, not an error.
    again = await client.patch(
        f"/api/v1/comments/{comment_id}/resolve", headers=ctx["guest_headers"]
    )
    assert again.status_code == 200
    assert again.json()["status"] == "resolved"


async def test_guest_cannot_resolve_someone_elses_comment(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="ab3-8@example.com", code="710008", workspace_name="AB3-8"
    )
    await _patch_settings(client, ctx, reviewer_can_resolve=True)
    page_id = await _register_page(client, ctx)
    # Member-authored comment - a guest must never resolve someone else's comment,
    # even with reviewer_can_resolve on.
    created = await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(layer="team"),
        headers=ctx["owner_headers"],
    )
    comment_id = created.json()["id"]

    resp = await client.patch(
        f"/api/v1/comments/{comment_id}/resolve", headers=ctx["guest_headers"]
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# M-08: client_request_id idempotency
# ---------------------------------------------------------------------------


async def test_duplicate_comment_request_id_returns_same_comment(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="ab3-9@example.com", code="710009", workspace_name="AB3-9"
    )
    page_id = await _register_page(client, ctx)
    request_id = str(uuid4())

    first = await client.post(
        f"/api/v1/pages/{page_id}/comments",
        json=_comment_payload(body="Original", client_request_id=request_id),
        headers=ctx["guest_headers"],
    )
    assert first.status_code == 201

    second = await client.post(
        f"/api/v1/pages/{page_id}/comments",
        json=_comment_payload(body="Retried with different body", client_request_id=request_id),
        headers=ctx["guest_headers"],
    )
    assert second.status_code == 201
    assert second.json()["id"] == first.json()["id"]
    assert second.json()["body"] == "Original"


async def test_duplicate_reply_request_id_returns_same_reply(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="ab3-10@example.com", code="710010", workspace_name="AB3-10"
    )
    page_id = await _register_page(client, ctx)
    parent = await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(), headers=ctx["guest_headers"]
    )
    parent_id = parent.json()["id"]
    request_id = str(uuid4())

    first = await client.post(
        f"/api/v1/comments/{parent_id}/replies",
        json={"body": "First try", "client_request_id": request_id},
        headers=ctx["guest_headers"],
    )
    assert first.status_code == 201

    second = await client.post(
        f"/api/v1/comments/{parent_id}/replies",
        json={"body": "Retried body", "client_request_id": request_id},
        headers=ctx["guest_headers"],
    )
    assert second.status_code == 201
    assert second.json()["id"] == first.json()["id"]
    assert second.json()["body"] == "First try"


# ---------------------------------------------------------------------------
# M-06: reply/mention notifications don't error and reach real recipients
# ---------------------------------------------------------------------------


async def test_reply_to_member_comment_does_not_error(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Smoke test: replying triggers notify_comment_reply for the parent's author;
    this must not raise even though the guest replying has no notification inbox."""
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="ab3-11@example.com", code="710011", workspace_name="AB3-11"
    )
    page_id = await _register_page(client, ctx)
    parent = await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(layer="client"),
        headers=ctx["owner_headers"],
    )
    parent_id = parent.json()["id"]

    resp = await client.post(
        f"/api/v1/comments/{parent_id}/replies",
        json={"body": "Guest reply"},
        headers=ctx["guest_headers"],
    )
    assert resp.status_code == 201


async def test_mention_with_unknown_member_id_is_silently_ignored(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """mentioned_user_ids is client-supplied and re-validated against workspace
    membership - a foreign/unknown id must not error the whole reply."""
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="ab3-12@example.com", code="710012", workspace_name="AB3-12"
    )
    page_id = await _register_page(client, ctx)
    parent = await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(layer="team"),
        headers=ctx["owner_headers"],
    )
    parent_id = parent.json()["id"]

    resp = await client.post(
        f"/api/v1/comments/{parent_id}/replies",
        json={"body": "@someone", "mentioned_user_ids": ["000000000000000000000000"]},
        headers=ctx["owner_headers"],
    )
    assert resp.status_code == 201


# ---------------------------------------------------------------------------
# Settings persistence: partial updates leave other fields untouched
# ---------------------------------------------------------------------------


async def test_partial_settings_update_preserves_other_fields(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="ab3-13@example.com", code="710013", workspace_name="AB3-13"
    )
    await _patch_settings(client, ctx, capture_device_details=True)
    resp = await client.patch(
        f"/api/v1/projects/{ctx['project_id']}/settings",
        json={"reviewer_can_resolve": True},
        headers=ctx["owner_headers"],
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["capture_device_details"] is True  # untouched by the second PATCH
    assert body["reviewer_can_resolve"] is True
    assert body["show_board_to_client"] is False
    assert body["client_digest_enabled"] is False
    assert body["reanchor_on_deploy"] is False


async def test_get_project_returns_all_five_settings_with_defaults(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A freshly created project (no settings PATCH at all) must still round-trip
    all five flags as False, not omit them or 500."""
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="ab3-14@example.com", code="710014", workspace_name="AB3-14"
    )
    resp = await client.get(f"/api/v1/projects/{ctx['project_id']}", headers=ctx["owner_headers"])
    assert resp.status_code == 200
    settings = resp.json()["settings"]
    for field in (
        "capture_device_details",
        "reanchor_on_deploy",
        "reviewer_can_resolve",
        "show_board_to_client",
        "client_digest_enabled",
    ):
        assert settings[field] is False
