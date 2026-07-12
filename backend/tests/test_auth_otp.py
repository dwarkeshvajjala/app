from typing import Any

import pytest
from httpx import AsyncClient
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.modules.auth import service as auth_service
from app.modules.auth.router import REFRESH_COOKIE_NAME


async def _request_and_verify(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    email: str,
    code: str = "123456",
) -> dict[str, Any]:
    monkeypatch.setattr(auth_service, "generate_otp_code", lambda: code)
    response = await client.post("/api/v1/auth/otp/request", json={"email": email})
    assert response.status_code == 204

    verify_response = await client.post(
        "/api/v1/auth/otp/verify", json={"email": email, "code": code}
    )
    assert verify_response.status_code == 200
    body = dict(verify_response.json())
    body["refresh_token"] = verify_response.cookies.get(REFRESH_COOKIE_NAME)
    return body


async def test_otp_request_then_verify_creates_user_and_issues_tokens(
    client: AsyncClient, db: AsyncIOMotorDatabase[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    body = await _request_and_verify(client, monkeypatch, "new-user@example.com")

    assert body["user"]["email"] == "new-user@example.com"
    assert body["access_token"]
    assert body["refresh_token"]

    user_doc = await db.users.find_one({"email": "new-user@example.com"})
    assert user_doc is not None
    assert user_doc["auth_providers"] == ["email_otp"]


async def test_otp_verify_rejects_wrong_code(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(auth_service, "generate_otp_code", lambda: "111111")
    await client.post("/api/v1/auth/otp/request", json={"email": "wrong-code@example.com"})

    response = await client.post(
        "/api/v1/auth/otp/verify", json={"email": "wrong-code@example.com", "code": "999999"}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_otp_verify_rejects_reused_code(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    body = await _request_and_verify(client, monkeypatch, "reuse@example.com", code="222222")
    assert body["access_token"]

    second_attempt = await client.post(
        "/api/v1/auth/otp/verify", json={"email": "reuse@example.com", "code": "222222"}
    )
    assert second_attempt.status_code == 422


async def test_otp_locks_out_after_max_attempts(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(auth_service, "generate_otp_code", lambda: "333333")
    await client.post("/api/v1/auth/otp/request", json={"email": "lockout@example.com"})

    for _ in range(5):
        resp = await client.post(
            "/api/v1/auth/otp/verify", json={"email": "lockout@example.com", "code": "000000"}
        )
        assert resp.status_code == 422

    final = await client.post(
        "/api/v1/auth/otp/verify", json={"email": "lockout@example.com", "code": "333333"}
    )
    assert final.status_code == 422
    assert "Too many attempts" in final.json()["error"]["message"]


async def test_refresh_token_rotates_and_rejects_reuse(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    body = await _request_and_verify(client, monkeypatch, "refresh@example.com", code="444444")
    old_refresh = body["refresh_token"]

    # The client's cookie jar already holds the fresh cookie from login; this call
    # exercises the normal, jar-driven refresh path.
    refreshed = await client.post("/api/v1/auth/refresh")
    assert refreshed.status_code == 200
    new_refresh = refreshed.cookies.get(REFRESH_COOKIE_NAME)
    assert new_refresh is not None
    assert new_refresh != old_refresh

    # Reusing the now-rotated old token is theft-detection territory (13-Authentication.md
    # §13.6): explicitly resend the *old* cookie value (bypassing the jar, which has
    # already moved on to new_refresh) to simulate a replayed/stolen token.
    client.cookies.set(REFRESH_COOKIE_NAME, old_refresh)
    reuse_attempt = await client.post("/api/v1/auth/refresh")
    assert reuse_attempt.status_code == 401

    # ...and it must revoke the entire token family, including the token that
    # descended from it - so even the legitimately-rotated new_refresh stops working.
    client.cookies.set(REFRESH_COOKIE_NAME, new_refresh)
    new_token_now_revoked = await client.post("/api/v1/auth/refresh")
    assert new_token_now_revoked.status_code == 401


async def test_refresh_without_cookie_is_rejected(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/refresh")
    assert response.status_code == 401


async def test_logout_revokes_refresh_token(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    body = await _request_and_verify(client, monkeypatch, "logout@example.com", code="555555")

    logout_resp = await client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )
    assert logout_resp.status_code == 204

    # Explicitly re-present the revoked token (e.g. a second tab that still has it
    # cached) rather than relying on the jar, which logout's delete_cookie already
    # cleared client-side - this proves server-side revocation, not just cookie absence.
    client.cookies.set(REFRESH_COOKIE_NAME, body["refresh_token"])
    refresh_after_logout = await client.post("/api/v1/auth/refresh")
    assert refresh_after_logout.status_code == 401
