from typing import Any

import pytest
from httpx import AsyncClient
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.feature_flags import load_feature_flags
from app.modules.feature_flags.repository import FeatureFlagRepository
from tests.helpers import create_workspace_and_get_owner_token, login_via_otp


async def test_workspace_specific_flag_overrides_the_global_default(
    db: AsyncIOMotorDatabase[dict[str, Any]],
) -> None:
    repo = FeatureFlagRepository(db)
    await repo.set_flag("asana-integration", workspace_id=None, enabled=False)
    await repo.set_flag("asana-integration", workspace_id="ws_1", enabled=True)

    assert (await load_feature_flags(db, "ws_1"))["asana-integration"] is True
    # A different workspace only sees the global default.
    assert (await load_feature_flags(db, "ws_2"))["asana-integration"] is False


async def test_missing_flag_defaults_to_false(db: AsyncIOMotorDatabase[dict[str, Any]]) -> None:
    flags = await load_feature_flags(db, "some-workspace")
    assert flags.get("never-set-this-flag", False) is False


async def test_switch_workspace_response_carries_feature_flags(
    client: AsyncClient, db: AsyncIOMotorDatabase[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    workspace_id, _ = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="flags1@example.com", code="920001", workspace_name="Flags1"
    )
    await FeatureFlagRepository(db).set_flag(
        "asana-integration", workspace_id=workspace_id, enabled=True
    )

    login = await login_via_otp(client, monkeypatch, "flags1@example.com", "920002")
    resp = await client.post(
        "/api/v1/auth/switch-workspace",
        json={"workspace_id": workspace_id},
        headers={"Authorization": f"Bearer {login['access_token']}"},
    )
    assert resp.status_code == 200
    assert resp.json()["feature_flags"] == {"asana-integration": True}
