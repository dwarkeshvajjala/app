from collections.abc import Callable, Coroutine
from enum import StrEnum
from typing import Any

from fastapi import Depends

from app.core.errors import PermissionDeniedError
from app.core.session import Session, get_current_session


class Role(StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    GUEST = "guest"


# Single source of truth for the permission matrix (13-Authentication.md §13.5).
# Every endpoint checks against this dict via require_permission() - never a
# hand-duplicated if-role-in(...) check in a router (Rule 3).
PERMISSIONS: dict[str, frozenset[Role]] = {
    "workspace:view_settings": frozenset({Role.OWNER, Role.ADMIN, Role.MEMBER}),
    "workspace:manage_billing": frozenset({Role.OWNER}),
    "workspace:update_settings": frozenset({Role.OWNER, Role.ADMIN}),
    "member:invite": frozenset({Role.OWNER, Role.ADMIN}),
    "member:remove": frozenset({Role.OWNER, Role.ADMIN}),
    "member:role_change": frozenset({Role.OWNER, Role.ADMIN}),
    "project:manage": frozenset({Role.OWNER, Role.ADMIN, Role.MEMBER}),
    "share_link:manage": frozenset({Role.OWNER, Role.ADMIN, Role.MEMBER}),
    "integration:manage": frozenset({Role.OWNER, Role.ADMIN}),
    "comment:view_client": frozenset({Role.OWNER, Role.ADMIN, Role.MEMBER, Role.GUEST}),
    "comment:view_team": frozenset({Role.OWNER, Role.ADMIN, Role.MEMBER}),
    "comment:toggle_layer": frozenset({Role.OWNER, Role.ADMIN, Role.MEMBER}),
    "comment:update_status": frozenset({Role.OWNER, Role.ADMIN, Role.MEMBER}),
    # Dashboard moderation - any comment in the caller's own workspace, regardless of
    # authorship (same "member can moderate any comment" trust level update_status
    # already grants). Distinct from the widget's own-author-only guest self-service
    # delete (comments/service.py's _require_own_comment), which isn't gated by role.
    "comment:delete": frozenset({Role.OWNER, Role.ADMIN, Role.MEMBER}),
    "comment:create": frozenset({Role.OWNER, Role.ADMIN, Role.MEMBER, Role.GUEST}),
    "comment:reply": frozenset({Role.OWNER, Role.ADMIN, Role.MEMBER, Role.GUEST}),
    "comment:reanchor": frozenset({Role.OWNER, Role.ADMIN, Role.MEMBER}),
    # 17.3/17.4: "Create task from comment" / "create card from comment" - member
    # (owner/admin/member), not guest - matches every other comment-mutating action.
    "comment:create_integration_task": frozenset({Role.OWNER, Role.ADMIN, Role.MEMBER}),
    "notification:manage": frozenset({Role.OWNER, Role.ADMIN, Role.MEMBER}),
}


def role_allows(action: str, role: Role) -> bool:
    return role in PERMISSIONS[action]


def require_permission(action: str) -> Callable[..., Coroutine[Any, Any, Session]]:
    """FastAPI dependency factory. Requires a workspace-scoped session (role set via
    POST /auth/switch-workspace, 13-Authentication.md §13.3) whose role is permitted
    for `action` per the PERMISSIONS matrix above."""

    async def dependency(session: Session = Depends(get_current_session)) -> Session:
        if session.role is None:
            raise PermissionDeniedError("No active workspace context.")
        if not role_allows(action, Role(session.role)):
            raise PermissionDeniedError(f"Role '{session.role}' cannot perform '{action}'.")
        return session

    return dependency
