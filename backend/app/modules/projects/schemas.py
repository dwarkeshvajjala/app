from datetime import datetime

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    target_origin: str = Field(min_length=1, max_length=500)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    target_origin: str | None = Field(default=None, min_length=1, max_length=500)


class ProjectSettingsOut(BaseModel):
    proxy_mode: bool
    snippet_installed: bool


class ProjectOut(BaseModel):
    id: str
    workspace_id: str
    name: str
    target_origin: str
    created_by: str | None
    settings: ProjectSettingsOut
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
