"""Webhook Retry Engine (17-Notifications-Integrations.md §17.7): 3 retries at
5s/30s/5min, then dead-letter. Calls `dispatch_integration_event_job` directly - the
same function the Arq worker calls (app/workers/main.py) - with a synthetic `ctx`
carrying `job_try`, the same technique test_recovery_engine.py uses for its background
job."""

from typing import Any

import httpx
import pytest
from arq.worker import Retry
from httpx import AsyncClient
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.workers.integrations import dispatch_integration_event_job
from tests.helpers import create_project_with_guest_session
from tests.test_integrations import _register_page_and_comment, mock_third_party_http


async def _connect_slack(client: AsyncClient, ctx: dict[str, Any]) -> str:
    with mock_third_party_http({"hooks.slack.com": httpx.Response(200, text="ok")}):
        resp = await client.post(
            f"/api/v1/workspaces/{ctx['workspace_id']}/integrations",
            json={"type": "slack", "webhook_url": "https://hooks.slack.com/services/x"},
            headers=ctx["owner_headers"],
        )
    integration_id: str = resp.json()["id"]
    return integration_id


async def test_successful_delivery_does_not_retry(
    client: AsyncClient, db: AsyncIOMotorDatabase[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="retry1@example.com", code="930001", workspace_name="RT1"
    )
    integration_id = await _connect_slack(client, ctx)
    _, comment_id = await _register_page_and_comment(client, ctx)

    with mock_third_party_http({"hooks.slack.com": httpx.Response(200, text="ok")}) as fake:
        await dispatch_integration_event_job(
            {"job_try": 1}, integration_id, "comment.created", comment_id
        )
    assert len(fake.calls) == 1


async def test_first_failure_retries_after_5_seconds(
    client: AsyncClient, db: AsyncIOMotorDatabase[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="retry2@example.com", code="930002", workspace_name="RT2"
    )
    integration_id = await _connect_slack(client, ctx)
    _, comment_id = await _register_page_and_comment(client, ctx)

    with mock_third_party_http({"hooks.slack.com": httpx.Response(500, text="error")}):
        with pytest.raises(Retry) as exc_info:
            await dispatch_integration_event_job(
                {"job_try": 1}, integration_id, "comment.created", comment_id
            )
    assert exc_info.value.defer_score == 5_000


async def test_second_failure_retries_after_30_seconds(
    client: AsyncClient, db: AsyncIOMotorDatabase[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="retry3@example.com", code="930003", workspace_name="RT3"
    )
    integration_id = await _connect_slack(client, ctx)
    _, comment_id = await _register_page_and_comment(client, ctx)

    with mock_third_party_http({"hooks.slack.com": httpx.Response(500, text="error")}):
        with pytest.raises(Retry) as exc_info:
            await dispatch_integration_event_job(
                {"job_try": 2}, integration_id, "comment.created", comment_id
            )
    assert exc_info.value.defer_score == 30_000


async def test_third_failure_retries_after_5_minutes(
    client: AsyncClient, db: AsyncIOMotorDatabase[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="retry4@example.com", code="930004", workspace_name="RT4"
    )
    integration_id = await _connect_slack(client, ctx)
    _, comment_id = await _register_page_and_comment(client, ctx)

    with mock_third_party_http({"hooks.slack.com": httpx.Response(500, text="error")}):
        with pytest.raises(Retry) as exc_info:
            await dispatch_integration_event_job(
                {"job_try": 3}, integration_id, "comment.created", comment_id
            )
    assert exc_info.value.defer_score == 300_000


async def test_fourth_failure_dead_letters_instead_of_retrying(
    client: AsyncClient, db: AsyncIOMotorDatabase[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="retry5@example.com", code="930005", workspace_name="RT5"
    )
    integration_id = await _connect_slack(client, ctx)
    _, comment_id = await _register_page_and_comment(client, ctx)

    with mock_third_party_http({"hooks.slack.com": httpx.Response(500, text="error")}):
        # No Retry raised on the 4th attempt - the job just returns.
        await dispatch_integration_event_job(
            {"job_try": 4}, integration_id, "comment.created", comment_id
        )

    events = await db.events.find({"type": "webhook.delivery_failed"}).to_list(length=10)
    assert len(events) == 1
    assert events[0]["payload_json"]["integration_id"] == integration_id

    notifications = await db.notifications.find(
        {"workspace_id": ctx["workspace_id"], "type": "integration_disconnected"}
    ).to_list(length=10)
    assert len(notifications) == 1
    assert notifications[0]["payload_json"]["integration_id"] == integration_id


async def test_job_is_a_no_op_if_integration_was_disconnected_first(
    client: AsyncClient, db: AsyncIOMotorDatabase[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="retry6@example.com", code="930006", workspace_name="RT6"
    )
    integration_id = await _connect_slack(client, ctx)
    _, comment_id = await _register_page_and_comment(client, ctx)

    await client.delete(f"/api/v1/integrations/{integration_id}", headers=ctx["owner_headers"])

    with mock_third_party_http({"hooks.slack.com": httpx.Response(200, text="ok")}) as fake:
        await dispatch_integration_event_job(
            {"job_try": 1}, integration_id, "comment.created", comment_id
        )
    assert fake.calls == []


async def test_job_is_a_no_op_if_comment_was_deleted(
    client: AsyncClient, db: AsyncIOMotorDatabase[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    ctx = await create_project_with_guest_session(
        client, monkeypatch, email="retry7@example.com", code="930007", workspace_name="RT7"
    )
    integration_id = await _connect_slack(client, ctx)

    with mock_third_party_http({"hooks.slack.com": httpx.Response(200, text="ok")}) as fake:
        await dispatch_integration_event_job(
            {"job_try": 1}, integration_id, "comment.created", "000000000000000000000000"
        )
    assert fake.calls == []
