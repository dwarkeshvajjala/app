from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class ClientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    contact_name: str = Field(default="", max_length=200)
    email: EmailStr | None = None


class ClientUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    contact_name: str | None = Field(default=None, max_length=200)
    email: EmailStr | None = None


class ClientOut(BaseModel):
    id: str
    workspace_id: str
    name: str
    contact_name: str
    email: str | None
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None
