from datetime import datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.modules.notifications.repository import NotificationRepository
from app.modules.notifications.schemas import NotificationOut
from app.modules.realtime.pubsub import publish as publish_realtime_event


def _notification_out(doc: dict[str, Any]) -> NotificationOut:
    return NotificationOut(
        id=str(doc["_id"]),
        type=doc["type"],
        payload=doc["payload_json"],
        read_at=doc.get("read_at"),
        created_at=doc["created_at"],
    )


async def _create_and_broadcast(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    *,
    workspace_id: str,
    user_id: str,
    type: str,
    payload_json: dict[str, Any],
) -> NotificationOut:
    doc = await NotificationRepository(db).create(
        workspace_id=workspace_id, user_id=user_id, type=type, payload_json=payload_json
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
    comment_id: str,
    assignee_user_id: str,
    actor_user_id: str,
) -> None:
    if assignee_user_id == actor_user_id:
        return  # assigning a comment to yourself isn't worth a notification
    await _create_and_broadcast(
        db,
        workspace_id=workspace_id,
        user_id=assignee_user_id,
        type="comment_assigned",
        payload_json={"comment_id": comment_id},
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
    await _create_and_broadcast(
        db,
        workspace_id=workspace_id,
        user_id=connected_by,
        type="integration_disconnected",
        payload_json={"integration_id": integration_id, "integration_type": integration_type},
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
    db: AsyncIOMotorDatabase[dict[str, Any]], *, notification_id: str, user_id: str
) -> None:
    await NotificationRepository(db).mark_read(notification_id, user_id=user_id)


async def mark_all_read(
    db: AsyncIOMotorDatabase[dict[str, Any]], *, workspace_id: str, user_id: str
) -> None:
    await NotificationRepository(db).mark_all_read(workspace_id=workspace_id, user_id=user_id)
