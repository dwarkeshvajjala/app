"""Comment deletion and editing: multi-message threads (multiple replies) plus deleting
a single comment or a whole thread, and correcting a comment's own body - the widget's
own-author-only surface (DELETE /comments/{id}, PATCH /comments/{id}/body) plus the
dashboard's member-moderation surface (DELETE /comments/{id}/moderate), which grants
any member the workspace-scoped "moderate anything" trust level PATCH /comments/{id}
already has."""

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


async def _register_page(client: AsyncClient, ctx: dict[str, Any]) -> str:
    resp = await client.post(
        "/api/v1/pages",
        json={"project_id": ctx["project_id"], "url": "https://reviewable.example.com/"},
        headers=ctx["guest_headers"],
    )
    assert resp.status_code == 201
    page_id: str = resp.json()["id"]
    return page_id


def _comment_payload(body: str = "hi") -> dict[str, Any]:
    return {
        "body": body,
        "layer": "client",
        "anchor": SAMPLE_ANCHOR,
        "context": SAMPLE_CONTEXT,
        "screenshot_key": None,
        "capture_status": "ok",
    }


async def test_guest_can_delete_their_own_comment(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="del1@example.com", code="810001", workspace_name="D1"
    )
    page_id = await _register_page(client, ctx)
    created = await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(), headers=ctx["guest_headers"]
    )
    comment_id = created.json()["id"]

    resp = await client.delete(f"/api/v1/comments/{comment_id}", headers=ctx["guest_headers"])
    assert resp.status_code == 204

    listing = await client.get(f"/api/v1/pages/{page_id}/comments", headers=ctx["guest_headers"])
    assert listing.json() == []


async def test_guest_cannot_delete_another_guests_comment(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="del2@example.com", code="810002", workspace_name="D2"
    )
    page_id = await _register_page(client, ctx)
    created = await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(), headers=ctx["guest_headers"]
    )
    comment_id = created.json()["id"]

    # A second, independent guest session on the same share link/project.
    second_guest = await client.post(
        "/api/v1/guest-sessions",
        json={"share_token": ctx["share_token"], "display_name": "Someone Else"},
        headers={"User-Agent": "pytest", "X-Forwarded-For": "203.0.113.9"},
    )
    assert second_guest.status_code == 201
    other_guest_headers = {"X-Guest-Session": second_guest.json()["guest_session_token"]}

    resp = await client.delete(f"/api/v1/comments/{comment_id}", headers=other_guest_headers)
    assert resp.status_code == 403

    # Still there, untouched.
    listing = await client.get(f"/api/v1/pages/{page_id}/comments", headers=ctx["guest_headers"])
    assert len(listing.json()) == 1


