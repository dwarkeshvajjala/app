"""Cookie-bearing account endpoints are restricted to configured dashboard origins."""

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.config import get_settings


class AuthOriginMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and scope["path"].startswith("/api/v1/auth"):
            origin = dict(scope.get("headers", [])).get(b"origin")
            settings = get_settings()
            allowed = {*settings.cors_allow_origins, settings.public_dashboard_base_url.rstrip("/")}
            if origin and origin.decode("latin-1") not in allowed:
                response = JSONResponse(
                    {"error": {"code": "FORBIDDEN", "message": "Untrusted account origin."}},
                    status_code=403,
                )
                await response(scope, receive, send)
                return
        await self.app(scope, receive, send)
