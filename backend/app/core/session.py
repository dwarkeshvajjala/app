from dataclasses import dataclass

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.errors import AuthenticationError, PermissionDeniedError
from app.core.security import InvalidTokenError, decode_access_token, decode_guest_token

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Session:
    """Resolved from a member's access JWT (13-Authentication.md §13.3)."""

    user_id: str
    workspace_id: str | None
    role: str | None


@dataclass(frozen=True)
class GuestSession:
    """Resolved from the `X-Guest-Session` header (13-Authentication.md §13.4). Scoped
    to exactly one share_link_id - endpoints that accept guests must check the guest's
    share_link_id against the resource being accessed, the same way member endpoints
    check workspace_id (require_workspace_match)."""

    guest_session_id: str
    share_link_id: str


async def get_current_session(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> Session:
    if credentials is None:
        raise AuthenticationError("Missing bearer token.")
    try:
        claims = decode_access_token(credentials.credentials)
    except InvalidTokenError as exc:
        raise AuthenticationError("Invalid or expired token.") from exc

    return Session(user_id=claims.sub, workspace_id=claims.workspace_id, role=claims.role)


async def get_guest_session(
    x_guest_session: str | None = Header(default=None),
) -> GuestSession:
    if x_guest_session is None:
        raise AuthenticationError("Missing X-Guest-Session header.")
    try:
        claims = decode_guest_token(x_guest_session)
    except InvalidTokenError as exc:
        raise AuthenticationError("Invalid or expired guest session.") from exc

    return GuestSession(guest_session_id=claims.sub, share_link_id=claims.share_link_id)


def require_workspace_match(session: Session, workspace_id: str) -> None:
    """Cross-tenant guarantee (03-System-Architecture.md §3.5): a session token scoped
    to workspace A can never authorize access to workspace B's resources."""
    if session.workspace_id != workspace_id:
        raise PermissionDeniedError("Session is not scoped to this workspace.")


def require_workspace_context(session: Session) -> str:
    """For routes scoped by resource id rather than a `{workspace_id}` path param
    (e.g. `/projects/{project_id}`): `require_permission()` already guarantees
    `session.role` is set, which is only ever issued together with `workspace_id`
    (13-Authentication.md §13.3) - this narrows the type and fails loudly if that
    invariant is ever violated, rather than silently comparing against an empty string."""
    if session.workspace_id is None:
        raise PermissionDeniedError("No active workspace context.")
    return session.workspace_id


def require_share_link_match(guest: GuestSession, share_link_id: str) -> None:
    """Same cross-tenant guarantee, guest side: a guest token from Project A's link is
    rejected by any endpoint resolving Project B's resources (13-Authentication.md §13.4)."""
    if guest.share_link_id != share_link_id:
        raise PermissionDeniedError("Guest session is not scoped to this share link.")
