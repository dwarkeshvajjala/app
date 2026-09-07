from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.actor_access import resolve_actor_project_access
from app.core.errors import ConflictError, NotFoundError
from app.core.events import append_event
from app.core.session import Actor, actor_identity
from app.modules.pages import events as page_events
from app.modules.pages.repository import PageRepository
from app.modules.pages.schemas import PageOut, PageUpdate
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
    existing = await repo.find_by_normalized_url(workspace_id, project_id, url_normalized)
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

    docs = await PageRepository(db).list_for_project(workspace_id, project_id)
    # Sort by sort_order ascending, then first_seen_at descending
    docs.sort(key=lambda x: (x.get("sort_order", 0), -x["first_seen_at"].timestamp()))
    return [_page_out(doc) for doc in docs]


async def update_page(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    *,
    workspace_id: str,
    page_id: str,
    changes: PageUpdate,
) -> PageOut:
    """Member-only dashboard page management (M-01: was previously reachable by any
    actor including guests via resolve_actor_project_access - rename/reorder is a
    project-management action with no guest row in the permission matrix).

    M-08: `changes` was an untyped `dict[str, Any]` handed straight to the
    repository's $set - the router already built a typed PageUpdate and immediately
    threw the type away with `.model_dump()` before calling this. Taking the typed
    model here instead means this service function is the one place that decides
    which fields are mass-assignable (via `.model_dump(exclude_unset=True)`), not
    whatever dict a future caller happens to construct."""
    repo = PageRepository(db)
    existing = await repo.find_by_id(page_id)
    if not existing or existing["workspace_id"] != workspace_id:
        raise NotFoundError("Page not found.")

    patch = changes.model_dump(exclude_unset=True)
    if not patch:
        return _page_out(existing)
    await repo.update(workspace_id, page_id, patch)

    updated = await repo.find_by_id(page_id)
    assert updated is not None
    return _page_out(updated)


async def delete_page(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    *,
    workspace_id: str,
    page_id: str,
    actor_user_id: str,
) -> None:
    """Delete only an empty page; referenced pages require project-level retention."""
    repo = PageRepository(db)
    existing = await repo.find_by_id(page_id)
    if not existing or existing["workspace_id"] != workspace_id:
        raise NotFoundError("Page not found.")

    counts = await repo.reference_counts(workspace_id, page_id)
    if any(counts.values()):
        raise ConflictError(
            "This page has review history and cannot be deleted. Archive or hard-delete "
            "the project through the retention workflow instead.",
            details={"references": counts},
        )

    await repo.delete(workspace_id, page_id)
    await append_event(
        db,
        workspace_id=workspace_id,
        type=page_events.PAGE_DELETED,
        actor_type="member",
        actor_id=actor_user_id,
        payload={
            "page_id": page_id,
            "project_id": existing["project_id"],
            "url_normalized": existing["url_normalized"],
        },
    )
