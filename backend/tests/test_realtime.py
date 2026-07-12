"""Milestone 7 - Realtime Layer (12-API-WebSocket.md §12.6).

httpx's ASGITransport (used by the `client` fixture everywhere else in this suite)
doesn't speak the WebSocket protocol, so the actual `/ws` endpoint isn't exercised here -
that's proven end-to-end against the real running dev server (see the Playwright-style
verification script used for this milestone, not part of the pytest suite). What's
covered here: the connection manager's local fan-out/cleanup, the publish/subscribe
envelope contract against real Redis, presence bookkeeping, the member-vs-guest token
disambiguation `/ws` relies on, and - most importantly - that the comment/snapshot
services actually publish the right event to the right channel(s) when state changes,
which is the part that would silently rot if a future edit touched those services
without also touching this file.
"""

import asyncio
import json
from typing import Any

import pytest
import redis.asyncio as redis
from httpx import AsyncClient

from app.core.config import get_settings
from app.core.security import InvalidTokenError, decode_guest_token
from app.core.session import GuestSession, Session
from app.modules.realtime.manager import ConnectionManager
from app.modules.realtime.presence import list_present, mark_absent, mark_present
from app.modules.realtime.pubsub import publish
from app.modules.realtime.router import _resolve_actor
from tests.helpers import create_project_with_guest_session


class _FakeWebSocket:
    def __init__(self) -> None:
        self.accepted = False
        self.sent: list[dict[str, Any]] = []
        self.fail_send = False

    async def accept(self) -> None:
        self.accepted = True

    async def send_json(self, message: dict[str, Any]) -> None:
        if self.fail_send:
            raise RuntimeError("connection closed")
        self.sent.append(message)


async def test_connection_manager_broadcasts_to_all_sockets_on_a_channel() -> None:
    manager = ConnectionManager()
    ws_a, ws_b = _FakeWebSocket(), _FakeWebSocket()
    await manager.connect("workspace:w1:all", ws_a)  # type: ignore[arg-type]
    await manager.connect("workspace:w1:all", ws_b)  # type: ignore[arg-type]

    await manager.broadcast_local("workspace:w1:all", {"type": "comment.created"})

    assert ws_a.sent == [{"type": "comment.created"}]
    assert ws_b.sent == [{"type": "comment.created"}]


async def test_connection_manager_does_not_leak_across_channels() -> None:
    manager = ConnectionManager()
    ws_a = _FakeWebSocket()
    await manager.connect("project:p1:client", ws_a)  # type: ignore[arg-type]

    await manager.broadcast_local("workspace:w1:all", {"type": "comment.created"})

    assert ws_a.sent == []


async def test_connection_manager_drops_dead_sockets_on_broadcast() -> None:
    manager = ConnectionManager()
    ws_dead, ws_alive = _FakeWebSocket(), _FakeWebSocket()
    ws_dead.fail_send = True
    await manager.connect("workspace:w1:all", ws_dead)  # type: ignore[arg-type]
    await manager.connect("workspace:w1:all", ws_alive)  # type: ignore[arg-type]

    await manager.broadcast_local("workspace:w1:all", {"type": "ping"})

    assert ws_alive.sent == [{"type": "ping"}]
    # The dead socket was pruned from the registry, not just skipped this once.
    await manager.broadcast_local("workspace:w1:all", {"type": "ping-2"})
    assert ws_alive.sent == [{"type": "ping"}, {"type": "ping-2"}]


async def test_publish_envelope_matches_spec_shape() -> None:
    settings = get_settings()
    redis_client: redis.Redis = redis.from_url(settings.redis_url)  # type: ignore[no-untyped-call]
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("ws:workspace:w-test:all")
    await pubsub.get_message(timeout=1)  # subscribe confirmation

    await publish(
        "workspace:w-test:all",
        event_type="comment.created",
        workspace_id="w-test",
        payload={"comment_id": "c1"},
    )

    message = None
    for _ in range(10):
        message = await pubsub.get_message(timeout=1)
        if message and message["type"] == "message":
            break
    assert message is not None
    envelope = json.loads(message["data"])
    assert envelope["type"] == "comment.created"
    assert envelope["workspace_id"] == "w-test"
    assert envelope["payload"] == {"comment_id": "c1"}
    assert "ts" in envelope

    await pubsub.unsubscribe("ws:workspace:w-test:all")
    await pubsub.aclose()  # type: ignore[no-untyped-call]
    await redis_client.aclose()


