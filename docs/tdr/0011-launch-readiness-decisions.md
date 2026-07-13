# TDR-0011: Launch Readiness (M12) - scope decisions, findings, and fixes

Date: 2026-07-13
Status: Accepted

See `docs/launch-readiness.md` for the full acceptance-criteria traceability matrix,
rollback plan, and on-call runbook this milestone produced. This TDR covers the
decisions and the bugs found along the way.

## Decision: build the missing thread/reply UI rather than defer it

Auditing `19-Testing-CI.md` §19.3's journey #3 ("team member posts a team-only reply")
surfaced that the dashboard Board had **no reply UI at all** - `POST /comments/{id}/
replies` existed and was tested since M4, but nothing in `apps/web` ever called it.
F3's whole "discuss issues" half of the product had no way to happen through the actual
product. Asked the user whether to build it now or defer with an API-level test only;
told to build it. Added `CommentThreadPanel` (`apps/web/src/features/board/
CommentThreadPanel.tsx`): a reply list with per-message `LayerBadge`s and a
layer-aware composer, opened via a "Reply"/"View thread (N)" affordance on each board
card. Comments are grouped into threads client-side (`parent_id` grouping over the
same flat list `GET /projects/{id}/comments` already returns) rather than a new
endpoint - no backend contract change needed beyond what M4 already shipped.

Bug caught while building it: the panel's own optimistic cache update and the
board's WebSocket `comment.created` handler both write to the same React Query cache
key - the panel's write was a blind append, so if the WS event landed first (the
common case, it's fast and local), the reply appeared twice. Fixed to upsert by id,
matching the pattern `BoardPage.tsx`'s own `upsertComment` already used.

## Found: the onboarding seed never actually threaded its own demo reply

While building the thread panel, loading the seeded "Example Project" (F7) surfaced
that its three demo comments were never a demonstration of a thread at all -
`backend/app/modules/workspaces/onboarding.py`'s `_sample_comment()` hardcoded
`parent_id: None` for every comment regardless, contradicting its own docstring
("a client-visible note, a team-only *reply* to it, and a resolved thread"). A new
member's very first look at the product's key differentiator silently didn't show it.
Fixed; `backend/tests/test_onboarding.py` now asserts the parent/reply relationship
explicitly.

## Found: two more real WCAG AA contrast failures

`journey-3`'s new axe-core scan of the `CommentThreadPanel` (the first accessibility
pass this UI ever got) found `layer-client`/`layer-team` badge text at ~2.4:1 and
~4.5:1 against their own badge backgrounds - the second finding was that close to the
line that I didn't trust my own contrast-ratio approximation and darkened it anyway.
Same fix pattern as M11's `recovery-orphaned` finding: darkened `#0EA5E9`/`#7C3AED` to
`#075985`/`#6D28D9` (`apps/web/tailwind.config.js`), landing both around 5.5-6:1.

## Decision: Sentry for error tracking, no uptime-check vendor chosen

Sentry (`sentry-sdk[fastapi]` backend, `@sentry/react` frontend) - the most common
choice for a stack this shape, and its FastAPI/React integrations are genuinely
zero-config beyond `init(dsn=...)`. Wired as a no-op with no `SENTRY_DSN`/
`VITE_SENTRY_DSN` set (same credential-gated pattern as every OAuth/email integration
in this codebase) - verified both ways: with no DSN, `@sentry/react` is fully
tree-shaken out of the production bundle (0 occurrences of "sentry" in the built JS);
with a DSN set, it's included (~30KB gzipped added) and `sentry_sdk.init()` succeeds
against a well-formed dummy DSN without crashing startup.

No uptime-check vendor (UptimeRobot, Better Uptime, Pingdom, ...) was chosen or
provisioned - that's an external account this session has no access to, and the actual
choice among them is a five-minute decision once someone has a production URL and a
company credit card, not an engineering one. `/health` already reports Mongo/Redis
reachability, not just process liveness, so whichever vendor gets picked has a
meaningful endpoint to poll from day one.

## Decision: `backend/scripts/smoke_test.py` checks `/health` + `/openapi.json`

Per `18-Storage-Deployment.md` §18.8's "smoke test hits `/health` and a read-only API
endpoint." No seed/fixture data exists immediately post-deploy to hit a real domain
endpoint (e.g. `/review/{token}`) meaningfully, so `/openapi.json` (FastAPI's own
generated schema) is the least-arbitrary "the full route table loaded and the API is
genuinely routing requests" check available without inventing fixture data. Verified
against the live local backend both ways (passes against a real backend, fails cleanly
with a clear message against an unreachable one).

## Decision: `backend/scripts/soak_test.py` as the staging-soak substitute

No real staging environment exists to soak-test. The script drives realistic,
sustained guest traffic (session -> page -> snapshot -> comment) against a real local
stack, each simulated guest using a distinct fake `X-Forwarded-For` - without that,
every cycle competes for the same per-IP rate-limit bucket (`docs/tdr/0010`) and the
test just re-proves rate limiting exists instead of exercising memory/queue-backlog
behavior. Caught exactly this bug on the first real run: I'd forgotten to add the fake
IP to the `/review/{token}` resolve call specifically, so it started 429ing after ~30
cycles and crashed on an unexpected response shape.

Real run, 90s / 8 concurrent workers: **38,165 requests, 0 failures, backend RSS flat
(100.4MB -> 99.8MB, no growth), Arq queue backlog settled at 16**. Honest caveat: 90
seconds on a local machine is not a real multi-hour staging soak against real
infrastructure latency and connection pooling behavior - it's the closest thing
achievable without a staging environment.

## Decision: feature flags (18-Storage-Deployment.md §18.7), minimal, unused by any real feature yet

Implemented per spec: `feature_flags` collection (`{key, workspace_id?, enabled}`,
unique on `(key, workspace_id)`), `core/feature_flags.py`'s `load_feature_flags()`
(global default, workspace-specific row overrides) and `use_feature_flag(key)` FastAPI
dependency (request-scoped cache, so several flag checks in one request don't each
re-query), and the frontend `useFeatureFlag(key)` hook backed by the
`switch-workspace` response's new `feature_flags` field - no separate polled endpoint,
per spec. Deliberately **not** wired to gate any real feature: the spec's own example
(staged Asana rollout) doesn't exist yet, and inventing a flag to prove the mechanism
would be exactly the kind of speculative complexity worth avoiding. The mechanism
itself is tested end-to-end (global-vs-override merge, the bootstrap-response wiring)
without a fake consumer.

## Not done - genuinely can't be, from this environment

Real Vercel/Railway/Atlas/R2 account provisioning, DNS, and an actual production
deploy - no cloud credentials exist in this session, the same category of gap as
Google/ClickUp OAuth throughout the build (`README.md`). `backend/Dockerfile`, the CI
`deploy` job, and the smoke test script are all real and ready to run the moment
those accounts exist (`docker-compose.yml` for local Docker-available dev already
existed since M0 - it wasn't new this milestone, despite `docs/tdr/0001` implying so;
checked and confirmed accurate on inspection). Comment -> ClickUp round trip and the
`< 30s` / `< 10min unaided` human-timed UX metrics remain documented gaps (`docs/
launch-readiness.md` §1) needing real credentials or a real participant, neither
available here.
