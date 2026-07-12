"""Arq job function (06-Backend-Architecture.md §6.5) - registered by app/workers/main.py,
the single worker entrypoint (see that file for why one process, not one per module).
The job itself is a thin wrapper - all the actual logic lives in
modules/recovery_engine/service.py as a plain, directly-testable async function."""

from typing import Any

from app.core.db import get_db
from app.modules.recovery_engine.service import run_recovery_pipeline


async def run_recovery_pipeline_job(
    ctx: dict[str, Any], page_id: str, revision_id: str
) -> dict[str, int]:
    return await run_recovery_pipeline(get_db(), page_id=page_id, revision_id=revision_id)
