from fastapi import APIRouter, Depends

from app.core.db import get_db
from app.core.session import Actor, get_current_actor
from app.modules.snapshot_engine import service as snapshot_service
from app.modules.snapshot_engine.schemas import RevisionOut, SnapshotSubmit

router = APIRouter(tags=["snapshots"])


@router.post("/pages/{page_id}/snapshots", response_model=RevisionOut, status_code=201)
async def submit_snapshot(
    page_id: str, body: SnapshotSubmit, actor: Actor = Depends(get_current_actor)
) -> RevisionOut:
    return await snapshot_service.submit_snapshot(
        get_db(),
        actor=actor,
        page_id=page_id,
        viewport=body.viewport,
        node_tree=body.node_tree,
        nodes_index=body.nodes_index,
        full_page_hash=body.full_page_hash,
    )
