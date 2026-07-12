from typing import Any
from unittest.mock import patch

import pytest
from httpx import AsyncClient
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.db import get_db
from app.core.errors import ValidationError
from app.modules.auth import service as auth_service
from app.modules.auth.google_oauth import GoogleUserInfo

# These tests mock at the exchange_code_for_user_info() boundary rather than deep in
# httpx/google-auth internals: that function is a thin wrapper around Google's own
# HTTP API, so the meaningful thing to unit-test is our own service logic given a
# result from it - not Google's SDK, and not by globally patching httpx.AsyncClient
# (which would also intercept this test's own in-process client-to-app calls).


async def test_login_with_google_creates_user_on_first_login(
    client: AsyncClient, db: AsyncIOMotorDatabase[dict[str, Any]]
) -> None:
    user_info = GoogleUserInfo(
        email="googleuser@example.com",
        name="Google User",
        avatar_url="https://example.com/avatar.png",
        email_verified=True,
    )

    async def _fake(code: str) -> GoogleUserInfo:
        return user_info

    with patch("app.modules.auth.service.exchange_code_for_user_info", side_effect=_fake):
        response = await client.post("/api/v1/auth/google/callback", json={"code": "auth-code"})

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["email"] == "googleuser@example.com"

    user_doc = await db.users.find_one({"email": "googleuser@example.com"})
    assert user_doc is not None
    assert user_doc["auth_providers"] == ["google"]


async def test_login_with_google_rejects_unverified_email(client: AsyncClient) -> None:
    user_info = GoogleUserInfo(
        email="unverified@example.com", name="Unverified", avatar_url=None, email_verified=False
    )

    async def _fake(code: str) -> GoogleUserInfo:
        return user_info

    with patch("app.modules.auth.service.exchange_code_for_user_info", side_effect=_fake):
        response = await client.post("/api/v1/auth/google/callback", json={"code": "auth-code"})

    assert response.status_code == 422


async def test_login_with_google_reuses_existing_user_on_second_login(
    client: AsyncClient, db: AsyncIOMotorDatabase[dict[str, Any]]
) -> None:
    user_info = GoogleUserInfo(
        email="returning@example.com", name="Returning", avatar_url=None, email_verified=True
    )

    async def _fake(code: str) -> GoogleUserInfo:
        return user_info

    with patch("app.modules.auth.service.exchange_code_for_user_info", side_effect=_fake):
        first = await client.post("/api/v1/auth/google/callback", json={"code": "auth-code-1"})
        second = await client.post("/api/v1/auth/google/callback", json={"code": "auth-code-2"})

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["user"]["id"] == second.json()["user"]["id"]

    matching_users = await db.users.count_documents({"email": "returning@example.com"})
    assert matching_users == 1


async def test_login_with_google_propagates_exchange_failure() -> None:
    async def _fake(code: str) -> GoogleUserInfo:
        raise ValidationError("Google account email is not verified.")

    with patch("app.modules.auth.service.exchange_code_for_user_info", side_effect=_fake):
        with pytest.raises(ValidationError):
            await auth_service.login_with_google(get_db(), "bad-code")
