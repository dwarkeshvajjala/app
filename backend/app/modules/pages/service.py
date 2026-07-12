from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.actor_access import resolve_actor_project_access
from app.core.errors import NotFoundError
from app.core.events import append_event
from app.core.session import Actor, actor_identity
from app.modules.pages import events as page_events
from app.modules.pages.repository import PageRepository
from app.modules.pages.schemas import PageOut
from app.modules.pages.url_normalize import normalize_url
from app.modules.projects.repository import ProjectRepository


def _page_out(doc: dict[str, Any]) -> PageOut:
    return PageOut(
        id=str(doc["_id"]),
        project_id=doc["project_id"],
        url_normalized=doc["url_normalized"],
        title=doc.get("title"),
        first_seen_at=doc["first_seen_at"],
        latest_revision_id=doc.get("latest_revision_id"),
    )


async def register_page(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    *,
    actor: Actor,
    project_id: str,
    url: str,
    title: str | None,
) -> PageOut:
    """Idempotent on url_normalized (09-Snapshot-Engine.md, 11-Database.md §11.7) - a
    guest revisiting an already-registered page is a no-op, not a duplicate."""
    workspace_id = await resolve_actor_project_access(db, actor, project_id)
    url_normalized = normalize_url(url)

    repo = PageRepository(db)
    existing = await repo.find_by_normalized_url(project_id, url_normalized)
    if existing is not None:
        return _page_out(existing)

    doc = await repo.create(
        project_id=project_id,
        workspace_id=workspace_id,
        url_normalized=url_normalized,
        title=title,
    )
    actor_type, actor_id = actor_identity(actor)
    await append_event(
        db,
        workspace_id=workspace_id,
        type=page_events.PAGE_REGISTERED,
        actor_type=actor_type,
        actor_id=actor_id,
        payload={"project_id": project_id, "url_normalized": url_normalized},
    )
    return _page_out(doc)


async def list_pages(
    db: AsyncIOMotorDatabase[dict[str, Any]], *, project_id: str, workspace_id: str
) -> list[PageOut]:
    project = await ProjectRepository(db).find_by_id(project_id)
    if project is None or project["workspace_id"] != workspace_id:
        raise NotFoundError("Project not found.")

    docs = await PageRepository(db).list_for_project(project_id)
    return [_page_out(doc) for doc in docs]
