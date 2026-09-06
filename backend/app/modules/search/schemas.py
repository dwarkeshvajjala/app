from typing import Literal

from pydantic import BaseModel


class SearchResult(BaseModel):
    kind: Literal["project", "ticket", "person", "client"]
    id: str
    title: str
    project_id: str | None = None
    page_id: str | None = None


class SearchOut(BaseModel):
    items: list[SearchResult]
    has_more: bool = False
