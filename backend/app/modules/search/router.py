from fastapi import APIRouter, Depends, Query

from app.core.db import get_db
from app.core.permissions import require_permission
from app.core.session import Session, require_workspace_match
from app.modules.search import service
from app.modules.search.schemas import SearchOut

router = APIRouter(tags=["search"])


@router.get("/workspaces/{workspace_id}/search", response_model=SearchOut)
async def search(
    workspace_id: str,
    q: str = Query(min_length=1, max_length=120),
    limit: int = Query(default=20, ge=1, le=50),
    session: Session = Depends(require_permission("comment:view_team")),
) -> SearchOut:
    require_workspace_match(session, workspace_id)
    return await service.search(get_db(), workspace_id, q, limit)
