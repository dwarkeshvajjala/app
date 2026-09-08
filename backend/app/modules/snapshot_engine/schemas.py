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


class RevisionChangeSummary(BaseModel):
    moved: int = 0
    modified: int = 0
    removed: int = 0
    added: int = 0


class RevisionRecoverySummary(BaseModel):
    ok: int = 0
    low_confidence: int = 0
    orphaned: int = 0
    permanently_orphaned: int = 0


class RevisionHistoryOut(BaseModel):
    id: str
    page_id: str
    page_title: str | None
    page_url: str
    full_page_hash: str
    captured_at: datetime
    is_current: bool
    changes: RevisionChangeSummary
    recovery: RevisionRecoverySummary
