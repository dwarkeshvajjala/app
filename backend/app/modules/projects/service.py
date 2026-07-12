from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.errors import NotFoundError
from app.core.events import append_event
from app.modules.projects import events as project_events
from app.modules.projects.repository import ProjectRepository
from app.modules.projects.schemas import ProjectOut, ProjectSettingsOut


def _project_out(doc: dict[str, Any]) -> ProjectOut:
    return ProjectOut(
        id=str(doc["_id"]),
        workspace_id=doc["workspace_id"],
        name=doc["name"],
        target_origin=doc["target_origin"],
        settings=ProjectSettingsOut(**doc["settings_json"]),
        archived_at=doc["archived_at"],
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


async def create_project(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    *,
    workspace_id: str,
    actor_user_id: str,
    name: str,
    target_origin: str,
) -> ProjectOut:
    repo = ProjectRepository(db)
    doc = await repo.create(workspace_id=workspace_id, name=name, target_origin=target_origin)
    await append_event(
        db,
        workspace_id=workspace_id,
        type=project_events.PROJECT_CREATED,
        actor_type="member",
        actor_id=actor_user_id,
        payload={"name": name, "target_origin": target_origin},
    )
    return _project_out(doc)


async def list_projects(
    db: AsyncIOMotorDatabase[dict[str, Any]], workspace_id: str
) -> list[ProjectOut]:
    repo = ProjectRepository(db)
    docs = await repo.list_for_workspace(workspace_id)
    return [_project_out(doc) for doc in docs]


async def get_project(
    db: AsyncIOMotorDatabase[dict[str, Any]], *, project_id: str, workspace_id: str
) -> ProjectOut:
    repo = ProjectRepository(db)
    doc = await repo.find_by_id(project_id)
    if doc is None or doc["workspace_id"] != workspace_id:
        raise NotFoundError("Project not found.")
    return _project_out(doc)


async def update_project(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    *,
    project_id: str,
    workspace_id: str,
    actor_user_id: str,
    name: str | None,
    target_origin: str | None,
) -> ProjectOut:
    repo = ProjectRepository(db)
    existing = await repo.find_by_id(project_id)
    if existing is None or existing["workspace_id"] != workspace_id:
        raise NotFoundError("Project not found.")

    await repo.update(project_id, name=name, target_origin=target_origin)
    await append_event(
        db,
        workspace_id=workspace_id,
        type=project_events.PROJECT_UPDATED,
        actor_type="member",
        actor_id=actor_user_id,
        payload={"name": name, "target_origin": target_origin},
    )

    updated = await repo.find_by_id(project_id)
    assert updated is not None
    return _project_out(updated)


async def archive_project(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    *,
    project_id: str,
    workspace_id: str,
    actor_user_id: str,
) -> None:
    repo = ProjectRepository(db)
    existing = await repo.find_by_id(project_id)
    if existing is None or existing["workspace_id"] != workspace_id:
        raise NotFoundError("Project not found.")

    await repo.archive(project_id)
    await append_event(
        db,
        workspace_id=workspace_id,
        type=project_events.PROJECT_ARCHIVED,
        actor_type="member",
        actor_id=actor_user_id,
        payload={},
    )
