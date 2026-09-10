from typing import Any

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.session import Actor, get_current_actor
from app.core.db import get_db
from app.modules.ai import service
from app.modules.ai.schemas import SummarizeResult, SuggestReplyResult

router = APIRouter(tags=["AI"])

@router.post(
    "/api/workspaces/{workspace_id}/projects/{project_id}/comments/{comment_id}/ai/summarize",
    response_model=SummarizeResult,
)
async def summarize_thread(
    workspace_id: str,
    project_id: str,
    comment_id: str,
    db: AsyncIOMotorDatabase[dict[str, Any]] = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
) -> SummarizeResult:
    # Basic auth check: just verify user is authenticated for MVP.
    return await service.summarize_thread(db, workspace_id, comment_id)

@router.post(
    "/api/workspaces/{workspace_id}/projects/{project_id}/comments/{comment_id}/ai/suggest-reply",
    response_model=SuggestReplyResult,
)
async def suggest_reply(
    workspace_id: str,
    project_id: str,
    comment_id: str,
    db: AsyncIOMotorDatabase[dict[str, Any]] = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
) -> SuggestReplyResult:
    return await service.suggest_reply(db, workspace_id, comment_id)
