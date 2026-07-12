from dataclasses import dataclass
from typing import Any

import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import get_settings
from app.core.errors import ConflictError, ExternalServiceError, NotFoundError
from app.modules.projects.repository import ProjectRepository
from app.modules.proxy.rewriter import rewrite_html
from app.modules.share_links.repository import ShareLinkRepository

# Deliberately not forwarding any upstream response headers (CSP/X-Frame-Options would
# block the very page Backline is now serving; Set-Cookie would start a "session" this
# proxy never forwards on future requests - see docs/tdr/0008) - the router builds a
# fresh Response from just status/content_type/body below.


@dataclass(frozen=True)
class ProxiedResponse:
    status_code: int
    content_type: str
    body: bytes


def _widget_script_tag(share_token: str) -> str:
    base = get_settings().public_api_base_url
    return (
        f'<script src="{base}/widget/sdk.js"></script>'
        f"<script>window.Backline && window.Backline.init("
        f'{{shareToken: "{share_token}", apiBaseUrl: "{base}"}});</script>'
    )


async def fetch_proxied_resource(
    db: AsyncIOMotorDatabase[dict[str, Any]], *, share_token: str, path: str, query_string: str
) -> ProxiedResponse:
    """Proxy/link mode (03-System-Architecture.md §3.3): fetches the target site's own
    response server-side and, only for HTML, injects the Review SDK and rewrites
    same-origin links to keep subsequent navigation on the proxy. Non-HTML (images,
    CSS, JS, fonts) passes through unmodified - `docs/tdr/0008` covers what this
    deliberately doesn't handle (passcode gating pre-content, JS-driven navigation,
    cookies, CSS url() rewriting)."""
    link = await ShareLinkRepository(db).find_by_token(share_token)
    if link is None:
        raise NotFoundError("This review link doesn't exist.")
    if link["revoked_at"] is not None:
        raise ConflictError("This review link has been revoked.")

    project = await ProjectRepository(db).find_by_id(link["project_id"])
    if project is None:
        raise NotFoundError("Project not found.")
    target_origin = project["target_origin"].rstrip("/")

    upstream_url = f"{target_origin}/{path.lstrip('/')}"
    if query_string:
        upstream_url += f"?{query_string}"

    try:
        async with httpx.AsyncClient(
            timeout=15.0, follow_redirects=True, headers={"User-Agent": "BacklineProxy/1.0"}
        ) as client:
            upstream = await client.get(upstream_url)
    except httpx.HTTPError as exc:
        raise ExternalServiceError(f"Could not reach the reviewed site: {exc}") from exc

    content_type = upstream.headers.get("content-type", "application/octet-stream")

    if "text/html" in content_type:
        proxy_prefix = f"/proxy/{share_token}"
        html = upstream.text
        rewritten = rewrite_html(
            html,
            target_origin=target_origin,
            proxy_prefix=proxy_prefix,
            widget_script_tag=_widget_script_tag(share_token),
        )
        return ProxiedResponse(
            status_code=upstream.status_code, content_type=content_type, body=rewritten.encode()
        )

    return ProxiedResponse(
        status_code=upstream.status_code, content_type=content_type, body=upstream.content
    )
