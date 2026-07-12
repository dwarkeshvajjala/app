# 20 - Build Plan: Milestones & Definition of Done

Per P8 (Incremental Delivery) and Rule 2 (Production Quality Only): **do not start milestone N+1 until milestone N passes its Definition of Done below.** Each milestone is independently deployable - after every one of them, there is a working (if incomplete) product in `staging`, not a pile of half-built scaffolding.

## Milestone 0 - Project Setup (2-3 days)
Monorepo scaffolding (`02-Engineering-Principles.md` §2.5), CI pipeline skeleton (lint/typecheck passing on an empty app), local dev env (Docker Compose or native binaries, TDR-0001), Railway/Vercel projects provisioned for all four environments, `.env.example` complete.
**DoD:** `pnpm dev` and `uvicorn` both run locally against local Mongo/Redis; CI green on an empty commit; a "hello world" deploy reaches `staging` on both Vercel and Railway (deferred until real cloud credentials are available; local DoD substitutes until then).

## Milestone 1 - Auth & Workspaces (1 week)
Google OAuth + Email OTP (`13-Authentication.md` §13.1-13.2), JWT issuance/refresh, workspace CRUD, membership + roles, permission matrix middleware (`13-Authentication.md` §13.5) wired but with nothing yet to protect except workspace endpoints themselves.
**DoD:** a real user can sign up via Google or OTP, create a workspace, invite a second member, and role-based 403s are demonstrably enforced (tested, not just implemented - see `19-Testing-CI.md` §19.1).

## Milestone 2 - Projects & Share Links (3-4 days)
Project CRUD, share link generation (expiry/passcode/revoke), guest session creation flow, `/review/{share_token}` public resolution endpoint.
**DoD:** an agency member creates a project and a share link; opening that link in an incognito browser resolves correctly, respects expiry/passcode/revocation, and a guest session is created with only a display name.

## Milestone 3 - Review SDK v1 + Snapshot Engine v1 (1.5 weeks)
SDK init/injection (snippet mode only - proxy mode deferred to Milestone 9), pin-drop UI, Normalized DOM Snapshot capture (`09-Snapshot-Engine.md`), page registration, screenshot capture + R2 upload.
**DoD:** SDK installed via snippet on a real test site; a guest can tap anywhere, see a pin drop, and a snapshot + screenshot are captured and stored; performance budget (§7.7) measured and met.

