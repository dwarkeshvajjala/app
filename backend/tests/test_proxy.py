"""Proxy route integration tests (03-System-Architecture.md §3.3). The upstream fetch
is mocked by replacing `httpx.AsyncClient` itself with a fake, rather than patching
`AsyncClient.get` on the shared class - the latter would also intercept this test file's
own `client` fixture (also an `httpx.AsyncClient`, via ASGITransport), since methods are
resolved on the class regardless of which module's `import httpx` reached it. Replacing
the class reference only affects code that looks it up dynamically at call time
(`app.modules.proxy.service`'s `import httpx; httpx.AsyncClient(...)`) - `conftest.py`
already bound its own `AsyncClient` name via `from httpx import AsyncClient` before any
patching happens, so it's unaffected either way."""

from types import TracebackType
from typing import Any
from unittest.mock import patch

import httpx
import pytest
from httpx import AsyncClient

from tests.helpers import create_workspace_and_get_owner_token


class _FakeUpstreamClient:
    """Stands in for `httpx.AsyncClient` inside `proxy/service.py` only (see module
    docstring). Records every requested URL and always returns the same canned
    response, which is all these tests need - no real network access."""

    requested_urls: list[str] = []
    response: httpx.Response = httpx.Response(
        200, headers={"content-type": "text/html"}, content=b""
    )

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        pass

    async def __aenter__(self) -> "_FakeUpstreamClient":
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        return None

    async def get(self, url: str, *args: Any, **kwargs: Any) -> httpx.Response:
        _FakeUpstreamClient.requested_urls.append(url)
        return _FakeUpstreamClient.response


def _mock_upstream(
    *, status_code: int = 200, content_type: str = "text/html", body: bytes = b"<html></html>"
):
    _FakeUpstreamClient.requested_urls = []
    _FakeUpstreamClient.response = httpx.Response(
        status_code=status_code, headers={"content-type": content_type}, content=body
    )
    return patch("app.modules.proxy.service.httpx.AsyncClient", new=_FakeUpstreamClient)


async def _create_project_and_share_link(
    client: AsyncClient, headers: dict[str, str], workspace_id: str, target_origin: str
) -> str:
    project = await client.post(
        f"/api/v1/workspaces/{workspace_id}/projects",
        json={"name": "Proxy Target", "target_origin": target_origin},
        headers=headers,
    )
    project_id = project.json()["id"]
    link = await client.post(
        f"/api/v1/projects/{project_id}/share-links", json={"mode": "proxy"}, headers=headers
    )
    token: str = link.json()["token"]
    return token


async def test_proxy_injects_widget_script_and_rewrites_links(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    workspace_id, owner_token = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="proxy1@example.com", code="900001", workspace_name="PX1"
    )
    headers = {"Authorization": f"Bearer {owner_token}"}
    token = await _create_project_and_share_link(
        client, headers, workspace_id, "https://target.example.com"
    )

    html = b'<html><body><a href="/pricing">Pricing</a></body></html>'
    with _mock_upstream(body=html):
        resp = await client.get(f"/proxy/{token}/")

    assert resp.status_code == 200
    assert "text/html" in resp.headers["content-type"]
    body = resp.text
    assert f'href="/proxy/{token}/pricing"' in body
    assert "window.Backline" in body
    # Cache-busted (proxy/service.py's _widget_sdk_version) - otherwise a guest whose
    # browser already cached an older bundle from this same static URL would keep
    # running stale widget code indefinitely, even past a real fix landing.
    assert 'src="http://localhost:8000/widget/sdk.js?v=' in body
    assert token in body


async def test_proxy_passes_through_non_html_unmodified(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    workspace_id, owner_token = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="proxy2@example.com", code="900002", workspace_name="PX2"
    )
    headers = {"Authorization": f"Bearer {owner_token}"}
    token = await _create_project_and_share_link(
        client, headers, workspace_id, "https://target.example.com"
    )

    css = b"body { color: red; }"
    with _mock_upstream(content_type="text/css", body=css):
        resp = await client.get(f"/proxy/{token}/style.css")

    assert resp.status_code == 200
    assert "text/css" in resp.headers["content-type"]
    assert resp.content == css


async def test_proxy_unknown_token_is_404(client: AsyncClient) -> None:
    resp = await client.get("/proxy/not-a-real-token/")
    assert resp.status_code == 404


async def test_proxy_revoked_link_is_rejected(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    workspace_id, owner_token = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="proxy3@example.com", code="900003", workspace_name="PX3"
    )
    headers = {"Authorization": f"Bearer {owner_token}"}
    token = await _create_project_and_share_link(
        client, headers, workspace_id, "https://target.example.com"
    )
    projects = await client.get(f"/api/v1/workspaces/{workspace_id}/projects", headers=headers)
    project_id = next(p for p in projects.json() if p["name"] == "Proxy Target")["id"]
    share_links = await client.get(f"/api/v1/projects/{project_id}/share-links", headers=headers)
    link_id = next(link_ for link_ in share_links.json() if link_["token"] == token)["id"]

    revoke = await client.patch(f"/api/v1/share-links/{link_id}/revoke", headers=headers)
    assert revoke.status_code == 204

    resp = await client.get(f"/proxy/{token}/")
    assert resp.status_code == 409


async def test_proxy_root_path_defaults_to_slash(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    workspace_id, owner_token = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="proxy4@example.com", code="900004", workspace_name="PX4"
    )
    headers = {"Authorization": f"Bearer {owner_token}"}
    token = await _create_project_and_share_link(
        client, headers, workspace_id, "https://target.example.com"
    )

    with _mock_upstream():
        resp = await client.get(f"/proxy/{token}")

    assert resp.status_code == 200
    assert _FakeUpstreamClient.requested_urls == ["https://target.example.com/"]


async def test_proxy_is_rate_limited_per_ip(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "proxy_rate_limit_per_minute", 2)

    workspace_id, owner_token = await create_workspace_and_get_owner_token(
        client, monkeypatch, email="proxy5@example.com", code="900005", workspace_name="PX5"
    )
    headers = {"Authorization": f"Bearer {owner_token}"}
    token = await _create_project_and_share_link(
        client, headers, workspace_id, "https://target.example.com"
    )

    with _mock_upstream():
        statuses = [(await client.get(f"/proxy/{token}/")).status_code for _ in range(3)]

    assert statuses[:2] == [200, 200]
    assert statuses[2] == 429


async def test_unmatched_path_with_proxy_referer_redirects_back_through_the_proxy(
    client: AsyncClient,
) -> None:
    """docs/tdr/0008's documented gap: a target site's own client-side JS (e.g. a
    search box doing `location.href = "/search?q=foo"` on Enter) can navigate straight
    to this API's own root instead of through `/proxy/{token}/...`, since the rewriter
    only touches markup, not JS. app/modules/proxy/fallback_router.py's stopgap: when
    the browser's Referer still carries the proxy URL the navigation started from,
    redirect back through that same token rather than surfacing a bare 404."""
    resp = await client.get(
        "/search?q=foo",
        headers={"referer": "http://test/proxy/some-token/landing-page"},
    )
    assert resp.status_code == 307
    assert resp.headers["location"] == "/proxy/some-token/search?q=foo"


async def test_unmatched_path_without_proxy_referer_is_a_normal_404(
    client: AsyncClient,
) -> None:
    resp = await client.get("/this-route-does-not-exist")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"
