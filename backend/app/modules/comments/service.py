import asyncio
from datetime import UTC, datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.actor_access import resolve_actor_project_access
from app.core.errors import NotFoundError, ValidationError
from app.core.events import append_event
from app.core.session import Actor, GuestSession, Session, actor_identity
from app.modules.comments import events as comment_events
from app.modules.comments.repository import CommentRepository
from app.modules.comments.schemas import AnchorIn, CommentOut, ContextIn
from app.modules.pages.repository import PageRepository
from app.modules.storage.r2_client import generate_presigned_get


async def _comment_out(doc: dict[str, Any]) -> CommentOut:
    screenshot_url = None
    if doc.get("screenshot_key"):
        screenshot_url = await generate_presigned_get(doc["screenshot_key"])

    return CommentOut(
        id=str(doc["_id"]),
        page_id=doc["page_id"],
        parent_id=doc.get("parent_id"),
        author_type=doc["author_type"],
        author_id=doc["author_member_id"] or doc["author_guest_id"],
        layer=doc["layer"],
        body=doc["body"],
        status=doc["status"],
        assignee_id=doc.get("assignee_id"),
        due_at=doc.get("due_at"),
        anchor=doc["anchor"],
        recovery_status=doc["recovery_status"],
        context=doc["context_json"],
        screenshot_url=screenshot_url,
        capture_status=doc["capture_status"],
        created_at=doc["created_at"],
        edited_at=doc.get("edited_at"),
    )


async def _resolve_page_and_access(
    db: AsyncIOMotorDatabase[dict[str, Any]], actor: Actor, page_id: str
) -> dict[str, Any]:
    page = await PageRepository(db).find_by_id(page_id)
    if page is None:
        raise NotFoundError("Page not found.")
    await resolve_actor_project_access(db, actor, page["project_id"])
    return page


async def create_comment(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    *,
    page_id: str,
    actor: Actor,
    body: str,
    layer: str,
    anchor: AnchorIn,
    context: ContextIn,
    screenshot_key: str | None,
    capture_status: str,
) -> CommentOut:
    page = await _resolve_page_and_access(db, actor, page_id)

    # Guest-authored comments always default to layer=client, never overridable by the
    # guest themselves (12-API-WebSocket.md §12.4).
    effective_layer = "client" if isinstance(actor, GuestSession) else layer

    doc: dict[str, Any] = {
        "page_id": page_id,
        "workspace_id": page["workspace_id"],
        "parent_id": None,
        "author_type": "guest" if isinstance(actor, GuestSession) else "member",
        "author_member_id": actor.user_id if isinstance(actor, Session) else None,
        "author_guest_id": actor.guest_session_id if isinstance(actor, GuestSession) else None,
        "layer": effective_layer,
        "body": body,
        "status": "todo",
        "assignee_id": None,
        "due_at": None,
        "anchor": anchor.model_dump(),
        "recovery_status": "ok",
        "context_json": context.model_dump(),
        "screenshot_key": screenshot_key,
        "capture_status": capture_status,
        "created_at": datetime.now(UTC),
        "edited_at": None,
    }
    created = await CommentRepository(db).create(doc)

    actor_type, actor_id = actor_identity(actor)
    await append_event(
        db,
        workspace_id=page["workspace_id"],
        type=comment_events.COMMENT_CREATED,
        actor_type=actor_type,
        actor_id=actor_id,
        payload={"comment_id": str(created["_id"]), "page_id": page_id, "layer": effective_layer},
    )
    return await _comment_out(created)