## Milestone 4 - Comments Core + Dual Layer (1 week)
Comment CRUD, threaded replies, `layer` field with server-enforced visibility (`11-Database.md` §11.10's hard-coded guest query filter), status field (no kanban UI yet - API only).
**DoD:** F3's acceptance criterion is demonstrably true via an automated test (Playwright journey #3, `19-Testing-CI.md` §19.3) - not just "the UI hides it," the raw API response to a guest session excludes team-only content.

## Milestone 5 - Anchor Engine v1 (DOM fingerprint only) (1 week)
Tier 1 fingerprint *capture* (`08-Anchor-Engine.md`) landed in Milestones 3-4 already
(anchors are computed client-side and stored alongside each comment). What Milestone 5
actually adds is the *matching* side: `modules/anchor_engine`'s pure matching/confidence-
scoring function (§8.3's tiered order, §8.4's formula), operating on an anchor and a
target snapshot's `nodes_index`. This is scoped deliberately narrowly - the function is
real and fully tested against the golden dataset (all fixtures in §19.2, not just
"identical page"), but *wiring it to run automatically whenever a page's revision
changes* (the diff engine, `recovery_logs` persistence, background-job orchestration) is
Milestone 8 (`10-Revision-Recovery.md`) - "no recovery/diffing yet" means no automatic
pipeline, not "don't build or test the algorithm."

Discovered during implementation and fixed as part of this milestone
(`docs/tdr/0004-anchor-snapshot-shared-hash-scheme.md`): Milestone 3's anchor capture and
snapshot capture used *different, non-comparable* hashing schemes - an anchor's hashes
could never have matched a snapshot's `nodes_index`, not even for an unchanged page. Also
added: a real SimHash (`text_similarity_hash`, character-trigram based) for the text
fingerprint - exact-string matching can't satisfy the "text edited" golden fixture by
definition, since the text itself changed; `08-Anchor-Engine.md` §8.1 already specified
this field, Milestone 3 had just left it unimplemented.

**DoD:** every comment created in Milestone 4's flow carries a well-formed anchor payload
(done in M3/M4); the matcher correctly classifies all five golden dataset fixtures
(§19.2) - identical page (`ok`, confidence 1.0), moved element (`ok` via stable-attribute
match), text-edited element (`low_confidence` via SimHash), removed element
(`orphaned`), and ambiguous duplicates (`low_confidence`, not a silent wrong match).

## Milestone 6 - Dashboard: Board (Kanban + List) (1 week)
Full dashboard shell (`05-Frontend-Architecture.md`), Kanban + List views (`16-Dashboard.md` §16.1), React Query + Zustand wiring (`14-State-Management.md`), filters, bulk status change.
**DoD:** PM triage acceptance criterion tested directly - 50 comments across 3 pages triaged in under 10 minutes without leaving the board (measured in a usability pass, not just "the feature exists").

Implemented against a new `GET /projects/{id}/comments` endpoint (`12-API-WebSocket.md`
§12.4), not explicitly enumerated in the original endpoint table but following the same
cross-page aggregation `11-Database.md` §11.14 already assumes for kanban counts.
Filter/view state uses `useSearchParams` directly rather than a Zustand store synced to
the URL - see `docs/tdr/0005-board-filters-in-url-params-not-zustand.md`, which also notes
that the DoD's human usability-pass criterion is still outstanding (mechanics verified
end-to-end via Playwright against a live backend; a timed session with a real PM tester
was not performed and can't be by construction).

## Milestone 7 - Realtime Layer (4-5 days)
WebSocket gateway, Redis pub/sub fan-out, all event types in `12-API-WebSocket.md` §12.6, targeted React Query cache updates (no blind invalidation).
**DoD:** two browser sessions (one dashboard, one guest reviewer) see each other's actions live, without a manual refresh, including presence.

Of §12.6's 7 event types, 4 shipped (`comment.created`, `comment.updated`,
`presence.updated`, `revision.created`) and 3 were deferred to the milestone that
actually produces the underlying fact (`comment.recovery_updated` -> M8's recovery
pipeline, `typing.*` -> no composer focus/blur wiring exists yet, `notification.new` ->
M10's notification system) - see `docs/tdr/0006-realtime-layer-scope-and-limitations.md`,
which also documents the presence privacy scoping decision and two known gaps (no WS
signal for a comment leaving the guest-visible layer; the widget still has no local
comment list to reconcile via delta-sync on reconnect, since no milestone has built one).

## Milestone 8 - Revision Engine + Recovery Pipeline v1 (1.5 weeks)
Full diff engine (`10-Revision-Recovery.md`), recovery orchestration, Tier 2 (text fingerprint) fallback, recovery_logs, dashboard recovery-status indicators (`16-Dashboard.md` §16.2's pin treatments).
**DoD:** all golden dataset fixtures (§19.2) pass; a real structural change to a test site's page correctly updates affected comments' `recovery_status` end to end, verified via Playwright journey #4.

`docs/tdr/0007-recovery-pipeline-design-decisions.md` covers three decisions worth
knowing before touching this code: the Diff Engine's output is an independent audit
artifact, not an input to the actual recovery decision (`match_anchor`'s own tiered scan
already subsumes it); re-anchoring can't reconstruct a stale anchor's `selector_path`
(snapshots never store one, and matching never reads it); and `permanently_orphaned`
comments are excluded from all future automatic retries, not just rate-limited. Wired
through a real Arq worker (`app/workers/recovery.py`), not an inline call - the
DoD's real-structural-change proof was run against that actual worker process, twice
(a live-WebSocket script and a Playwright session watching the dashboard's
`RecoveryBadge` update with zero manual refresh).

## Milestone 9 - Proxy Mode + Onboarding Polish (4-5 days)
Reverse-proxy injection path (`03-System-Architecture.md` §3.3), empty states with seeded sample project (F7), onboarding flow tightened toward the "under 10 minutes unaided" metric.
**DoD:** a fresh agency signup reaches "first client link sent" in under 10 minutes in an unaided usability test with a real (non-teammate) participant, matching F1/F7's original acceptance criteria.

`docs/tdr/0008-proxy-mode-scope-and-onboarding-decisions.md` covers what the reverse
proxy deliberately doesn't handle (JS-driven navigation, CSS `url()` rewriting, cookies,
pre-content passcode gating - a general-purpose reverse proxy is explicitly not the
goal), how `ReviewEntryPage` became the single guest handoff point for both modes
(redirecting to the real site or the proxy with the guest session already attached, so
the widget never double-prompts for a name), and the two onboarding defaults added
(every workspace seeded with an example project on creation, every project born with a
default proxy-mode share link). As with M6's human-usability-test DoD criterion, the
"under 10 minutes, unaided, real participant" measurement itself requires an actual
person and wasn't performed - verified instead via a real external site
(`https://example.com`) proxied end-to-end and a full Playwright guest journey.

## Milestone 10 - Notifications & Integrations (1 week)
Slack (`17-Notifications-Integrations.md` §17.2), ClickUp (§17.3), Trello (§17.4), email digests (§17.6), webhook retry engine (§17.7), in-app notification center.
**DoD:** comment -> ClickUp round trip preserves screenshot/metadata/backlink on 100% of a 20-run test batch; Slack notifications deliver and retry correctly under a simulated webhook failure.

Without real ClickUp app credentials, "20 runs" means the round-trip test
(`tests/test_integrations.py`) run 20 times against a mocked ClickUp API boundary,
100% pass, not 20 live API calls - same category of gap as Google OAuth's existing
"needs real credentials to fully exercise" note. Slack's retry-under-failure half of the
DoD *was* verified against a real, live failure: a local HTTP server standing in for the
webhook, deliberately failing once, driven through the actual `app.workers.main`
worker process and the actual Redis queue - genuinely retried after ~5s and succeeded.
`docs/tdr/0009-notifications-integrations-scope-and-design.md` covers the rest: the
`notifications` collection shape (11-Database.md never defined one), why Trello connects
via a pasted key+token instead of an app-level OAuth flow, why only Slack gets automatic
dispatch, and why only the daily digest (not per-member instant mode) shipped.

## Milestone 11 - Security, Performance & Accessibility Hardening (1 week)
Rate limiting audit, workspace-scoping lint rule enforced in CI (`06-Backend-Architecture.md` §6.4), signed URL expiry review, axe-core accessibility pass on all dashboard screens and the widget, Lighthouse budget verification, dependency security audit.
**DoD:** no critical/high findings from a security review pass; WCAG AA automated checks pass on every screen; all performance budgets in `19-Testing-CI.md` §19.5 are green.

## Milestone 12 - Launch Readiness (3-5 days)
Full regression pass across all Playwright journeys, staging soak test, production environment provisioning double-checked against `18-Storage-Deployment.md`, rollback plan documented, on-call/monitoring wired (error tracking + uptime checks - tool choice is a TDR at this point, not pre-specified here).
**DoD:** every acceptance criterion listed anywhere in this spec has a corresponding passing automated test or a documented manual verification; production deploy succeeds with a clean smoke test.

## Definition of Done - Template (apply per milestone above)

- [ ] All listed functionality implemented, no `TODO`s or mocked logic (Rule 2)
- [ ] Unit + integration tests written and passing
- [ ] Relevant Playwright journey(s) passing, if applicable
- [ ] Deployed successfully to `staging`
- [ ] Acceptance criteria from `01-Product-Vision.md` / the milestone description explicitly verified, not assumed
- [ ] No new workspace-scoping gaps introduced (CI lint rule, `06-Backend-Architecture.md` §6.4)
- [ ] Accessibility checklist (`15-Design-System.md` §15.7) passes for any new UI
- [ ] Spec updated or a TDR filed (`02-Engineering-Principles.md` §2.4) if implementation diverged from this document
