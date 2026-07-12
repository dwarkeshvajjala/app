from datetime import datetime

from fastapi import APIRouter, Depends

from app.core.db import get_db
from app.core.permissions import require_permission
from app.core.session import Actor, Session, get_current_actor, require_workspace_context
from app.modules.comments import service as comment_service
from app.modules.comments.schemas import (
    CommentCreate,
    CommentOut,
    CommentUpdate,
    LayerToggleRequest,
    ReanchorRequest,
    ReplyCreate,
)

router = APIRouter(tags=["comments"])


@router.get("/pages/{page_id}/comments", response_model=list[CommentOut])
async def list_comments(
    page_id: str,
    since: datetime | None = None,
    actor: Actor = Depends(get_current_actor),
) -> list[CommentOut]:
    return await comment_service.list_comments(get_db(), page_id=page_id, actor=actor, since=since)


@router.post("/pages/{page_id}/comments", response_model=CommentOut, status_code=201)
async def create_comment(
    page_id: str, body: CommentCreate, actor: Actor = Depends(get_current_actor)
) -> CommentOut:
    return await comment_service.create_comment(
        get_db(),
        page_id=page_id,
        actor=actor,
        body=body.body,
        layer=body.layer,
        anchor=body.anchor,
        context=body.context,
        screenshot_key=body.screenshot_key,
        capture_status=body.capture_status,
    )


@router.post("/comments/{comment_id}/replies", response_model=CommentOut, status_code=201)
async def create_reply(
    comment_id: str, body: ReplyCreate, actor: Actor = Depends(get_current_actor)
) -> CommentOut:
    return await comment_service.create_reply(
        get_db(), parent_id=comment_id, actor=actor, body=body.body, layer=body.layer
    )


@router.patch("/comments/{comment_id}", response_model=CommentOut)
async def update_comment(
    comment_id: str,
    body: CommentUpdate,
    session: Session = Depends(require_permission("comment:update_status")),
) -> CommentOut:
    return await comment_service.update_comment(
        get_db(),
        comment_id=comment_id,
        workspace_id=require_workspace_context(session),
        body=body.body,
        status=body.status,
        assignee_id=body.assignee_id,
        due_at=body.due_at,
    )


@router.patch("/comments/{comment_id}/layer", response_model=CommentOut)
async def toggle_layer(
    comment_id: str,
    body: LayerToggleRequest,
    session: Session = Depends(require_permission("comment:toggle_layer")),
) -> CommentOut:
    return await comment_service.toggle_layer(
        get_db(),
        comment_id=comment_id,
        workspace_id=require_workspace_context(session),
        actor_user_id=session.user_id,
        layer=body.layer,
        confirm=body.confirm,
    )


@router.patch("/comments/{comment_id}/reanchor", response_model=CommentOut)
async def reanchor(
    comment_id: str,
    body: ReanchorRequest,
    session: Session = Depends(require_permission("comment:reanchor")),
) -> CommentOut:
    return await comment_service.reanchor(
        get_db(),
        comment_id=comment_id,
        workspace_id=require_workspace_context(session),
        actor_user_id=session.user_id,
        anchor=body.anchor,
    )
