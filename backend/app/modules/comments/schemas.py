from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

Layer = Literal["client", "team"]
Status = Literal["todo", "in_progress", "resolved", "wont_fix"]
RecoveryStatus = Literal["ok", "low_confidence", "orphaned", "permanently_orphaned"]


class DomFingerprintIn(BaseModel):
    """node_hash/ancestor_path_hash use the same hash scheme as a snapshot's NodeRecord
    (09-Snapshot-Engine.md §9.6) - required for modules/anchor_engine to compare an
    anchor against a snapshot's nodes_index at all
    (docs/tdr/0004-anchor-snapshot-shared-hash-scheme.md)."""

    selector_path: str
    tag: str
    attributes: dict[str, str]
    node_hash: str
    ancestor_path_hash: str


class TextFingerprintIn(BaseModel):
    normalized_text: str
    # 64-bit SimHash (hex), for approximate matching when text changes slightly between
    # revisions - exact-string equality can't satisfy the "text edited" recovery case by
    # definition (08-Anchor-Engine.md §8.1, modules/anchor_engine).
    text_similarity_hash: str


class AnchorIn(BaseModel):
    """Tier 1 only in Milestone 4/5 (08-Anchor-Engine.md §8.1/§8.2)."""

    tier: Literal[1]
    dom_fingerprint: DomFingerprintIn
    text_fingerprint: TextFingerprintIn


class ContextIn(BaseModel):
    browser: str
    os: str
    viewport: dict[str, int]
    device_type: str
    url: str


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=10_000)
    layer: Layer = "client"
    anchor: AnchorIn
    context: ContextIn
    screenshot_key: str | None = None
    capture_status: Literal["ok", "failed"] = "ok"


class ReplyCreate(BaseModel):
    body: str = Field(min_length=1, max_length=10_000)
    layer: Layer = "client"


class CommentUpdate(BaseModel):
    body: str | None = Field(default=None, min_length=1, max_length=10_000)
    status: Status | None = None
    assignee_id: str | None = None
    due_at: datetime | None = None


class LayerToggleRequest(BaseModel):
    layer: Layer
    confirm: bool


class ReanchorRequest(BaseModel):
    anchor: AnchorIn


class CommentOut(BaseModel):
    id: str
    page_id: str
    parent_id: str | None
    author_type: Literal["member", "guest"]
    author_id: str
    layer: Layer
    body: str
    status: Status
    assignee_id: str | None
    due_at: datetime | None
    anchor: dict[str, Any]
    recovery_status: RecoveryStatus
    context: dict[str, Any]
    screenshot_url: str | None
    capture_status: Literal["ok", "failed"]
    created_at: datetime
    edited_at: datetime | None
