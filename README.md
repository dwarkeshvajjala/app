# Backline

Collaborative website review platform. Full specification: [`docs/spec/00-README.md`](docs/spec/00-README.md). Build order and Definition of Done per milestone: [`docs/spec/20-Build-Plan.md`](docs/spec/20-Build-Plan.md).

## Status

**Milestones 0-2 complete.** Monorepo scaffold + CI (M0); Auth & Workspaces (M1): Google OAuth, email OTP, JWT + httpOnly-cookie refresh tokens with rotation/theft-detection, workspace CRUD, roles, full permission matrix; Projects & Share Links (M2): project CRUD (soft-archive), share links with optional passcode/expiry, a public `/review/{token}` resolver, and guest session creation - IP-rate-limited via a Redis sliding-window log, with the guest JWT scoped to exactly one share link. 45 backend tests, all green. Frontend covers login → workspace → projects → share links → the guest-facing `/review/:token` entry screen (name + passcode → guest session). The actual pin-drop/comment SDK starts at Milestone 3.

Google OAuth and Resend email need real credentials to fully exercise (see `.env.example`) - without them, OTP codes are logged to the server console instead of emailed, and the Google button will fail at Google's side once clicked (the exchange code itself is fully implemented and tested with mocks).

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
