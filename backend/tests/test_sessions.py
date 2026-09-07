"""M-01/M-05: GET /auth/sessions and DELETE /auth/sessions/{family_id} - session list
and family-revoke ownership (13-Authentication.md §13.6)."""

import pytest
from httpx import AsyncClient

from tests.helpers import login_via_otp


async def test_list_sessions_returns_typed_datetimes(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    login = await login_via_otp(client, monkeypatch, "sess1@example.com", "700001")
    resp = await client.get(
        "/api/v1/auth/sessions", headers={"Authorization": f"Bearer {login['access_token']}"}
    )
    assert resp.status_code == 200
    sessions = resp.json()
    assert len(sessions) == 1
    # M-05: SessionOut.created_at/last_active_at are now typed datetimes - Pydantic
    # serializes them as real ISO-8601 strings with an explicit offset, not a
    # hand-rolled `.isoformat().replace("+00:00", "Z")` string.
    assert "T" in sessions[0]["created_at"]
    assert sessions[0]["current"] is True


async def test_revoke_own_session_family_succeeds(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    login = await login_via_otp(client, monkeypatch, "sess2@example.com", "700002")
    headers = {"Authorization": f"Bearer {login['access_token']}"}
    sessions = (await client.get("/api/v1/auth/sessions", headers=headers)).json()
    family_id = sessions[0]["id"]

    resp = await client.delete(f"/api/v1/auth/sessions/{family_id}", headers=headers)
    assert resp.status_code == 204


async def test_cannot_revoke_another_users_session_family(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """M-01: revoke_session_family previously had no ownership check at all (the
    service literally said `# Optional: verify family belongs to user`) - any
    authenticated user could revoke any other user's session family just by knowing
    (or guessing) its opaque id."""
    victim = await login_via_otp(client, monkeypatch, "sess3-victim@example.com", "700003")
    victim_headers = {"Authorization": f"Bearer {victim['access_token']}"}
    victim_sessions = (await client.get("/api/v1/auth/sessions", headers=victim_headers)).json()
    victim_family_id = victim_sessions[0]["id"]

    attacker = await login_via_otp(client, monkeypatch, "sess3-attacker@example.com", "700004")
    attacker_headers = {"Authorization": f"Bearer {attacker['access_token']}"}

    resp = await client.delete(
        f"/api/v1/auth/sessions/{victim_family_id}", headers=attacker_headers
    )
    assert resp.status_code == 404

    # The victim's session must still be listed/active - the attacker's attempt had no effect.
    still_there = (await client.get("/api/v1/auth/sessions", headers=victim_headers)).json()
    assert any(s["id"] == victim_family_id for s in still_there)


async def test_revoking_unknown_family_id_is_404_not_500(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    login = await login_via_otp(client, monkeypatch, "sess4@example.com", "700005")
    headers = {"Authorization": f"Bearer {login['access_token']}"}

    resp = await client.delete("/api/v1/auth/sessions/not-a-real-family-id", headers=headers)
    assert resp.status_code == 404
