from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

ShareLinkMode = Literal["snippet", "proxy"]


class ShareLinkCreate(BaseModel):
    mode: ShareLinkMode = "snippet"
    passcode: str | None = Field(default=None, min_length=4, max_length=64)
    expires_at: datetime | None = None


class ShareLinkOut(BaseModel):
    id: str
    project_id: str
    token: str
    mode: ShareLinkMode
    has_passcode: bool
    expires_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime


class ReviewResolveOut(BaseModel):
    project_id: str
    project_name: str
    mode: ShareLinkMode
    requires_passcode: bool
    # Milestone 9: the dashboard's ReviewEntryPage redirects a guest to the real site
    # (snippet mode) or Backline's own proxy route (proxy mode) after creating their
    # guest session - it needs the target site's origin to build either destination.
    target_origin: str


class GuestSessionCreate(BaseModel):
    share_token: str
    display_name: str = Field(min_length=1, max_length=100)
    email: EmailStr | None = None
    passcode: str | None = None


class GuestSessionOut(BaseModel):
    guest_session_token: str
    display_name: str
