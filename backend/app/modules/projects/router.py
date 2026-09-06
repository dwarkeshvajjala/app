from fastapi import APIRouter, Depends

from app.core.db import get_db
from app.core.permissions import require_permission
from app.core.session import Session, require_workspace_context, require_workspace_match
from app.modules.projects import service as project_service
from app.modules.projects.schemas import ProjectCreate, ProjectOut, ProjectUpdate

router = APIRouter(tags=["projects"])


@router.get("/workspaces/{workspace_id}/projects", response_model=list[ProjectOut])
async def list_projects(
    workspace_id: str,
    include_archived: bool = False,
    session: Session = Depends(require_permission("project:manage")),
) -> list[ProjectOut]:
    require_workspace_match(session, workspace_id)
    return await project_service.list_projects(
        get_db(), workspace_id, include_archived=include_archived
    )


@router.post("/workspaces/{workspace_id}/projects", response_model=ProjectOut, status_code=201)
async def create_project(
    workspace_id: str,
    body: ProjectCreate,
    session: Session = Depends(require_permission("project:manage")),
) -> ProjectOut:
    require_workspace_match(session, workspace_id)
    return await project_service.create_project(
        get_db(),
        workspace_id=workspace_id,
        actor_user_id=session.user_id,
        name=body.name,
        target_origin=body.target_origin,
        project_type=body.project_type,
        environment=body.environment,
        client_id=body.client_id,
    )


@router.get("/projects/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: str,
    session: Session = Depends(require_permission("project:manage")),
) -> ProjectOut:
    return await project_service.get_project(
        get_db(), project_id=project_id, workspace_id=require_workspace_context(session)
    )


@router.patch("/projects/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: str,
    body: ProjectUpdate,
    session: Session = Depends(require_permission("project:manage")),
) -> ProjectOut:
    return await project_service.update_project(
        get_db(),
        project_id=project_id,
        workspace_id=require_workspace_context(session),
        actor_user_id=session.user_id,
        name=body.name,
        target_origin=body.target_origin,
        changes=body,
    )


@router.delete("/projects/{project_id}", status_code=204)
async def archive_project(
    project_id: str,
    session: Session = Depends(require_permission("project:manage")),
) -> None:
    await project_service.archive_project(
        get_db(),
        project_id=project_id,
        workspace_id=require_workspace_context(session),
        actor_user_id=session.user_id,
    )


@router.post("/projects/{project_id}/restore", response_model=ProjectOut)
async def restore_project(
    project_id: str,
    session: Session = Depends(require_permission("project:manage")),
) -> ProjectOut:
    return await project_service.restore_project(
        get_db(),
        project_id=project_id,
        workspace_id=require_workspace_context(session),
        actor_user_id=session.user_id,
    )
