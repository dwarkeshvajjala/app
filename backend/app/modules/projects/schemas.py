from datetime import datetime
from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, Field, field_validator, model_validator

ProjectType = Literal["website", "image", "pdf"]
Environment = Literal["live", "staging"]


def normalize_origin(value: str) -> str:
    value = value.strip()
    if "://" not in value:
        value = "https://" + value
    parsed = urlsplit(value)
    if (
        parsed.scheme not in ("https", "http")
        or not parsed.hostname
        or parsed.username
        or parsed.password
    ):
        raise ValueError("Use a valid HTTP or HTTPS review URL without credentials.")
    return value.rstrip("/")


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    target_origin: str = Field(default="", max_length=500)
    project_type: ProjectType = "website"
    environment: Environment = "live"
    client_id: str | None = None

    @field_validator("target_origin")
    @classmethod
    def clean_origin(cls, value: str) -> str:
        return normalize_origin(value) if value.strip() else ""

    @model_validator(mode="after")
    def website_requires_origin(self) -> "ProjectCreate":
        if self.project_type == "website" and not self.target_origin:
            raise ValueError("A website project requires a review URL.")
        if self.project_type != "website":
            self.target_origin = ""
        return self

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Project name is required.")
        return value.strip()


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    target_origin: str | None = Field(default=None, min_length=1, max_length=500)
    environment: Environment | None = None
    client_id: str | None = None

    @field_validator("target_origin")
    @classmethod
    def clean_origin(cls, value: str | None) -> str | None:
        return normalize_origin(value) if value is not None else None


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
    project_type: ProjectType = "website"
    environment: Environment = "live"
    client_id: str | None = None
