from dataclasses import dataclass

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.errors import AuthenticationError, PermissionDeniedError
from app.core.security import InvalidTokenError, decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Session:
    """Resolved from a member's access JWT (13-Authentication.md §13.3). Guest-session
    resolution (share-link tokens, §13.4) is added in Milestone 2 alongside share links -
    this dependency only handles the member path for now."""

    user_id: str
    workspace_id: str | None
    role: str | None


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


def require_workspace_match(session: Session, workspace_id: str) -> None:
    """Cross-tenant guarantee (03-System-Architecture.md §3.5): a session token scoped
    to workspace A can never authorize access to workspace B's resources."""
    if session.workspace_id != workspace_id:
        raise PermissionDeniedError("Session is not scoped to this workspace.")
