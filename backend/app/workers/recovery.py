"""Arq worker entrypoint (06-Backend-Architecture.md §6.5). Run locally with:

    uv run arq app.workers.recovery.WorkerSettings

The job function itself is a thin wrapper - all the actual logic lives in
`modules/recovery_engine/service.py` as a plain, directly-testable async function, so
this file is the only place that knows about Arq's `ctx`/job-registration mechanics.
"""

from typing import Any

from arq.connections import RedisSettings

from app.core.config import get_settings
from app.core.db import get_db
from app.modules.recovery_engine.service import run_recovery_pipeline


async def run_recovery_pipeline_job(
    ctx: dict[str, Any], page_id: str, revision_id: str
) -> dict[str, int]:
    return await run_recovery_pipeline(get_db(), page_id=page_id, revision_id=revision_id)


class WorkerSettings:
    functions = [run_recovery_pipeline_job]
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)
