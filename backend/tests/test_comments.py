from typing import Any

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


def _comment_payload(body: str = "Something's off here.", layer: str = "client") -> dict[str, Any]:
    return {
        "body": body,
        "layer": layer,
        "anchor": SAMPLE_ANCHOR,
        "context": SAMPLE_CONTEXT,
        "screenshot_key": None,
        "capture_status": "ok",
    }


async def test_guest_can_create_a_comment_defaulting_to_client_layer(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="cm1@example.com", code="700001", workspace_name="C1"
    )
    page_id = await _register_page(client, ctx)

    resp = await client.post(
        f"/api/v1/pages/{page_id}/comments",
        json=_comment_payload(),
        headers=ctx["guest_headers"],
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["layer"] == "client"
    assert body["author_type"] == "guest"
    assert body["status"] == "todo"
    assert body["recovery_status"] == "ok"


async def test_guest_cannot_override_layer_to_team(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="cm2@example.com", code="700002", workspace_name="C2"
    )
    page_id = await _register_page(client, ctx)

    resp = await client.post(
        f"/api/v1/pages/{page_id}/comments",
        json=_comment_payload(layer="team"),
        headers=ctx["guest_headers"],
    )
    assert resp.status_code == 201
    # The service forces layer=client regardless of what the guest requested
    # (12-API-WebSocket.md §12.4) - this is not merely a default, it's an override.
    assert resp.json()["layer"] == "client"


async def test_member_can_create_team_only_comment(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="cm3@example.com", code="700003", workspace_name="C3"
    )
    page_id = await _register_page(client, ctx)

    resp = await client.post(
        f"/api/v1/pages/{page_id}/comments",
        json=_comment_payload(layer="team"),
        headers=ctx["owner_headers"],
    )
    assert resp.status_code == 201
    assert resp.json()["layer"] == "team"
    assert resp.json()["author_type"] == "member"


async def test_guest_never_receives_team_layer_comments_in_raw_api_response(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The exact guarantee F3/Journey #3 depends on (19-Testing-CI.md §19.3): asserted
    against the raw API response the guest session receives, not what's rendered."""
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="cm4@example.com", code="700004", workspace_name="C4"
    )
    page_id = await _register_page(client, ctx)

    await client.post(
        f"/api/v1/pages/{page_id}/comments",
        json=_comment_payload(body="Client-visible issue", layer="client"),
        headers=ctx["owner_headers"],
    )
    await client.post(
        f"/api/v1/pages/{page_id}/comments",
        json=_comment_payload(body="Internal-only note", layer="team"),
        headers=ctx["owner_headers"],
    )

    guest_listing = await client.get(
        f"/api/v1/pages/{page_id}/comments", headers=ctx["guest_headers"]
    )
    assert guest_listing.status_code == 200
    bodies = [c["body"] for c in guest_listing.json()]
    assert bodies == ["Client-visible issue"]
    assert "Internal-only note" not in bodies

    member_listing = await client.get(
        f"/api/v1/pages/{page_id}/comments", headers=ctx["owner_headers"]
    )
    member_bodies = {c["body"] for c in member_listing.json()}
    assert member_bodies == {"Client-visible issue", "Internal-only note"}


async def test_team_only_reply_is_absent_from_guests_view(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Exact scenario from 19-Testing-CI.md §19.3 Journey #3: a team member posts a
    team-only reply on an otherwise client-visible thread; the guest re-opening that
    thread must not see it - checked against the raw API, not the UI."""
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="cm5@example.com", code="700005", workspace_name="C5"
    )
    page_id = await _register_page(client, ctx)

    parent = await client.post(
        f"/api/v1/pages/{page_id}/comments",
        json=_comment_payload(body="Client-visible parent", layer="client"),
        headers=ctx["guest_headers"],
    )
    parent_id = parent.json()["id"]

    reply = await client.post(
        f"/api/v1/comments/{parent_id}/replies",
        json={"body": "Let's not mention this to the client yet", "layer": "team"},
        headers=ctx["owner_headers"],
    )
    assert reply.status_code == 201
    assert reply.json()["layer"] == "team"
    assert reply.json()["parent_id"] == parent_id

    guest_listing = await client.get(
        f"/api/v1/pages/{page_id}/comments", headers=ctx["guest_headers"]
    )
    guest_bodies = [c["body"] for c in guest_listing.json()]
    assert "Let's not mention this to the client yet" not in guest_bodies
    assert "Client-visible parent" in guest_bodies


async def test_guest_reply_defaults_to_client_and_is_visible(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="cm6@example.com", code="700006", workspace_name="C6"
    )
    page_id = await _register_page(client, ctx)

    parent = await client.post(
        f"/api/v1/pages/{page_id}/comments",
        json=_comment_payload(layer="client"),
        headers=ctx["guest_headers"],
    )
    parent_id = parent.json()["id"]

    reply = await client.post(
        f"/api/v1/comments/{parent_id}/replies",
        json={"body": "Thanks, will fix", "layer": "team"},  # guest can't set team
        headers=ctx["guest_headers"],
    )
    assert reply.status_code == 201
    assert reply.json()["layer"] == "client"


async def test_guest_cannot_reply_to_a_team_only_comment(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="cm7@example.com", code="700007", workspace_name="C7"
    )
    page_id = await _register_page(client, ctx)

    team_comment = await client.post(
        f"/api/v1/pages/{page_id}/comments",
        json=_comment_payload(layer="team"),
        headers=ctx["owner_headers"],
    )
    team_comment_id = team_comment.json()["id"]

    resp = await client.post(
        f"/api/v1/comments/{team_comment_id}/replies",
        json={"body": "trying to reply anyway"},
        headers=ctx["guest_headers"],
    )
    # Not-found, not forbidden - a crafted request must not be able to confirm that a
    # team-only comment exists on a page the guest can otherwise see.
    assert resp.status_code == 404


async def test_member_can_update_status_and_assignee(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="cm8@example.com", code="700008", workspace_name="C8"
    )
    page_id = await _register_page(client, ctx)
    created = await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(), headers=ctx["owner_headers"]
    )
    comment_id = created.json()["id"]

    updated = await client.patch(
        f"/api/v1/comments/{comment_id}",
        json={"status": "in_progress", "assignee_id": "someone"},
        headers=ctx["owner_headers"],
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "in_progress"
    assert updated.json()["assignee_id"] == "someone"
    assert updated.json()["edited_at"] is not None


async def test_guest_cannot_update_comment(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="cm9@example.com", code="700009", workspace_name="C9"
    )
    page_id = await _register_page(client, ctx)
    created = await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(), headers=ctx["guest_headers"]
    )
    comment_id = created.json()["id"]

    resp = await client.patch(
        f"/api/v1/comments/{comment_id}", json={"status": "resolved"}, headers=ctx["guest_headers"]
    )
    assert resp.status_code == 401


async def test_toggle_layer_requires_confirm_true(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="cm10@example.com", code="700010", workspace_name="C10"
    )
    page_id = await _register_page(client, ctx)
    created = await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(), headers=ctx["owner_headers"]
    )
    comment_id = created.json()["id"]

    without_confirm = await client.patch(
        f"/api/v1/comments/{comment_id}/layer",
        json={"layer": "team", "confirm": False},
        headers=ctx["owner_headers"],
    )
    assert without_confirm.status_code == 422

    with_confirm = await client.patch(
        f"/api/v1/comments/{comment_id}/layer",
        json={"layer": "team", "confirm": True},
        headers=ctx["owner_headers"],
    )
    assert with_confirm.status_code == 200
    assert with_confirm.json()["layer"] == "team"


async def test_reanchor_updates_anchor_and_recovery_status(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="cm11@example.com", code="700011", workspace_name="C11"
    )
    page_id = await _register_page(client, ctx)
    created = await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(), headers=ctx["owner_headers"]
    )
    comment_id = created.json()["id"]

    new_anchor = {
        **SAMPLE_ANCHOR,
        "text_fingerprint": {"normalized_text": "a new label", "text_similarity_hash": "0" * 16},
    }
    resp = await client.patch(
        f"/api/v1/comments/{comment_id}/reanchor",
        json={"anchor": new_anchor},
        headers=ctx["owner_headers"],
    )
    assert resp.status_code == 200
    assert resp.json()["anchor"]["text_fingerprint"]["normalized_text"] == "a new label"
    assert resp.json()["recovery_status"] == "ok"


async def test_comment_endpoints_require_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/pages/000000000000000000000000/comments")
    assert resp.status_code == 401


async def test_cross_tenant_comment_update_is_rejected(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx_a = await create_project_with_guest_session(
        client, monkeypatch, email="cm12a@example.com", code="700012", workspace_name="C12A"
    )
    page_id = await _register_page(client, ctx_a)
    created = await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(), headers=ctx_a["owner_headers"]
    )
    comment_id = created.json()["id"]

    ctx_b = await create_project_with_guest_session(
        client, monkeypatch, email="cm12b@example.com", code="700013", workspace_name="C12B"
    )

    resp = await client.patch(
        f"/api/v1/comments/{comment_id}",
        json={"status": "resolved"},
        headers=ctx_b["owner_headers"],
    )
    assert resp.status_code == 404
