from datetime import datetime
from typing import Any

from pydantic import BaseModel


class SnapshotSubmit(BaseModel):
    viewport: dict[str, int]
    node_tree: dict[str, Any]
    nodes_index: dict[str, Any]
    full_page_hash: str


class RevisionOut(BaseModel):
    id: str
    page_id: str
    full_page_hash: str
    captured_at: datetime
    is_current: bool
    created_new: bool
