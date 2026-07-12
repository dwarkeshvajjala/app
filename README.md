# Backline

Collaborative website review platform. Full specification: [`docs/spec/00-README.md`](docs/spec/00-README.md). Build order and Definition of Done per milestone: [`docs/spec/20-Build-Plan.md`](docs/spec/20-Build-Plan.md).

## Status

**Milestones 0-10 complete.** Monorepo + CI (M0); Auth & Workspaces (M1); Projects & Share Links (M2); Review SDK v1 + Snapshot Engine v1 (M3); Comments Core + Dual Layer (M4); Anchor Engine v1 (M5): `modules/anchor_engine`'s matching/confidence-scoring function, implementing `08-Anchor-Engine.md`'s full tiered order (exact path → stable attribute → SimHash text-similarity fallback) and confidence formula, verified against all 5 golden dataset fixtures (`19-Testing-CI.md` §19.2) - identical page, moved element, text-edited element, removed element, ambiguous duplicates. Dashboard Board (M6): kanban + list views over every comment across a project's pages (`GET /projects/{id}/comments`), filters (status/layer/assignee/device/page) reflected in URL search params, bulk status change. Realtime Layer (M7): WebSocket gateway (`modules/realtime/`) + Redis pub/sub fan-out, `comment.created`/`comment.updated`/`presence.updated`/`revision.created` wired into the services that already produce those facts, targeted React Query cache merges on the dashboard (no blind invalidation), the app's first Zustand stores (connection status, page presence). Revision Engine + Recovery Pipeline v1 (M8): a real Diff Engine (`modules/revision_engine/`) persisting `revision_diffs`, recovery orchestration (`modules/recovery_engine/`) running as a genuine Arq background job (`app/workers/recovery.py`) that re-anchors or orphans affected comments via the M5 matcher, `recovery_logs` audit trail, `permanently_orphaned` after two consecutive misses, `comment.recovery_updated` now actually emitted. Proxy Mode + Onboarding Polish (M9): a real reverse proxy (`modules/proxy/`) that fetches a reviewed site server-side, injects the Review SDK, and rewrites same-origin links to stay on the proxy; the dashboard's `/review/:token` is now the single guest handoff point for both snippet and proxy mode; every new workspace is seeded with an example project (F7), and every new project is born with a default proxy-mode share link. Notifications & Integrations (M10): Slack/ClickUp/Trello (`modules/integrations/`) behind one `Integration` interface, a real Webhook Retry Engine (3 retries at 5s/30s/5min then dead-letter, via Arq's own retry-with-defer), an in-app notification center (`notification.new`, bell + dropdown), and a daily email digest. 158 backend tests, all green.

M7's DoD - two live sessions seeing each other's actions without a manual refresh, including presence - was proven twice: a standalone script driving two real WebSocket connections (one "dashboard," one "guest reviewer") against the live dev server, and a real Playwright/Chromium session watching the dashboard Board move a comment from "To do" to "Resolved" live while the update was posted entirely out-of-band. Scope decisions (which of §12.6's 7 event types shipped vs. deferred, presence's staff-only privacy scoping, and two known protocol gaps) are in `docs/tdr/0006-realtime-layer-scope-and-limitations.md`.

M8's DoD - all golden dataset fixtures passing, plus a real structural page change updating a comment's `recovery_status` end to end (Playwright journey #4) - was proven against a genuine Arq worker process consuming the real Redis queue, not a direct function call: a live-WebSocket script watched `comment.recovery_updated` arrive after an out-of-band "redeploy," and a real Playwright/Chromium session watched the dashboard Board's `RecoveryBadge` change from nothing to "Anchor uncertain" live. Design decisions worth knowing before touching this code - the Diff Engine doesn't drive the recovery decision (the matcher's own tiered scan already subsumes it), re-anchoring can't reconstruct a stale anchor's `selector_path`, and `permanently_orphaned` comments stop being retried entirely - are in `docs/tdr/0007-recovery-pipeline-design-decisions.md`.

M9's proxy mode was verified against a genuine external site, not a mock: a script created a project targeting `https://example.com` (IANA's stable reserved test domain), confirmed the auto-created share link, and fetched `/proxy/{token}/` directly - real server-side content, the widget script injected, and a different-origin link (`iana.org`) correctly left unrewritten. A full Playwright journey then drove the entire guest path for real: dashboard project creation, the share link surfaced immediately on the project page, a guest opening it, redirect to the actual proxied `example.com` page, the widget's own name-prompt correctly skipped (the dashboard's guest session rides along as a query param), a real comment posted with a real captured screenshot, and the dashboard Board showing it. Scope decisions - what the rewriter deliberately doesn't handle (JS-driven navigation, CSS `url()`, cookies, pre-content passcode gating), and the new onboarding defaults (seeded sample project, auto-created share link) - are in `docs/tdr/0008-proxy-mode-scope-and-onboarding-decisions.md`. As with M6's human-usability-test DoD criterion, the "under 10 minutes, unaided, real participant" measurement itself needs an actual person and wasn't performed.

