from fastapi import APIRouter, Request, Response

from app.core.config import get_settings
from app.core.db import get_db
from app.core.rate_limit import check_rate_limit, get_client_ip
from app.core.redis_client import get_redis
from app.modules.proxy import service as proxy_service

router = APIRouter(tags=["proxy"])


async def _proxy(share_token: str, path: str, request: Request) -> Response:
    settings = get_settings()
    await check_rate_limit(
        get_redis(),
        key=f"rate-limit:proxy:{get_client_ip(request)}",
        limit=settings.proxy_rate_limit_per_minute,
        window_seconds=60,
    )
    result = await proxy_service.fetch_proxied_resource(
        get_db(), share_token=share_token, path=path, query_string=request.url.query
    )
    return Response(
        content=result.body, status_code=result.status_code, media_type=result.content_type
    )


@router.get("/proxy/{share_token}")
async def proxy_root(share_token: str, request: Request) -> Response:
    return await _proxy(share_token, "/", request)


@router.get("/proxy/{share_token}/{path:path}")
async def proxy_path(share_token: str, path: str, request: Request) -> Response:
    return await _proxy(share_token, path, request)
