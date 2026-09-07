from datetime import datetime

from pydantic import BaseModel, Field


class PageRegister(BaseModel):
    project_id: str
    url: str = Field(min_length=1, max_length=2000)
    title: str | None = Field(default=None, max_length=500)


class PageUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=500)
    sort_order: int | None = None


class PageOut(BaseModel):
    id: str
    project_id: str
    url_normalized: str
    title: str | None
    sort_order: int = 0
    first_seen_at: datetime
    latest_revision_id: str | None