async def create_reply(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    *,
    parent_id: str,
    actor: Actor,
    body: str,
    layer: str,
) -> CommentOut:
    repo = CommentRepository(db)
    parent = await repo.find_by_id(parent_id)
    if parent is None:
        raise NotFoundError("Comment not found.")

    parent_page = await PageRepository(db).find_by_id(parent["page_id"])
    if parent_page is None:
        raise NotFoundError("Page not found.")
    await resolve_actor_project_access(db, actor, parent_page["project_id"])

    is_guest = isinstance(actor, GuestSession)
    if is_guest and parent["layer"] != "client":
        # A guest can reply "on client-visible threads only" (13-Authentication.md §13.5).
        # Treated as not-found, not forbidden, so a crafted request can't be used to
        # confirm that a team-only comment exists on a page a guest can see.
        raise NotFoundError("Comment not found.")

    effective_layer = "client" if is_guest else layer

    doc: dict[str, Any] = {
        "page_id": parent["page_id"],
        "workspace_id": parent["workspace_id"],
        "parent_id": parent_id,
        "author_type": "guest" if is_guest else "member",
        "author_member_id": actor.user_id if isinstance(actor, Session) else None,
        "author_guest_id": actor.guest_session_id if isinstance(actor, GuestSession) else None,
        "layer": effective_layer,
        "body": body,
        "status": "todo",
        "assignee_id": None,
        "due_at": None,
        "anchor": parent["anchor"],
        "recovery_status": parent["recovery_status"],
        "context_json": parent["context_json"],
        "screenshot_key": None,
        "capture_status": "ok",
        "created_at": datetime.now(UTC),
        "edited_at": None,
    }
    created = await repo.create(doc)

    actor_type, actor_id = actor_identity(actor)
    await append_event(
        db,
        workspace_id=parent["workspace_id"],
        type=comment_events.COMMENT_CREATED,
        actor_type=actor_type,
        actor_id=actor_id,
        payload={
            "comment_id": str(created["_id"]),
            "parent_id": parent_id,
            "layer": effective_layer,
        },
    )
    return await _comment_out(created)


async def list_comments(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    *,
    page_id: str,
    actor: Actor,
    since: datetime | None,
) -> list[CommentOut]:
    page = await _resolve_page_and_access(db, actor, page_id)
    repo = CommentRepository(db)

    if isinstance(actor, GuestSession):
        docs = await repo.list_for_guest_session(page["workspace_id"], page_id, since=since)
    else:
        docs = await repo.list_for_member(page["workspace_id"], page_id, since=since)

    return await asyncio.gather(*(_comment_out(doc) for doc in docs))


async def update_comment(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    *,
    comment_id: str,
    workspace_id: str,
    body: str | None,
    status: str | None,
    assignee_id: str | None,
    due_at: datetime | None,
) -> CommentOut:
    repo = CommentRepository(db)
    existing = await repo.find_by_id(comment_id)
    if existing is None or existing["workspace_id"] != workspace_id:
        raise NotFoundError("Comment not found.")

    patch: dict[str, Any] = {}
    if body is not None:
        patch["body"] = body
    if status is not None:
        patch["status"] = status
    if assignee_id is not None:
        patch["assignee_id"] = assignee_id
    if due_at is not None:
        patch["due_at"] = due_at

    await repo.update(comment_id, patch)
    await append_event(
        db,
        workspace_id=workspace_id,
        type=comment_events.COMMENT_UPDATED,
        actor_type="member",
        actor_id=None,
        payload={"comment_id": comment_id, **{k: v for k, v in patch.items() if k != "edited_at"}},
    )

    updated = await repo.find_by_id(comment_id)
    assert updated is not None
    return await _comment_out(updated)


async def toggle_layer(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    *,
    comment_id: str,
    workspace_id: str,
    actor_user_id: str,
    layer: str,
    confirm: bool,
) -> CommentOut:
    if not confirm:
        raise ValidationError("Toggling a comment's layer requires confirm: true.")

    repo = CommentRepository(db)
    existing = await repo.find_by_id(comment_id)
    if existing is None or existing["workspace_id"] != workspace_id:
        raise NotFoundError("Comment not found.")

    await repo.update(comment_id, {"layer": layer})
    await append_event(
        db,
        workspace_id=workspace_id,
        type=comment_events.COMMENT_LAYER_CHANGED,
        actor_type="member",
        actor_id=actor_user_id,
        payload={"comment_id": comment_id, "new_layer": layer},
    )

    updated = await repo.find_by_id(comment_id)
    assert updated is not None
    return await _comment_out(updated)


async def reanchor(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    *,
    comment_id: str,
    workspace_id: str,
    actor_user_id: str,
    anchor: AnchorIn,
) -> CommentOut:
    repo = CommentRepository(db)
    existing = await repo.find_by_id(comment_id)
    if existing is None or existing["workspace_id"] != workspace_id:
        raise NotFoundError("Comment not found.")

    await repo.update(comment_id, {"anchor": anchor.model_dump(), "recovery_status": "ok"})
    await append_event(
        db,
        workspace_id=workspace_id,
        type=comment_events.COMMENT_REANCHORED,
        actor_type="member",
        actor_id=actor_user_id,
        payload={"comment_id": comment_id},
    )

    updated = await repo.find_by_id(comment_id)
    assert updated is not None
    return await _comment_out(updated)
