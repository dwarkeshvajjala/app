# Backline

Collaborative website review platform. Full specification: [`docs/spec/00-README.md`](docs/spec/00-README.md). Build order and Definition of Done per milestone: [`docs/spec/20-Build-Plan.md`](docs/spec/20-Build-Plan.md).

## Status

**Milestones 0-6 complete.** Monorepo + CI (M0); Auth & Workspaces (M1); Projects & Share Links (M2); Review SDK v1 + Snapshot Engine v1 (M3); Comments Core + Dual Layer (M4); Anchor Engine v1 (M5): `modules/anchor_engine`'s matching/confidence-scoring function, implementing `08-Anchor-Engine.md`'s full tiered order (exact path → stable attribute → SimHash text-similarity fallback) and confidence formula, verified against all 5 golden dataset fixtures (`19-Testing-CI.md` §19.2) - identical page, moved element, text-edited element, removed element, ambiguous duplicates. Dashboard Board (M6): kanban + list views over every comment across a project's pages (`GET /projects/{id}/comments`), filters (status/layer/assignee/device/page) reflected in URL search params, bulk status change. 85 backend tests, all green.

M5 surfaced and fixed a real bug from Milestone 3 (`docs/tdr/0004`): the widget's anchor capture and its DOM snapshot capture used *different, non-comparable* hash schemes - an anchor's hashes could never have matched a snapshot's nodes, not even for a completely unchanged page. Both now share one hash scheme (`apps/widget/src/node-identity.ts`). Also added a real SimHash (character-trigram based, calibrated against actual short-UI-text behavior, not just word-splitting which turned out to discriminate poorly) for approximate text matching, since exact-string matching can't recover an edited label by definition.

Proven with more than unit tests: a real anchor captured by the actual browser-driven widget was matched against the actual snapshot it was captured alongside, using the real matcher - exact_path, confidence 1.0, not a synthetic fixture.

M6's real-browser verification (login → workspace → project → board, in actual Chromium, not just typecheck) caught a genuine bug unrelated to the board itself: `LoginPage`'s OTP-verify step never navigated away after a successful sign-in, leaving an authenticated member stuck looking at the sign-in form. The Google OAuth callback path already called `navigate("/")` on success; the email/code path just never got the equivalent call. Fixed in `apps/web/src/features/auth/LoginPage.tsx`. It had gone unnoticed because every prior milestone's browser testing exercised the guest/widget flow (share-link auth), never a member clicking through the dashboard's own sign-in form end to end.

Wiring the matcher into an automatic revision-triggered recovery pipeline (diff engine, `recovery_logs`, orchestration) is Milestone 8 - M5 was the matching algorithm itself, by design (`20-Build-Plan.md`).

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
