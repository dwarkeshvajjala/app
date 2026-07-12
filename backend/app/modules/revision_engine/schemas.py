from datetime import datetime

from pydantic import BaseModel


class RevisionDiffOut(BaseModel):
    """Mirrors 11-Database.md §11.9's `revision_diffs` shape exactly. `moved`/`modified`
    node ids are keyed to the *new* revision's nodes_index (where you'd actually look
    them up today); `removed` ids are keyed to the *old* revision's, since they no
    longer exist in the new one."""

    id: str
    page_id: str
    workspace_id: str
    from_revision_id: str
    to_revision_id: str
    moved_node_ids: list[str]
    modified_node_ids: list[str]
    removed_node_ids: list[str]
    added_node_ids: list[str]
    created_at: datetime
