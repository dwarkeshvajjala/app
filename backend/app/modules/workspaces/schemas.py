from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

MemberRole = Literal["admin", "member"]


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)


class WorkspaceOut(BaseModel):
    id: str
    name: str
    slug: str
    plan: str
    created_at: datetime
    role: str | None = None


class MemberOut(BaseModel):
    id: str
    user_id: str
    email: str
    name: str
    avatar_url: str | None = None
    role: str
    created_at: datetime


class InviteMemberRequest(BaseModel):
    email: EmailStr
    role: MemberRole = "member"


class MemberRoleUpdateRequest(BaseModel):
    role: MemberRole