async def test_member_cannot_delete_a_guest_authored_comment(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Ownership is strict authorship, not role - an OWNER doesn't get a moderation
    override through this endpoint (that's PATCH /comments/{id}'s territory, unaffected
    by this feature)."""
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="del3@example.com", code="810003", workspace_name="D3"
    )
    page_id = await _register_page(client, ctx)
    created = await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(), headers=ctx["guest_headers"]
    )
    comment_id = created.json()["id"]

    resp = await client.delete(f"/api/v1/comments/{comment_id}", headers=ctx["owner_headers"])
    assert resp.status_code == 403


async def test_member_can_delete_their_own_comment(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="del4@example.com", code="810004", workspace_name="D4"
    )
    page_id = await _register_page(client, ctx)
    created = await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(), headers=ctx["owner_headers"]
    )
    comment_id = created.json()["id"]

    resp = await client.delete(f"/api/v1/comments/{comment_id}", headers=ctx["owner_headers"])
    assert resp.status_code == 204


async def test_deleting_a_reply_leaves_the_thread_intact(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="del5@example.com", code="810005", workspace_name="D5"
    )
    page_id = await _register_page(client, ctx)
    parent = await client.post(
        f"/api/v1/pages/{page_id}/comments",
        json=_comment_payload("original"),
        headers=ctx["guest_headers"],
    )
    parent_id = parent.json()["id"]
    reply = await client.post(
        f"/api/v1/comments/{parent_id}/replies",
        json={"body": "a reply", "layer": "client"},
        headers=ctx["guest_headers"],
    )
    reply_id = reply.json()["id"]

    resp = await client.delete(f"/api/v1/comments/{reply_id}", headers=ctx["guest_headers"])
    assert resp.status_code == 204

    listing = await client.get(f"/api/v1/pages/{page_id}/comments", headers=ctx["guest_headers"])
    bodies = {c["body"] for c in listing.json()}
    assert bodies == {"original"}


async def test_delete_thread_cascades_to_every_reply_regardless_of_who_wrote_them(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="del6@example.com", code="810006", workspace_name="D6"
    )
    page_id = await _register_page(client, ctx)
    parent = await client.post(
        f"/api/v1/pages/{page_id}/comments",
        json=_comment_payload("original"),
        headers=ctx["guest_headers"],
    )
    parent_id = parent.json()["id"]
    # A member reply on the guest's thread.
    await client.post(
        f"/api/v1/comments/{parent_id}/replies",
        json={"body": "member reply", "layer": "client"},
        headers=ctx["owner_headers"],
    )

    # Only the thread's own author (the guest who started it) can delete the whole
    # thing - a member's reply on it doesn't grant them that.
    forbidden = await client.delete(
        f"/api/v1/comments/{parent_id}/thread", headers=ctx["owner_headers"]
    )
    assert forbidden.status_code == 403

    resp = await client.delete(f"/api/v1/comments/{parent_id}/thread", headers=ctx["guest_headers"])
    assert resp.status_code == 204

    listing = await client.get(f"/api/v1/pages/{page_id}/comments", headers=ctx["guest_headers"])
    assert listing.json() == []


async def test_delete_thread_rejects_a_reply_id(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="del7@example.com", code="810007", workspace_name="D7"
    )
    page_id = await _register_page(client, ctx)
    parent = await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(), headers=ctx["guest_headers"]
    )
    reply = await client.post(
        f"/api/v1/comments/{parent.json()['id']}/replies",
        json={"body": "a reply", "layer": "client"},
        headers=ctx["guest_headers"],
    )
    reply_id = reply.json()["id"]

    resp = await client.delete(f"/api/v1/comments/{reply_id}/thread", headers=ctx["guest_headers"])
    assert resp.status_code == 422


async def test_cannot_reply_to_a_deleted_comment(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="del8@example.com", code="810008", workspace_name="D8"
    )
    page_id = await _register_page(client, ctx)
    created = await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(), headers=ctx["guest_headers"]
    )
    comment_id = created.json()["id"]
    await client.delete(f"/api/v1/comments/{comment_id}", headers=ctx["guest_headers"])

    resp = await client.post(
        f"/api/v1/comments/{comment_id}/replies",
        json={"body": "too late", "layer": "client"},
        headers=ctx["guest_headers"],
    )
    assert resp.status_code == 404


async def test_deleting_an_already_deleted_comment_is_not_found(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="del9@example.com", code="810009", workspace_name="D9"
    )
    page_id = await _register_page(client, ctx)
    created = await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(), headers=ctx["guest_headers"]
    )
    comment_id = created.json()["id"]
    first = await client.delete(f"/api/v1/comments/{comment_id}", headers=ctx["guest_headers"])
    assert first.status_code == 204

    second = await client.delete(f"/api/v1/comments/{comment_id}", headers=ctx["guest_headers"])
    assert second.status_code == 404


async def test_guest_can_edit_their_own_comment_body(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="edit1@example.com", code="810010", workspace_name="E1"
    )
    page_id = await _register_page(client, ctx)
    created = await client.post(
        f"/api/v1/pages/{page_id}/comments",
        json=_comment_payload("hi"),
        headers=ctx["guest_headers"],
    )
    comment_id = created.json()["id"]

    resp = await client.patch(
        f"/api/v1/comments/{comment_id}/body",
        json={"body": "hi there, edited"},
        headers=ctx["guest_headers"],
    )
    assert resp.status_code == 200
    assert resp.json()["body"] == "hi there, edited"
    assert resp.json()["edited_at"] is not None


async def test_guest_cannot_edit_another_guests_comment(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="edit2@example.com", code="810011", workspace_name="E2"
    )
    page_id = await _register_page(client, ctx)
    created = await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(), headers=ctx["guest_headers"]
    )
    comment_id = created.json()["id"]

    second_guest = await client.post(
        "/api/v1/guest-sessions",
        json={"share_token": ctx["share_token"], "display_name": "Someone Else"},
        headers={"User-Agent": "pytest", "X-Forwarded-For": "203.0.113.10"},
    )
    other_guest_headers = {"X-Guest-Session": second_guest.json()["guest_session_token"]}

    resp = await client.patch(
        f"/api/v1/comments/{comment_id}/body",
        json={"body": "hijacked"},
        headers=other_guest_headers,
    )
    assert resp.status_code == 403


async def test_member_cannot_edit_a_guest_authored_comment_via_the_own_author_route(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="edit3@example.com", code="810012", workspace_name="E3"
    )
    page_id = await _register_page(client, ctx)
    created = await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(), headers=ctx["guest_headers"]
    )
    comment_id = created.json()["id"]

    resp = await client.patch(
        f"/api/v1/comments/{comment_id}/body",
        json={"body": "moderated"},
        headers=ctx["owner_headers"],
    )
    assert resp.status_code == 403


async def test_cannot_edit_a_deleted_comment(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="edit4@example.com", code="810013", workspace_name="E4"
    )
    page_id = await _register_page(client, ctx)
    created = await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(), headers=ctx["guest_headers"]
    )
    comment_id = created.json()["id"]
    await client.delete(f"/api/v1/comments/{comment_id}", headers=ctx["guest_headers"])

    resp = await client.patch(
        f"/api/v1/comments/{comment_id}/body",
        json={"body": "too late"},
        headers=ctx["guest_headers"],
    )
    assert resp.status_code == 404


async def test_member_can_moderate_delete_a_guest_authored_comment(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The dashboard's moderation surface (DELETE /comments/{id}/moderate) grants any
    member the same "moderate anything in this workspace" trust level PATCH
    /comments/{id} already has - unlike the own-author-only DELETE /comments/{id}
    used by the widget's guest self-service delete."""
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="mod1@example.com", code="810014", workspace_name="M1"
    )
    page_id = await _register_page(client, ctx)
    created = await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(), headers=ctx["guest_headers"]
    )
    comment_id = created.json()["id"]

    resp = await client.delete(
        f"/api/v1/comments/{comment_id}/moderate", headers=ctx["owner_headers"]
    )
    assert resp.status_code == 204

    listing = await client.get(f"/api/v1/pages/{page_id}/comments", headers=ctx["guest_headers"])
    assert listing.json() == []


