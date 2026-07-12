from datetime import datetime

from pydantic import BaseModel, Field


class PageRegister(BaseModel):
    project_id: str
    url: str = Field(min_length=1, max_length=2000)
    title: str | None = Field(default=None, max_length=500)


class PageOut(BaseModel):
    id: str
    project_id: str
    url_normalized: str
    title: str | None
    first_seen_at: datetime
    latest_revision_id: str | None
