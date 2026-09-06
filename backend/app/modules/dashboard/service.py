from datetime import UTC, datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.errors import ValidationError
from app.core.events import append_event
from app.core.session import Session
from app.modules.comments.repository import CommentRepository
from app.modules.comments.service import _broadcast_comment_event, _comment_out
from app.modules.dashboard.repository import DashboardRepository
from app.modules.dashboard.schemas import (
    ActivityListOut,
    ActivityOut,
    DashboardOut,
    ProjectStatsOut,
    TicketCreate,
    TicketFilters,
    TicketListOut,
    TicketOut,
)
from app.modules.projects.service import get_project
from app.modules.workspaces.repository import MembershipRepository


async def list_tickets(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    workspace_id: str,
    user_id: str,
    filters: TicketFilters,
) -> TicketListOut:
    result = await DashboardRepository(db).tickets(workspace_id, user_id, filters)
    items = []
    for doc in result["items"]:
        comment = await _comment_out(db, doc)
        items.append(
            TicketOut(
                **comment.model_dump(),
                project_id=doc["_page"]["project_id"],
                project_name=doc["_project"]["name"],
                page_title=doc["_page"].get("title") or doc["_page"]["url_normalized"],
            )
        )
    return TicketListOut(
        items=items,
        total=result["count"][0]["total"] if result["count"] else 0,
        offset=filters.offset,
        limit=filters.limit,
    )


async def summary(
    db: AsyncIOMotorDatabase[dict[str, Any]], workspace_id: str, user_id: str
) -> DashboardOut:
    result = await DashboardRepository(db).summary(workspace_id, user_id)
    statuses = {row["_id"]: row["count"] for row in result["statuses"]}
    personal = result["personal"][0] if result["personal"] else {}
    return DashboardOut(
        projects=result["active_projects"],
        archived_projects=result["archived_projects"],
        tickets=sum(statuses.values()),
        statuses=statuses,
        assigned_to_me=personal.get("assigned_to_me", 0),
        needs_reply=personal.get("needs_reply", 0),
        waiting_on_client=personal.get("waiting_on_client", 0),
        overdue=personal.get("overdue", 0),
        project_stats=[
            ProjectStatsOut(project_id=row["_id"], **{k: v for k, v in row.items() if k != "_id"})
            for row in result["projects"]
        ],
    )


async def activity(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    workspace_id: str,
    offset: int,
    limit: int,
    event_type: str,
) -> ActivityListOut:
    docs, total = await DashboardRepository(db).activity(workspace_id, offset, limit, event_type)
    return ActivityListOut(
        total=total,
        items=[
            ActivityOut(
                id=str(doc["_id"]),
                type=doc["type"],
                actor_type=doc["actor_type"],
                actor_id=doc.get("actor_id"),
                created_at=doc["created_at"],
                project_id=doc["payload_json"].get("project_id"),
                comment_id=doc["payload_json"].get("comment_id"),
                name=doc["payload_json"].get("name"),
            )
            for doc in docs
        ],
    )


async def create_ticket(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    workspace_id: str,
    project_id: str,
    actor: Session,
    body: TicketCreate,
) -> TicketOut:
    project = await get_project(db, project_id=project_id, workspace_id=workspace_id)
    if project.archived_at:
        raise ValidationError("Restore this project before adding tickets.")
    if not body.body.strip():
        raise ValidationError("Ticket text is required.")
    assignees = list(dict.fromkeys(body.assignee_ids))
    for user_id in assignees:
        if not await MembershipRepository(db).find(workspace_id=workspace_id, user_id=user_id):
            raise ValidationError("Assignees must belong to this workspace.")
    page = await DashboardRepository(db).standalone_page(workspace_id, project_id)
    doc = await CommentRepository(db).create(
        {
            "workspace_id": workspace_id,
            "project_id": project_id,
            "page_id": str(page["_id"]),
            "parent_id": None,
            "author_type": "member",
            "author_member_id": actor.user_id,
            "author_guest_id": None,
            "layer": "team",
            "body": body.body.strip(),
            "status": body.status,
            "priority": body.priority,
            "tags": list(dict.fromkeys(body.tags)),
            "due_at": body.due_at,
            "assignee_ids": assignees,
            "assignee_id": next(iter(assignees), None),
            "waiting_on_ids": [],
            "waiting_on_client": False,
            "is_standalone": True,
            "anchor": {},
            "recovery_status": "ok",
            "context_json": {},
            "screenshot_key": None,
            "capture_status": "ok",
            "attachments": [],
            "created_at": datetime.now(UTC),
            "edited_at": None,
            "deleted_at": None,
        }
    )
    comment = await _comment_out(db, doc)
    await append_event(
        db,
        workspace_id=workspace_id,
        type="comment.created",
        actor_type="member",
        actor_id=actor.user_id,
        payload={"comment_id": comment.id, "project_id": project_id},
    )
    await _broadcast_comment_event(
        event_type="comment.created",
        workspace_id=workspace_id,
        project_id=project_id,
        comment=comment,
    )
    from app.modules.notifications.service import notify_comment_assigned

    for assignee in assignees:
        await notify_comment_assigned(
            db,
            workspace_id=workspace_id,
            comment_id=comment.id,
            assignee_user_id=assignee,
            actor_user_id=actor.user_id,
        )
    return TicketOut(
        **comment.model_dump(),
        project_id=project_id,
        project_name=project.name,
        page_title="Project tickets",
    )
