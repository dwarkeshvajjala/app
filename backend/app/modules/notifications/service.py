from datetime import datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.modules.auth.repository import UserRepository
from app.modules.notifications import events as notification_events
from app.modules.notifications.repository import NotificationRepository
from app.modules.notifications.schemas import NotificationOut
from app.modules.realtime.pubsub import publish as publish_realtime_event
from app.modules.workspaces.repository import MembershipRepository, WorkspaceRepository


def _notification_out(doc: dict[str, Any]) -> NotificationOut:
    return NotificationOut(
        id=str(doc["_id"]),
        type=doc["type"],
        payload=doc["payload_json"],
        target_route=doc.get("target_route"),
        read_at=doc.get("read_at"),
        created_at=doc["created_at"],
    )


async def _workspace_slug(db: AsyncIOMotorDatabase[dict[str, Any]], workspace_id: str) -> str:
    """M-06: route metadata is this module's own responsibility, not something every
    call site has to remember to supply - the previous per-parameter `workspace_slug`
    defaulting to "" is exactly how the assignment notification's target_route ended up
    silently None (FD-AUD-006's "insufficient route metadata" finding). Resolved fresh
    per call rather than cached: workspace slugs can change (workspaces/service.py's
    rename flow) and notifications are low-frequency enough that one extra lookup is
    not a hot path."""
    workspace = await WorkspaceRepository(db).find_by_id(workspace_id)
    return workspace["slug"] if workspace else ""


def _comment_deep_link(workspace_slug: str, project_id: str, comment_id: str) -> str | None:
    """The one route that actually opens a specific thread: the project Board
    (`/w/:workspaceSlug/p/:projectId/board`), whose `?comment=<id>` query param
    BoardPage.tsx reads to open CommentThreadPanel. `/p/:projectId` (ProjectOverviewPage)
    and the workspace-wide `/tickets` list do not honor a `?ticket=` param at all - the
    previous target_route pointed at the former with the latter's param name, so a
    notification click landed on a page that silently ignored the query string
    (M-06: "Notification click routes to exact project/page/thread")."""
    if not workspace_slug or not project_id:
        return None
    return f"/w/{workspace_slug}/p/{project_id}/board?comment={comment_id}"


async def _create_and_broadcast(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    *,
    workspace_id: str,
    user_id: str,
    type: str,
    payload_json: dict[str, Any],
    target_route: str | None = None,
) -> NotificationOut | None:
    """Returns None (creating nothing) when `user_id` isn't a real member of
    `workspace_id`. Every current caller already only ever resolves member ids
    (assignees/authors/mentions are all validated workspace members before reaching
    here), but this is the module's own last line of defense against ever handing a
    notification - even an empty-bodied one carrying only IDs - to someone without
    legitimate workspace access (M-06: "team-only content reaching wrong
    recipients"), rather than trusting every future call site to get that right."""
    if not await MembershipRepository(db).find(workspace_id=workspace_id, user_id=user_id):
        return None
    preference = {
        notification_events.COMMENT_ASSIGNED: "notify_on_assignment",
        notification_events.COMMENT_REPLY: "notify_on_reply",
        notification_events.COMMENT_MENTION: "notify_on_mention",
        notification_events.COMMENT_STATUS_CHANGED: "notify_on_status_change",
    }.get(type)
    if preference:
        user = await UserRepository(db).find_by_id(user_id)
        if user is None or not user.get("preferences", {}).get(preference, True):
            return None
    doc = await NotificationRepository(db).create(
        workspace_id=workspace_id,
        user_id=user_id,
        type=type,
        payload_json=payload_json,
        target_route=target_route,
    )
    notification = _notification_out(doc)
    # There's no per-member WS channel (12-API-WebSocket.md §12.6 only defines
    # workspace:{id}:all and project:{id}:client) - broadcast workspace-wide with the
    # recipient's user_id in the payload, same pattern as comment.recovery_updated
    # (docs/tdr/0009); the dashboard only surfaces it if it matches the current user.
    await publish_realtime_event(
        f"workspace:{workspace_id}:all",
        event_type="notification.new",
        workspace_id=workspace_id,
        payload={**notification.model_dump(mode="json"), "recipient_user_id": user_id},
    )
    return notification


