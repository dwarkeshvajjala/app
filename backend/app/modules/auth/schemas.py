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


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    avatar_url: str | None = None


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
