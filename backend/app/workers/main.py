"""Single Arq worker entrypoint (06-Backend-Architecture.md §6.5). Run locally with:

    uv run arq app.workers.main.WorkerSettings

One process registering every background job function, rather than one process per
module - the realistic production shape (most teams run one or a small, fixed number of
worker processes, not one per feature area). Each job function itself is a thin wrapper;
the actual logic lives in the relevant module's service.py as a plain, directly-testable
async function - this file is the only place that knows about Arq's `ctx`/registration/
cron mechanics.
"""

from arq import cron
from arq.connections import RedisSettings

from app.core.config import get_settings
from app.workers.integrations import dispatch_integration_event_job
from app.workers.notifications import send_daily_digests_job, send_guest_resolved_email_job
from app.workers.recovery import run_recovery_pipeline_job


class WorkerSettings:
    functions = [
        run_recovery_pipeline_job,
        dispatch_integration_event_job,
        send_guest_resolved_email_job,
        send_daily_digests_job,
    ]
    # 17.6: daily digest, once a day at 09:00 server time. Also runnable directly via
    # modules/notifications/digest.py's run_daily_digests(db) for tests/manual triggers
    # without waiting for the schedule.
    cron_jobs = [cron(send_daily_digests_job, hour=9, minute=0)]
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)