async def notify_comment_assigned(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    *,
    workspace_id: str,
    project_id: str,
    comment_id: str,
    assignee_user_id: str,
    actor_user_id: str,
) -> None:
    if assignee_user_id == actor_user_id:
        return  # assigning a comment to yourself isn't worth a notification
    slug = await _workspace_slug(db, workspace_id)
    await _create_and_broadcast(
        db,
        workspace_id=workspace_id,
        user_id=assignee_user_id,
        type=notification_events.COMMENT_ASSIGNED,
        payload_json={"comment_id": comment_id, "project_id": project_id},
        target_route=_comment_deep_link(slug, project_id, comment_id),
    )


async def notify_comment_reply(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    *,
    workspace_id: str,
    project_id: str,
    parent_comment_id: str,
    reply_author_name: str,
    recipient_user_id: str,
    actor_user_id: str,
) -> None:
    """Notify comment author / other participants when a reply is posted."""
    if recipient_user_id == actor_user_id:
        return
    slug = await _workspace_slug(db, workspace_id)
    await _create_and_broadcast(
        db,
        workspace_id=workspace_id,
        user_id=recipient_user_id,
        type=notification_events.COMMENT_REPLY,
        payload_json={
            "comment_id": parent_comment_id,
            "project_id": project_id,
            "actor_name": reply_author_name,
        },
        target_route=_comment_deep_link(slug, project_id, parent_comment_id),
    )


async def notify_comment_mention(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    *,
    workspace_id: str,
    project_id: str,
    comment_id: str,
    mentioned_user_id: str,
    actor_name: str,
    actor_user_id: str,
) -> None:
    """Notify a @-mentioned member."""
    if mentioned_user_id == actor_user_id:
        return
    slug = await _workspace_slug(db, workspace_id)
    await _create_and_broadcast(
        db,
        workspace_id=workspace_id,
        user_id=mentioned_user_id,
        type=notification_events.COMMENT_MENTION,
        payload_json={
            "comment_id": comment_id,
            "project_id": project_id,
            "actor_name": actor_name,
        },
        target_route=_comment_deep_link(slug, project_id, comment_id),
    )


async def notify_comment_status_changed(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    *,
    workspace_id: str,
    project_id: str,
    comment_id: str,
    new_status: str,
    recipient_user_id: str,
    actor_user_id: str,
) -> None:
    """Notify the comment author or assignees when status changes."""
    if recipient_user_id == actor_user_id:
        return
    slug = await _workspace_slug(db, workspace_id)
    await _create_and_broadcast(
        db,
        workspace_id=workspace_id,
        user_id=recipient_user_id,
        type=notification_events.COMMENT_STATUS_CHANGED,
        payload_json={
            "comment_id": comment_id,
            "project_id": project_id,
            "new_status": new_status,
        },
        target_route=_comment_deep_link(slug, project_id, comment_id),
    )


async def notify_integration_disconnected(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    *,
    workspace_id: str,
    integration_id: str,
    integration_type: str,
    connected_by: str,
) -> None:
    """17.8: "integration disconnected unexpectedly" - fired from the webhook retry
    engine's dead-letter path (docs/tdr/0009), notifying whoever originally connected it."""
    slug = await _workspace_slug(db, workspace_id)
    target_route = f"/w/{slug}/integrations" if slug else None
    await _create_and_broadcast(
        db,
        workspace_id=workspace_id,
        user_id=connected_by,
        type=notification_events.INTEGRATION_DISCONNECTED,
        payload_json={"integration_id": integration_id, "integration_type": integration_type},
        target_route=target_route,
    )


async def list_notifications(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    *,
    workspace_id: str,
    user_id: str,
    limit: int,
    before: datetime | None,
) -> list[NotificationOut]:
    docs = await NotificationRepository(db).list_for_user(
        workspace_id=workspace_id, user_id=user_id, limit=limit, before=before
    )
    return [_notification_out(doc) for doc in docs]


async def count_unread(
    db: AsyncIOMotorDatabase[dict[str, Any]], *, workspace_id: str, user_id: str
) -> int:
    return await NotificationRepository(db).count_unread(workspace_id=workspace_id, user_id=user_id)


async def mark_read(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    *,
    notification_id: str,
    workspace_id: str,
    user_id: str,
) -> None:
    await NotificationRepository(db).mark_read(
        notification_id, workspace_id=workspace_id, user_id=user_id
    )


async def mark_all_read(
    db: AsyncIOMotorDatabase[dict[str, Any]], *, workspace_id: str, user_id: str
) -> None:
    await NotificationRepository(db).mark_all_read(workspace_id=workspace_id, user_id=user_id)