async def test_presence_round_trip() -> None:
    await mark_present("page-1", "session-a", "Jamie")
    await mark_present("page-1", "session-b", "Riley")
    assert sorted(await list_present("page-1")) == ["Jamie", "Riley"]

    await mark_absent("page-1", "session-a")
    assert await list_present("page-1") == ["Riley"]

    await mark_absent("page-1", "session-b")
    assert await list_present("page-1") == []


async def test_resolve_actor_distinguishes_member_and_guest_tokens(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="rt1@example.com", code="700001", workspace_name="RT1"
    )

    member_actor = _resolve_actor(ctx["owner_token"])
    assert isinstance(member_actor, Session)
    assert member_actor.workspace_id == ctx["workspace_id"]

    guest_actor = _resolve_actor(ctx["guest_token"])
    assert isinstance(guest_actor, GuestSession)
    claims = decode_guest_token(ctx["guest_token"])
    assert guest_actor.share_link_id == claims.share_link_id

    with pytest.raises(InvalidTokenError):
        _resolve_actor("not-a-real-token")


async def _drain_one(pubsub: Any, timeout: float = 2.0) -> dict[str, Any] | None:
    loop = asyncio.get_event_loop()
    deadline = loop.time() + timeout
    while loop.time() < deadline:
        message = await pubsub.get_message(timeout=0.2)
        if message and message["type"] == "message":
            return dict(message)
    return None


async def test_client_layer_comment_reaches_both_channels_team_layer_reaches_only_workspace(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="rt2@example.com", code="700002", workspace_name="RT2"
    )
    page_resp = await client.post(
        "/api/v1/pages",
        json={"project_id": ctx["project_id"], "url": "https://reviewable.example.com/"},
        headers=ctx["owner_headers"],
    )
    page_id = page_resp.json()["id"]

    settings = get_settings()
    redis_client: redis.Redis = redis.from_url(settings.redis_url)  # type: ignore[no-untyped-call]
    pubsub = redis_client.pubsub()
    workspace_channel = f"ws:workspace:{ctx['workspace_id']}:all"
    project_channel = f"ws:project:{ctx['project_id']}:client"
    await pubsub.subscribe(workspace_channel, project_channel)
    await pubsub.get_message(timeout=1)
    await pubsub.get_message(timeout=1)

    anchor = {
        "tier": 1,
        "dom_fingerprint": {
            "selector_path": "body > button",
            "tag": "button",
            "attributes": {},
            "node_hash": "sha256:a",
            "ancestor_path_hash": "sha256:b",
        },
        "text_fingerprint": {"normalized_text": "hi", "text_similarity_hash": "0" * 16},
    }
    context = {
        "browser": "Chrome",
        "os": "macOS",
        "viewport": {"width": 1440, "height": 900},
        "device_type": "desktop",
        "url": "https://reviewable.example.com/",
    }

    # A team-only comment should reach the workspace channel but never the guest channel.
    await client.post(
        f"/api/v1/pages/{page_id}/comments",
        json={
            "body": "Team only note",
            "layer": "team",
            "anchor": anchor,
            "context": context,
            "screenshot_key": None,
            "capture_status": "ok",
        },
        headers=ctx["owner_headers"],
    )
    workspace_msg = await _drain_one(pubsub)
    assert workspace_msg is not None
    workspace_envelope = json.loads(workspace_msg["data"])
    assert workspace_envelope["type"] == "comment.created"
    assert workspace_envelope["payload"]["layer"] == "team"
    assert workspace_envelope["payload"]["project_id"] == ctx["project_id"]

    project_msg = await _drain_one(pubsub, timeout=1.0)
    assert project_msg is None  # never fanned out to the guest channel

    # A client-visible comment should reach both.
    await client.post(
        f"/api/v1/pages/{page_id}/comments",
        json={
            "body": "Client visible note",
            "layer": "client",
            "anchor": anchor,
            "context": context,
            "screenshot_key": None,
            "capture_status": "ok",
        },
        headers=ctx["owner_headers"],
    )
    seen_channels = set()
    for _ in range(2):
        msg = await _drain_one(pubsub)
        assert msg is not None
        seen_channels.add(msg["channel"].decode())
    assert seen_channels == {workspace_channel, project_channel}

    await pubsub.unsubscribe(workspace_channel, project_channel)
    await pubsub.aclose()  # type: ignore[no-untyped-call]
    await redis_client.aclose()


