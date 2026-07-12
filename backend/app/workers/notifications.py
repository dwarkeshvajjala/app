"""Arq job functions for email (17-Notifications-Integrations.md §17.6). Registered by
app/workers/main.py, the single worker entrypoint."""

from typing import Any

from app.core.db import get_db
from app.core.email import send_email
from app.modules.notifications.digest import run_daily_digests


async def send_guest_resolved_email_job(
    ctx: dict[str, Any], guest_email: str, guest_name: str, comment_body: str
) -> None:
    await send_email(
        to=guest_email,
        subject="Your feedback was addressed",
        html=(
            f"<p>Hi {guest_name},</p>"
            f"<p>Your comment has been marked resolved:</p>"
            f"<blockquote>{comment_body}</blockquote>"
        ),
    )


async def send_daily_digests_job(ctx: dict[str, Any]) -> dict[str, int]:
    return await run_daily_digests(get_db())
