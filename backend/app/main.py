import asyncio
import contextlib
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.arq_pool import close_arq_pool
from app.core.config import get_settings
from app.core.db import close_client, get_client, get_db
from app.core.errors import register_exception_handlers
from app.core.indexes import ensure_indexes
from app.core.redis_client import close_redis, get_redis
from app.modules.auth.router import router as auth_router
from app.modules.comments.router import router as comments_router
from app.modules.pages.router import router as pages_router
from app.modules.projects.router import router as projects_router
from app.modules.realtime.pubsub import run_subscriber
from app.modules.realtime.router import router as realtime_router
from app.modules.share_links.router import router as share_links_router
from app.modules.snapshot_engine.router import router as snapshots_router
from app.modules.storage.r2_client import ensure_bucket_exists
from app.modules.storage.router import router as storage_router
from app.modules.workspaces.router import router as workspaces_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    await ensure_indexes(get_db())
    await ensure_bucket_exists()
    subscriber_task = asyncio.create_task(run_subscriber())
    yield
    subscriber_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await subscriber_task
    await close_client()
    await close_redis()
    await close_arq_pool()


app = FastAPI(title="Backline API", version="0.1.0", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    # The Review SDK (07-Review-SDK.md) runs on arbitrary third-party sites, so its API
    # calls (guest-sessions, review resolve, pages, snapshots, uploads) must be allowed
    # from any origin - allow_origin_regex reflects the actual request Origin, which is
    # what lets "any origin" coexist with allow_credentials=True (a literal "*" cannot).
    # The dashboard's own credentialed cookie (the refresh token) is still safe: it's
    # SameSite=Strict and scoped to /api/v1/auth, so browsers never attach it to a
    # cross-site request regardless of what CORS allows.
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(workspaces_router, prefix="/api/v1")
app.include_router(projects_router, prefix="/api/v1")
app.include_router(share_links_router, prefix="/api/v1")
app.include_router(pages_router, prefix="/api/v1")
app.include_router(snapshots_router, prefix="/api/v1")
app.include_router(storage_router, prefix="/api/v1")
app.include_router(comments_router, prefix="/api/v1")
# Deliberately not under /api/v1 - 12-API-WebSocket.md §12.6 specifies the connection URL
# as `wss://api.backline.app/ws?...`, not `/api/v1/ws`.
app.include_router(realtime_router)


@app.get("/health")
async def health() -> dict[str, str]:
    mongo_ok = "ok"
    try:
        await get_client().admin.command("ping")
    except Exception:
        mongo_ok = "unreachable"

    redis_ok = "ok"
    try:
        await get_redis().ping()
    except Exception:
        redis_ok = "unreachable"

    return {"status": "ok", "mongo": mongo_ok, "redis": redis_ok}
