# Backline

Collaborative website review platform. Full specification: [`docs/spec/00-README.md`](docs/spec/00-README.md). Build order and Definition of Done per milestone: [`docs/spec/20-Build-Plan.md`](docs/spec/20-Build-Plan.md).

## Status

**Milestones 0-4 complete.** Monorepo + CI (M0); Auth & Workspaces (M1); Projects & Share Links (M2); Review SDK v1 + Snapshot Engine v1 (M3); Comments Core + Dual Layer (M4): comment CRUD, threaded replies, status/assignee, and the server-enforced `client`/`team` visibility split - a guest session's query filter hard-codes `layer: "client"` at the repository level, not a UI-side hide. 73 backend tests, all green, including the exact Journey #3 scenario (`19-Testing-CI.md` §19.3): a member posts a team-only reply on an otherwise client-visible thread, and the raw API response to the guest session excludes it.

The whole pipeline - name prompt → guest session → page registration → DOM snapshot → pin drop → screenshot capture/upload → **real comment creation** → dual-layer enforcement - is verified end to end in a real headless-Chromium run against the built widget (`apps/widget/test-site/`), plus a live check that a member-authored internal note is genuinely absent from a fresh guest session's raw API response. Milestone 3's browser pass caught two real bugs (Shadow DOM event retargeting breaking the composer, and Chrome's canvas-taint behavior for `foreignObject` SVGs loaded via `blob:` - see `docs/tdr/0003`).

Dashboard UI for triaging comments (kanban/list board) is Milestone 6 - M4 is API-only by design (`20-Build-Plan.md`), proving the data model and access-control guarantee first.

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
