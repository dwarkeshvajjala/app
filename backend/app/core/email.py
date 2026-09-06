import asyncio
import logging

import httpx
import resend

from app.core.config import get_settings

logger = logging.getLogger("backline.email")


async def send_email(*, to: str, subject: str, html: str) -> None:
    """Sends an email using either Google Apps Script Web App, Resend, or falls back
    to logging the email in development/local environments."""
    settings = get_settings()

    # Priority 1: Google Apps Script Web App (Staging fallback)
    if settings.google_apps_script_url:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    settings.google_apps_script_url,
                    json={
                        "to": to,
                        "subject": subject,
                        "html": html,
                        "secret": settings.google_apps_script_secret,
                    },
                    follow_redirects=True,
                )
                response.raise_for_status()
                res_data = response.json()
                if res_data.get("status") != "success":
                    message = res_data.get("message", "Unknown error from Google Apps Script")
                    raise Exception(message)
                logger.info("Successfully sent email via Google Apps Script to %s", to)
                return
        except Exception as e:
            logger.exception("Failed to send email via Google Apps Script to %s: %s", to, e)
            raise

    # Priority 2: Resend (Production standard)
    if settings.resend_api_key:
        def _send() -> None:
            try:
                resend.api_key = settings.resend_api_key
                resend.Emails.send(
                    {
                        "from": settings.resend_from_address,
                        "to": [to],
                        "subject": subject,
                        "html": html,
                    }
                )
            except Exception as e:
                logger.exception("Failed to send email via Resend to %s: %s", to, e)
                raise

        await asyncio.to_thread(_send)
        return

    # Fallback: Local logging
    logger.warning(
        "Neither Google Apps Script URL nor RESEND_API_KEY set - logging email instead of "
        "sending. to=%s subject=%s\n%s",
        to,
        subject,
        html,
    )


