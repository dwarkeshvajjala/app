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
