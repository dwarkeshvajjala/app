import asyncio
import logging

import resend

from app.core.config import get_settings

logger = logging.getLogger("backline.email")


async def send_email(*, to: str, subject: str, html: str) -> None:
    """Thin Resend wrapper (04-Technology-Decisions.md). Resend's SDK is sync,
    so the actual call runs in a thread to keep the request path async (Rule 2,
    02-Engineering-Principles.md). Without a configured API key (local dev without
    real credentials), the email is logged instead of sent - this path never
    executes once RESEND_API_KEY is set in a real environment."""
    settings = get_settings()

    if not settings.resend_api_key:
        logger.warning(
            "RESEND_API_KEY not set - logging email instead of sending. to=%s subject=%s\n%s",
            to,
            subject,
            html,
        )
        return

    def _send() -> None:
        resend.api_key = settings.resend_api_key
        resend.Emails.send(
            {
                "from": settings.resend_from_address,
                "to": [to],
                "subject": subject,
                "html": html,
            }
        )

    await asyncio.to_thread(_send)
