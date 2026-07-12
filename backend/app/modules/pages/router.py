from fastapi import APIRouter, Depends, Request

from app.core.config import get_settings
from app.core.db import get_db
from app.core.permissions import require_permission
from app.core.rate_limit import actor_rate_limit_key, check_rate_limit
from app.core.redis_client import get_redis
from app.core.session import Actor, Session, get_current_actor, require_workspace_context
from app.modules.pages import service as page_service
from app.modules.pages.schemas import PageOut, PageRegister

router = APIRouter(tags=["pages"])


@router.get("/projects/{project_id}/pages", response_model=list[PageOut])
async def list_pages(
    project_id: str,
    session: Session = Depends(require_permission("project:manage")),
) -> list[PageOut]:
    return await page_service.list_pages(
        get_db(), project_id=project_id, workspace_id=require_workspace_context(session)
    )


@router.post("/pages", response_model=PageOut, status_code=201)
async def register_page(
    body: PageRegister, request: Request, actor: Actor = Depends(get_current_actor)
) -> PageOut:
    settings = get_settings()
    await check_rate_limit(
        get_redis(),
        key=actor_rate_limit_key("page-register", request, actor),
        limit=settings.page_register_rate_limit_per_minute,
        window_seconds=60,
    )
    return await page_service.register_page(
        get_db(), actor=actor, project_id=body.project_id, url=body.url, title=body.title
    )
