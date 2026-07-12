# Backline

Collaborative website review platform. Full specification: [`docs/spec/00-README.md`](docs/spec/00-README.md). Build order and Definition of Done per milestone: [`docs/spec/20-Build-Plan.md`](docs/spec/20-Build-Plan.md).

## Status

**Milestones 0-3 complete.** Monorepo + CI (M0); Auth & Workspaces (M1); Projects & Share Links (M2); Review SDK v1 + Snapshot Engine v1 (M3): the actual injectable widget (`apps/widget`, vanilla TS, 9.6KB / 3.97KB gzipped - well under the 40KB budget), a guest-session bootstrap flow, a real Normalized DOM Snapshot capture (walks the live DOM, hashes it, gzips it, stores it in R2/MinIO), a real viewport screenshot capture (SVG-`foreignObject`-to-canvas rasterization, uploaded via a presigned URL), a Tier-1 anchor computation, and a pin-drop/composer UI in a Shadow DOM root. 60 backend tests, all green.

The whole capture pipeline (name prompt → guest session → page registration → DOM snapshot → pin drop → screenshot → upload) is verified working end to end in a real headless-Chromium run against the built widget (`apps/widget/test-site/`) - not just type-checked. That pass caught and fixed two real bugs: Shadow DOM event retargeting was breaking the composer's outside-click detection, and Chrome unconditionally taints the canvas for `foreignObject`-based SVGs loaded via a `blob:` URL (fixed by switching to a `data:` URI - see `docs/tdr/0003`).

Comment posting itself (persisting the captured anchor/screenshot/body as a real comment) is Milestone 4 - M3 proves the capture and storage pipeline, which M4 will attach to.

Google OAuth and Resend email need real credentials to fully exercise (see `.env.example`) - without them, OTP codes are logged to the server console instead of emailed, and the Google button will fail at Google's side once clicked (the exchange code itself is fully implemented and tested with mocks).

### Trying the widget yourself

```bash
# with the backend + local services running (see below), and a share link's token in hand:
cd apps/widget && pnpm build
python3 -m http.server 4173   # serves apps/widget/ so test-site/index.html can reach ../dist/sdk.js
# open http://localhost:4173/test-site/index.html?shareToken=<your token>
```

## Repository Layout

```
apps/web       Agency dashboard (React + Vite)
apps/widget    Review SDK bundle (vanilla TS, injected into reviewed sites)
backend/       FastAPI application
packages/ui    Shared design-system components
packages/types Generated TS types from the backend's OpenAPI schema
docs/spec      The 20-file engineering specification (source of truth)
docs/tdr       Technical Decision Records (dated amendments to the spec)
infra/         Local dev service scripts + Docker Compose
```

## Local Development

Requires Node 20, pnpm, Python 3.12, and either Docker or the native `mongod`/`redis-server`/`minio` binaries on `PATH` (see `docs/tdr/0001-local-toolchain-without-docker.md` if you don't have Docker).

```bash
# 1. Start Mongo/Redis/MinIO
./infra/local/start-all.sh          # native binaries, or:
docker compose up -d                # if you have Docker

# 2. Backend
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000

# 3. Frontend (separate terminal, from repo root)
pnpm install
pnpm --filter @backline/web dev
```

Dashboard: http://localhost:5173 - Backend: http://localhost:8000/docs

To stop native local services: `./infra/local/stop-all.sh`

## Common Commands

```bash
pnpm turbo run lint typecheck build   # frontend workspaces
cd backend && uv run ruff check . && uv run mypy app/ && uv run pytest
```

## Regenerating API types

Whenever the backend's routes/schemas change, regenerate `packages/types` against a running backend:

```bash
cd packages/types && pnpm generate
```
