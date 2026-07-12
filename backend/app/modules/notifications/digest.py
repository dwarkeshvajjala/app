from datetime import UTC, datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.email import send_email
from app.core.mongo_utils import to_object_id
from app.modules.auth.repository import UserRepository
from app.modules.workspaces.repository import MembershipRepository

# 17.6: "Instant or daily digest (member-configurable per workspace, default: daily)."
# Only the daily digest is implemented this milestone - a per-member instant/daily
# preference needs its own settings UI and a schema field on `memberships`, which is a
# real, separate piece of scope deliberately deferred (docs/tdr/0009), not half-built
# here. Every member currently gets the daily digest; there is no instant mode yet.


async def _project_name_for_page(
    db: AsyncIOMotorDatabase[dict[str, Any]], page_id: str, cache: dict[str, str]
) -> str:
    if page_id in cache:
        return cache[page_id]
    page = await db.pages.find_one({"_id": to_object_id(page_id)})
    name = "Unknown project"
    if page is not None:
        project = await db.projects.find_one({"_id": to_object_id(page["project_id"])})
        if project is not None:
            name = str(project["name"])
    cache[page_id] = name
    return name


def _render_digest_html(grouped: dict[str, list[dict[str, Any]]]) -> str:
    sections = []
    for project_name, comments in grouped.items():
        items = "".join(f"<li>{c['body'][:200]}</li>" for c in comments)
        sections.append(f"<h3>{project_name}</h3><ul>{items}</ul>")
    return "<p>New comments since your last digest:</p>" + "".join(sections)


async def run_digest_for_workspace(
    db: AsyncIOMotorDatabase[dict[str, Any]], workspace_doc: dict[str, Any]
) -> int:
    """Returns the number of comments included (0 if nothing new, or on a workspace's
    first-ever run - there's no prior checkpoint to diff against, so it just establishes
    one rather than emailing the workspace's entire history on day one)."""
    workspace_id = str(workspace_doc["_id"])
    since = workspace_doc.get("last_digest_sent_at")
    now = datetime.now(UTC)

    if since is None:
        await db.workspaces.update_one(
            {"_id": workspace_doc["_id"]}, {"$set": {"last_digest_sent_at": now}}
        )
        return 0

    comments = await db.comments.find(
        {"workspace_id": workspace_id, "created_at": {"$gt": since}}
    ).to_list(length=None)

    if not comments:
        await db.workspaces.update_one(
            {"_id": workspace_doc["_id"]}, {"$set": {"last_digest_sent_at": now}}
        )
        return 0

    project_name_cache: dict[str, str] = {}
    grouped: dict[str, list[dict[str, Any]]] = {}
    for comment in comments:
        project_name = await _project_name_for_page(db, comment["page_id"], project_name_cache)
        grouped.setdefault(project_name, []).append(comment)

    html = _render_digest_html(grouped)
    subject = (
        f"{len(comments)} new comment{'s' if len(comments) != 1 else ''} - {workspace_doc['name']}"
    )

    members = await MembershipRepository(db).list_for_workspace(workspace_id)
    for membership in members:
        user_doc = await UserRepository(db).find_by_id(membership["user_id"])
        if user_doc is None:
            continue
        await send_email(to=user_doc["email"], subject=subject, html=html)

    await db.workspaces.update_one(
        {"_id": workspace_doc["_id"]}, {"$set": {"last_digest_sent_at": now}}
    )
    return len(comments)


async def run_daily_digests(db: AsyncIOMotorDatabase[dict[str, Any]]) -> dict[str, int]:
    workspaces = await db.workspaces.find({}).to_list(length=None)
    results = {}
    for workspace_doc in workspaces:
        count = await run_digest_for_workspace(db, workspace_doc)
        results[str(workspace_doc["_id"])] = count
    return results