async def test_status_update_publishes_comment_updated(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="rt3@example.com", code="700003", workspace_name="RT3"
    )
    page_resp = await client.post(
        "/api/v1/pages",
        json={"project_id": ctx["project_id"], "url": "https://reviewable.example.com/"},
        headers=ctx["owner_headers"],
    )
    page_id = page_resp.json()["id"]

    anchor = {
        "tier": 1,
        "dom_fingerprint": {
            "selector_path": "body > button",
            "tag": "button",
            "attributes": {},
            "node_hash": "sha256:a",
            "ancestor_path_hash": "sha256:b",
        },
        "text_fingerprint": {"normalized_text": "hi", "text_similarity_hash": "0" * 16},
    }
    context = {
        "browser": "Chrome",
        "os": "macOS",
        "viewport": {"width": 1440, "height": 900},
        "device_type": "desktop",
        "url": "https://reviewable.example.com/",
    }
    created = await client.post(
        f"/api/v1/pages/{page_id}/comments",
        json={
            "body": "Fix this",
            "layer": "client",
            "anchor": anchor,
            "context": context,
            "screenshot_key": None,
            "capture_status": "ok",
        },
        headers=ctx["owner_headers"],
    )
    comment_id = created.json()["id"]

    settings = get_settings()
    redis_client: redis.Redis = redis.from_url(settings.redis_url)  # type: ignore[no-untyped-call]
    pubsub = redis_client.pubsub()
    workspace_channel = f"ws:workspace:{ctx['workspace_id']}:all"
    await pubsub.subscribe(workspace_channel)
    await pubsub.get_message(timeout=1)

    await client.patch(
        f"/api/v1/comments/{comment_id}",
        json={"status": "resolved"},
        headers=ctx["owner_headers"],
    )

    msg = await _drain_one(pubsub)
    assert msg is not None
    envelope = json.loads(msg["data"])
    assert envelope["type"] == "comment.updated"
    assert envelope["payload"]["status"] == "resolved"
    assert envelope["payload"]["id"] == comment_id

    await pubsub.unsubscribe(workspace_channel)
    await pubsub.aclose()  # type: ignore[no-untyped-call]
    await redis_client.aclose()


async def test_new_revision_publishes_revision_created(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="rt4@example.com", code="700004", workspace_name="RT4"
    )
    page_resp = await client.post(
        "/api/v1/pages",
        json={"project_id": ctx["project_id"], "url": "https://reviewable.example.com/"},
        headers=ctx["owner_headers"],
    )
    page_id = page_resp.json()["id"]

    settings = get_settings()
    redis_client: redis.Redis = redis.from_url(settings.redis_url)  # type: ignore[no-untyped-call]
    pubsub = redis_client.pubsub()
    workspace_channel = f"ws:workspace:{ctx['workspace_id']}:all"
    await pubsub.subscribe(workspace_channel)
    await pubsub.get_message(timeout=1)

    await client.post(
        f"/api/v1/pages/{page_id}/snapshots",
        json={
            "viewport": {"width": 1440, "height": 900},
            "node_tree": {"node_id": "n_0", "tag": "html", "children": []},
            "nodes_index": {},
            "full_page_hash": "sha256:page-v1",
        },
        headers=ctx["owner_headers"],
    )

    msg = await _drain_one(pubsub)
    assert msg is not None
    envelope = json.loads(msg["data"])
    assert envelope["type"] == "revision.created"
    assert envelope["payload"]["page_id"] == page_id

    await pubsub.unsubscribe(workspace_channel)
    await pubsub.aclose()  # type: ignore[no-untyped-call]
    await redis_client.aclose()