async def test_moderate_delete_thread_cascades_to_every_reply(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="mod2@example.com", code="810015", workspace_name="M2"
    )
    page_id = await _register_page(client, ctx)
    parent = await client.post(
        f"/api/v1/pages/{page_id}/comments",
        json=_comment_payload("original"),
        headers=ctx["guest_headers"],
    )
    parent_id = parent.json()["id"]
    await client.post(
        f"/api/v1/comments/{parent_id}/replies",
        json={"body": "a reply", "layer": "client"},
        headers=ctx["guest_headers"],
    )

    resp = await client.delete(
        f"/api/v1/comments/{parent_id}/thread/moderate", headers=ctx["owner_headers"]
    )
    assert resp.status_code == 204

    listing = await client.get(f"/api/v1/pages/{page_id}/comments", headers=ctx["guest_headers"])
    assert listing.json() == []


async def test_moderate_delete_rejects_a_comment_from_another_workspace(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="mod3@example.com", code="810016", workspace_name="M3"
    )
    page_id = await _register_page(client, ctx)
    created = await client.post(
        f"/api/v1/pages/{page_id}/comments", json=_comment_payload(), headers=ctx["guest_headers"]
    )
    comment_id = created.json()["id"]

    _, other_owner_token = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="mod3b@example.com", code="810017", workspace_name="M3b"
    )
    other_headers = {"Authorization": f"Bearer {other_owner_token}"}

    resp = await client.delete(f"/api/v1/comments/{comment_id}/moderate", headers=other_headers)
    assert resp.status_code == 404

    listing = await client.get(f"/api/v1/pages/{page_id}/comments", headers=ctx["guest_headers"])
    assert len(listing.json()) == 1
