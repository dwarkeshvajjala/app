# Railway deployment target (18-Storage-Deployment.md §18.6).
#
# IMPORTANT: the build context is the REPO ROOT, not backend/. The API also serves the
# review SDK's bundle at /widget/sdk.js (see app/main.py's WIDGET_DIST_DIR + the
# <script src> that proxy/service.py injects into every proxied page), and that bundle
# is built from apps/widget/, which lives outside backend/. Building with backend/ as
# the context produced an image with no widget in it at all: main.py's mount is guarded
# by `if WIDGET_DIST_DIR.exists()`, so it didn't crash - it just silently 404'd
# /widget/sdk.js, meaning the widget never loaded on any client's site in production.
#
# On Railway: Root Directory = "/" (repo root), Dockerfile Path = "backend/Dockerfile".

# --- Stage 1: build the review SDK bundle -------------------------------------------
# The widget has no runtime dependencies (only vite/typescript to build), so this stage
# is thrown away entirely after its dist/ is copied into the runtime image below.
FROM node:20-slim AS widget

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# Every workspace member's package.json (not just the widget's) before any source: pnpm
# resolves the whole workspace graph against pnpm-lock.yaml, and --frozen-lockfile fails
# if a member named in the lockfile is missing. Copying manifests separately from source
# also keeps this install layer cached across widget code changes.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/widget/package.json ./apps/widget/
COPY apps/web/package.json ./apps/web/
COPY apps/e2e/package.json ./apps/e2e/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install --frozen-lockfile --filter @backline/widget

COPY apps/widget ./apps/widget
RUN pnpm --filter @backline/widget build

# --- Stage 2: the API ----------------------------------------------------------------
FROM python:3.12-slim AS base

RUN pip install --no-cache-dir uv==0.11.28

WORKDIR /app

# Dependencies first, so an application-code-only change doesn't invalidate this layer.
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY backend/app ./app
COPY backend/scripts ./scripts
RUN uv sync --frozen --no-dev

# main.py resolves the bundle relative to its own file:
#   /app/app/main.py -> parents[2] == "/" -> /apps/widget/dist
# so this absolute path is not arbitrary - it's exactly what that lookup expects inside
# the container (locally the same expression resolves to <repo>/apps/widget/dist).
COPY --from=widget /repo/apps/widget/dist /apps/widget/dist

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

# No --reload (that's local-dev only, core/config.py's ENVIRONMENT=production path) and
# no hardcoded worker count - Railway sets $PORT; multiple uvicorn workers would each
# hold their own in-process rate-limit/connection state, which is exactly what
# core/rate_limit.py's Redis-backed sliding window and the realtime WS gateway assume
# a single process *doesn't* need to coordinate - scale via multiple Railway replicas
# behind its own load balancer instead, not multiple workers inside one container.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

# --- Stage 3: the worker (adds Playwright's browser binaries) -----------------------
# A separate target, not baked into `base` above, because only the worker process ever
# calls modules/browser_render/service.py's run_render() (see that file's lazy
# `from playwright...` import) - the API service gets zero benefit from these binaries
# and they are large (three engines + OS deps, roughly 1GB+), so bloating every API
# instance/redeploy with them for no reason would be a pure regression.
#
# On Railway: the WORKER service needs one settings change from what's documented in
# DEPLOYMENT.md Part 8 - same repo, same Dockerfile Path ("backend/Dockerfile"), but set
# Settings -> Build -> "Docker Build Target" to "worker". Leaving it unset (as today)
# keeps building the `base` stage above, i.e. exactly the pre-existing image with no
# Playwright - so this is opt-in and cannot regress the current worker or API deploy
# until that one field is changed.
FROM base AS worker

# --with-deps installs the OS-level libraries each engine needs to actually launch
# headless (fonts, codecs, etc.) - without it the binaries download fine but every
# launch() call fails at runtime with a missing-shared-library error, which is a much
# more confusing failure mode to debug from Railway's logs than a slower build.
RUN playwright install --with-deps chromium firefox webkit

CMD ["sh", "-c", "arq app.workers.main.WorkerSettings"]
