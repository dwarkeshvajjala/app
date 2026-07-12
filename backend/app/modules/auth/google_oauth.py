import asyncio
from dataclasses import dataclass

import httpx
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from app.core.config import get_settings
from app.core.errors import ExternalServiceError


@dataclass(frozen=True)
class GoogleUserInfo:
    email: str
    name: str
    avatar_url: str | None
    email_verified: bool


async def exchange_code_for_user_info(code: str) -> GoogleUserInfo:
    """Standard Authorization Code flow (13-Authentication.md §13.1): the code is
    exchanged server-side so the client secret never reaches the frontend, then the
    returned id_token's signature is verified against Google's published certs."""
    settings = get_settings()

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": settings.google_oauth_client_id,
                    "client_secret": settings.google_oauth_client_secret,
                    "redirect_uri": settings.google_oauth_redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            token_response.raise_for_status()
        except httpx.HTTPError as exc:
            raise ExternalServiceError(f"Google token exchange failed: {exc}") from exc

    id_token_value = token_response.json().get("id_token")
    if not id_token_value:
        raise ExternalServiceError("Google token response did not include an id_token.")

    try:
        claims = await asyncio.to_thread(
            google_id_token.verify_oauth2_token,
            id_token_value,
            google_requests.Request(),  # type: ignore[no-untyped-call]
            settings.google_oauth_client_id,
        )
    except ValueError as exc:
        raise ExternalServiceError(f"Google id_token verification failed: {exc}") from exc

    return GoogleUserInfo(
        email=claims["email"],
        name=claims.get("name", claims["email"]),
        avatar_url=claims.get("picture"),
        email_verified=claims.get("email_verified", False),
    )
