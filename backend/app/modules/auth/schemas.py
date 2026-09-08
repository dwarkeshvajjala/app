from datetime import datetime

from pydantic import BaseModel, EmailStr


class GoogleCallbackRequest(BaseModel):
    code: str


class OtpRequestRequest(BaseModel):
    email: EmailStr


class OtpVerifyRequest(BaseModel):
    email: EmailStr
    code: str


class SwitchWorkspaceRequest(BaseModel):
    workspace_id: str


class UserPreferencesOut(BaseModel):
    notify_on_assignment: bool = True
    notify_on_mention: bool = True
    notify_on_reply: bool = True
    notify_on_status_change: bool = True
    daily_digest: bool = True


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    avatar_url: str | None = None
    preferences: UserPreferencesOut = UserPreferencesOut()


class UserUpdateRequest(BaseModel):
    name: str | None = None
    preferences: UserPreferencesOut | None = None


class TokenPairOut(BaseModel):
    """The refresh token itself never appears in a JSON body - it's set as an
    httpOnly cookie by the router (13-Authentication.md §13.6)."""

    access_token: str
    user: UserOut


class AccessTokenOut(BaseModel):
    access_token: str
    # 18-Storage-Deployment.md §18.7: "backed by a value returned in the auth/bootstrap
    # response, not a separate polled endpoint" - empty for a not-yet-workspace-scoped
    # token (flags are meaningless before a workspace is chosen).
    feature_flags: dict[str, bool] = {}


class SessionOut(BaseModel):
    """FD-AUD-011: Represents an active refresh token family for the user.
    M-05: created_at/last_active_at are typed datetimes (Pydantic serializes to a real
    ISO-8601 string with timezone on the wire) rather than hand-formatted str fields -
    API contracts stay generated/typed end-to-end per 06-Backend-Architecture.md §2.3,
    and the frontend gets a real Date-parseable value instead of an ad hoc string."""

    id: str  # maps to the family_id
    current: bool  # true if this is the session making the request
    browser: str | None
    os: str | None
    ip_address: str | None
    created_at: datetime
    last_active_at: datetime
