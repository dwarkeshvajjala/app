from typing import Any

from app.core.db import get_db
from app.modules.projects.deletion_service import resume_confirmed_hard_delete


async def resume_project_hard_delete_job(
    ctx: dict[str, Any],
    *,
    workspace_id: str,
    project_id: str,
    correlation_id: str,
) -> None:
    """Retry from durable tombstones; all storage/Mongo/event operations are idempotent."""
    del ctx
    await resume_confirmed_hard_delete(
        get_db(),
        workspace_id=workspace_id,
        project_id=project_id,
        correlation_id=correlation_id,
    )
