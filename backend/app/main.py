from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.db import close_client, get_client, get_db
from app.core.errors import register_exception_handlers
from app.core.indexes import ensure_indexes
from app.core.redis_client import close_redis, get_redis
from app.modules.auth.router import router as auth_router
from app.modules.projects.router import router as projects_router
from app.modules.share_links.router import router as share_links_router
from app.modules.workspaces.router import router as workspaces_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    await ensure_indexes(get_db())
    yield
    await close_client()
    await close_redis()


app = FastAPI(title="Backline API", version="0.1.0", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(workspaces_router, prefix="/api/v1")
app.include_router(projects_router, prefix="/api/v1")
app.include_router(share_links_router, prefix="/api/v1")


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
