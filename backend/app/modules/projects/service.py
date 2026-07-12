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
    # Deferred import: share_links.service itself imports this module (to check a
    # project exists before creating/listing links for it), so importing it at module
    # scope here would be a circular import. Breaking it this way, rather than
    # duplicating share-link creation logic, keeps "one way to create a share link."
    from app.modules.share_links import service as share_link_service

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

    # Onboarding tightening (20-Build-Plan.md Milestone 9): "install-free path first"
    # (F7/03-System-Architecture.md §3.3) means a brand-new project is shareable the
    # instant it exists, in proxy mode by default - no separate trip to the Share Links
    # screen before a PM can send something to a client.
    project_id = str(doc["_id"])
    await share_link_service.create_share_link(
        db,
        project_id=project_id,
        workspace_id=workspace_id,
        actor_user_id=actor_user_id,
        mode="proxy",
        passcode=None,
        expires_at=None,
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
