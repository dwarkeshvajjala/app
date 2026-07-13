from datetime import UTC, datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.modules.comments.repository import CommentRepository
from app.modules.pages.repository import PageRepository
from app.modules.pages.url_normalize import normalize_url
from app.modules.projects.repository import ProjectRepository

# F7 (01-Product-Vision.md, 16-Dashboard.md): "teach by doing" - a brand-new workspace
# isn't a blank slate, it already has one project with a page and three comments
# demonstrating exactly what the product does (a client-visible note, a team-only
# reply, and a resolved thread) before the owner creates anything themselves.
SAMPLE_PROJECT_NAME = "Example Project"
SAMPLE_TARGET_ORIGIN = "https://example-agency-site.com"
SAMPLE_PAGE_URL = "https://example-agency-site.com/"

_SAMPLE_ANCHOR = {
    "tier": 1,
    "dom_fingerprint": {
        "selector_path": "body > header > h1",
        "tag": "h1",
        "attributes": {"data-testid": "hero-heading"},
        "node_hash": "sha256:sample-heading",
        "ancestor_path_hash": "sha256:sample-heading-pos",
    },
    "text_fingerprint": {
        "normalized_text": "Welcome to our site",
        "text_similarity_hash": "0" * 16,
    },
}

_SAMPLE_CONTEXT = {
    "browser": "Chrome",
    "os": "macOS",
    "viewport": {"width": 1440, "height": 900},
    "device_type": "desktop",
    "url": SAMPLE_PAGE_URL,
}

_SAMPLE_GUEST_ID = "sample-guest-jordan"


def _sample_comment(
    *,
    page_id: str,
    workspace_id: str,
    body: str,
    layer: str,
    status: str,
    author_type: str,
    author_member_id: str | None,
    parent_id: str | None = None,
) -> dict[str, Any]:
    now = datetime.now(UTC)
    return {
        "page_id": page_id,
        "workspace_id": workspace_id,
        "parent_id": parent_id,
        "author_type": author_type,
        "author_member_id": author_member_id,
        "author_guest_id": None if author_member_id else _SAMPLE_GUEST_ID,
        "layer": layer,
        "body": body,
        "status": status,
        "assignee_id": None,
        "due_at": None,
        "anchor": _SAMPLE_ANCHOR,
        "recovery_status": "ok",
        "consecutive_orphaned_revisions": 0,
        "context_json": _SAMPLE_CONTEXT,
        "screenshot_key": None,
        "capture_status": "failed",
        "created_at": now,
        "edited_at": None,
    }


async def seed_sample_project(
    db: AsyncIOMotorDatabase[dict[str, Any]], *, workspace_id: str, owner_user_id: str
) -> None:
    """Runs once, right after a brand-new workspace is created (workspaces/service.py's
    create_workspace) - never on every login, and never for a workspace someone was
    merely invited into (only the creator's very first workspace gets one)."""
    project_doc = await ProjectRepository(db).create(
        workspace_id=workspace_id, name=SAMPLE_PROJECT_NAME, target_origin=SAMPLE_TARGET_ORIGIN
    )
    project_id = str(project_doc["_id"])

    page_doc = await PageRepository(db).create(
        project_id=project_id,
        workspace_id=workspace_id,
        url_normalized=normalize_url(SAMPLE_PAGE_URL),
        title="Homepage",
    )
    page_id = str(page_doc["_id"])

    comment_repo = CommentRepository(db)
    original = await comment_repo.create(
        _sample_comment(
            page_id=page_id,
            workspace_id=workspace_id,
            body="Could we try a punchier headline here? Something that leads with the benefit.",
            layer="client",
            status="todo",
            author_type="guest",
            author_member_id=None,
        )
    )
    await comment_repo.create(
        _sample_comment(
            page_id=page_id,
            workspace_id=workspace_id,
            parent_id=str(original["_id"]),
            body="Good catch - I'll draft three options and flag the client's favorite here.",
            layer="team",
            status="in_progress",
            author_type="member",
            author_member_id=owner_user_id,
        )
    )
    await comment_repo.create(
        _sample_comment(
            page_id=page_id,
            workspace_id=workspace_id,
            body="This looks great, thanks for the quick turnaround!",
            layer="client",
            status="resolved",
            author_type="guest",
            author_member_id=None,
        )
    )
