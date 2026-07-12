import gzip
import json
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.modules.revision_engine.diff import compute_diff
from app.modules.revision_engine.repository import RevisionDiffRepository
from app.modules.storage.r2_client import download_bytes


async def load_snapshot_payload(snapshot_key: str) -> dict[str, Any]:
    """Reverses submit_snapshot's gzip+JSON upload (snapshot_engine/service.py)."""
    compressed = await download_bytes(snapshot_key)
    payload: dict[str, Any] = json.loads(gzip.decompress(compressed))
    return payload


async def compute_and_store_diff(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    *,
    page_id: str,
    workspace_id: str,
    from_revision_id: str,
    to_revision_id: str,
    old_nodes_index: dict[str, dict[str, Any]],
    new_nodes_index: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    diff = compute_diff(old_nodes_index, new_nodes_index)
    return await RevisionDiffRepository(db).create(
        page_id=page_id,
        workspace_id=workspace_id,
        from_revision_id=from_revision_id,
        to_revision_id=to_revision_id,
        diff=diff,
    )