M10's webhook retry engine was verified against a real failure, not a direct function call: a local HTTP server standing in for a Slack webhook deliberately failed once, and the actual `app.workers.main` Arq worker process - consuming the actual Redis queue - retried it after ~5s and succeeded. A real Playwright session then connected Slack through the actual Integrations UI (a real local webhook, not mocked) and watched a second, separately-logged-in member's notification bell receive a live unread badge and dropdown entry the instant the first member assigned them a comment, entirely via the WebSocket layer. ClickUp's OAuth connect flow needs real ClickUp app credentials to exercise live (same category of gap as Google OAuth below) - the token exchange and task-creation round trip (screenshot + metadata + backlink) are implemented and verified against a mocked ClickUp API boundary, run 20 times with a 100% pass rate in lieu of 20 live API calls. Scope decisions - the `notifications` collection's shape (`11-Database.md` never defined one), why `notification.new` has no per-recipient WS channel, why Trello connects via a pasted key+token instead of an app-level OAuth flow, and why only the daily digest (not per-member instant mode) shipped - are in `docs/tdr/0009-notifications-integrations-scope-and-design.md`.

M5 surfaced and fixed a real bug from Milestone 3 (`docs/tdr/0004`): the widget's anchor capture and its DOM snapshot capture used *different, non-comparable* hash schemes - an anchor's hashes could never have matched a snapshot's nodes, not even for a completely unchanged page. Both now share one hash scheme (`apps/widget/src/node-identity.ts`). Also added a real SimHash (character-trigram based, calibrated against actual short-UI-text behavior, not just word-splitting which turned out to discriminate poorly) for approximate text matching, since exact-string matching can't recover an edited label by definition.

Proven with more than unit tests: a real anchor captured by the actual browser-driven widget was matched against the actual snapshot it was captured alongside, using the real matcher - exact_path, confidence 1.0, not a synthetic fixture.

M6's real-browser verification (login → workspace → project → board, in actual Chromium, not just typecheck) caught a genuine bug unrelated to the board itself: `LoginPage`'s OTP-verify step never navigated away after a successful sign-in, leaving an authenticated member stuck looking at the sign-in form. The Google OAuth callback path already called `navigate("/")` on success; the email/code path just never got the equivalent call. Fixed in `apps/web/src/features/auth/LoginPage.tsx`. It had gone unnoticed because every prior milestone's browser testing exercised the guest/widget flow (share-link auth), never a member clicking through the dashboard's own sign-in form end to end.

Wiring the matcher into an automatic revision-triggered recovery pipeline (diff engine, `recovery_logs`, orchestration) is Milestone 8 - M5 was the matching algorithm itself, by design (`20-Build-Plan.md`).

Google OAuth, ClickUp OAuth, and Resend email need real credentials to fully exercise (see `.env.example`) - without them, OTP codes and email digests are logged to the server console instead of sent, and the Google/ClickUp connect buttons will fail at the provider's side once clicked (the exchange code and API calls themselves are fully implemented and tested with mocks). Slack and Trello need no app registration at all - both connect with a pasted credential (a webhook URL, or an API key + token), so they work end to end in local dev without any third-party setup.

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

# 3. Background worker (separate terminal, from backend/) - one process for every
#    job: recovery pipeline (M8), integration dispatch/webhook retries and email
#    digests (M10). Everything else works without it, just without those features.
cd backend
uv run arq app.workers.main.WorkerSettings

# 4. Frontend (separate terminal, from repo root)
pnpm install
pnpm --filter @backline/web dev

# 5. Widget bundle - build it at least once so the backend can serve it at
#    /widget/sdk.js (proxy mode injects a <script> tag pointing there, Milestone 9).
#    Re-run after any apps/widget/src change; the running backend picks it up on the
#    next request, no restart needed.
pnpm --filter @backline/widget build
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
