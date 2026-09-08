# Delivery and verification ledger

## 2026-09-08: Vercel frontend build regression fix

- Exported the shared `PlusIcon` and `SearchIcon` used by the committed projects
  dashboard. The exports had remained only in an unstaged local edit, so a clean
  Linux/Vercel checkout failed during `tsc -b` even though the Windows worktree had
  stale incremental output.
- Verified the pushed commit from a clean checkout with `pnpm --filter @backline/web
  build` (`tsc -b && vite build`); it passes with only the existing large-chunk warning.
- The local multi-service Vercel emulator completed the web service and then stopped at
  the unrelated backend service because `uv` is not installed in this environment.

## 2026-09-08: Post-login UI migration — project dialogs slice

- Migrated `ProjectForm` to the Final Draft's progressive create flow with the
  website/image/PDF chooser, honest roadmap types, client selection and inline client
  creation, domain-based environment detection with manual override, validated file
  selection and retry-safe uploads, and a real review-link success handoff.
- Rebuilt project settings around the five persisted review preferences. Device
  capture, reviewer resolution, and client-board controls retain their enforced
  behavior; deploy re-anchoring and client digest are explicitly marked `Saved only`
  because their execution paths are not connected yet.
- Migrated `ShareProjectModal` with real workspace members, owner/admin-only teammate
  invitation, clear workspace-versus-project access language, active-link loading/
  empty/error/copy states, enforced link-policy summaries, and genuine proxy-link
  creation. Link mutation beyond the existing create/revoke contracts remains routed
  to the share-link manager instead of being simulated in the modal.
- Migrated `ProjectMenu`, `ProjectPagesModal`, and the project lifecycle confirmations:
  icon-led keyboard-navigable actions; safe rename; archive/restore; duplicate; CSV
  export confirmation; responsive add/rename/reorder/remove page controls; and the
  owner/admin, archive-first, preview-and-name-confirmed permanent-delete contract.
  Deploy history and asset file management remain visible but disabled as coming soon.
- Existing React Query keys and invalidation, member/project/share/page/asset API calls,
  authorization boundaries, routes, and generated types were preserved. No backend,
  database, generated declaration, or widget files were changed.
- Not run at the user's request: lint, typecheck, build, automated tests, local preview,
  browser interaction QA, keyboard journey QA, and responsive screenshot comparison.
  The final diff was inspected for scope and whitespace only; release verification is
  still required.

## 2026-09-08: Post-login UI migration — shell and dashboard slice

- Adopted the Final Draft's shared brand contract in TDR-0018 and added reusable,
  bounded prompts for continuing the migration route family by route family.
- Reworked the authenticated workspace shell with a persistent Backline lockup,
  global new-project entry point, platform-correct search shortcut, stable skip link,
  corrected URL-filter-aware navigation states, and a real off-canvas mobile drawer.
- Migrated the projects dashboard closer to the supplied HTML: prototype-style tabs,
  hatched section divider, refined waiting-on-you panel, deterministic website/image/
  PDF preview artwork, visible comment pins, card hover actions, URL/client hierarchy,
  improved list/table densities, and project-type-aware create cards.
- Existing React Query data, routes, mutations, authorization, and backend contracts
  remain unchanged. Dashboard card previews no longer iframe arbitrary third-party
  origins; real sites continue to render only in the dedicated project review flow.
- Not run at the user's request: lint, typecheck, build, automated tests, local preview,
  browser interaction QA, and responsive screenshot comparison. This slice therefore
  records implementation scope, not release verification.

## 2026-09-07: Requested main update

- Merged origin/main at 11fea12 while preserving local commit a5233a5; conflict decisions are recorded in TDR-0016. The pre-existing untracked gcm-diagnose.log is untouched.
- Passed: frontend typechecks, web/widget production builds (large-chunk warning), workspace-scoping check, and 9 security/scoping regression tests.
- Outstanding incoming-code checks: frontend lint reports 13 errors and 1 warning; backend Ruff reports 4 line-length errors in auth/router.py and notifications/repository.py; mypy reports 3 errors in auth/repository.py, auth/router.py and dashboard/service.py. The combined frontend check stopped on lint, so production builds were run separately and passed.
- Persistence/session/digest integration tests were not run: isolated MongoDB, Redis and S3-compatible services were not provisioned or verified for this pull. No shared-service fixtures were executed.

Date: 2026-09-06. This file tracks actual work; specification text alone is not evidence of delivery.

## Sequence

1. **Source and plan:** preserve HTML, index controls/behaviors, document PRD/flows/frontend/backend/database and amend spec index.
2. **Workflow foundation:** statuses, tags, priority, multi-assignee and clearable dates; backward-compatible models; scoped repositories/indexes.
3. **Workspace operations:** clients, project associations/environments/archive/restore, ticket/dashboard/activity APIs.
4. **Dashboard frontend:** draft design, navigation, project views, client UI, workspace ticket views and metadata editing, activity.
5. **Asset and review extension:** private image/PDF projects, persistent region review, sharing/policy enhancements.
6. **Account/provider flows [COMPLETED]:** profile/preferences/security; genuine AI and billing when provider configuration is available.
7. **Verification:** generated contracts, lint/typecheck/build, meaningful backend privacy/filter/mutation tests, live browser journeys, doc/status reconciliation.

## Current evidence

- Original HTML copied without executing its scripts. Inventory records 112 element IDs, 76 static controls and 158 action attributes including generated markup.
- Inspected existing React router/layout/features, FastAPI module boundaries, Mongo indexes, permissions, comment mutations and test infrastructure.
- Existing `.env.production.example` and `DEPLOYMENT.md` user modifications were present before this work and must be preserved.
- Plans and flow matrix authored before implementation.
- Implemented: workflow fields and filters; clients; project metadata and archive/restore; workspace dashboard, tickets and activity APIs; the Final Draft dashboard shell and project/client/ticket/activity screens; image/PDF asset upload and region review; private signed asset URLs; generated OpenAPI contracts; and the Final Draft documentation set.
- 2026-09-07: added the first global-search slice: a permission-gated, workspace-scoped API for active projects, root comments/tickets, and workspace members; workspace shell search UI with `/`, Cmd/Ctrl+K, and Escape; generated OpenAPI contracts; and the workspace-isolation/empty-query regression coverage. Search uses the bounded strategy in TDR-0013. Exact placed-comment routing, grouping/ranking, client search, and provider-backed text search remain open audit work.
- Frontend verification: `pnpm turbo run lint typecheck build` completed with 9 successful tasks. Vite reports the expected large PDF worker/application chunk warning; the production build succeeds.
- Backend verification: `ruff check app`, `mypy app/`, and `scripts/check_workspace_scoping.py` pass. The focused application suite passes with `37 passed` using isolated MongoDB, Redis and S3-compatible test services. A complete run reached `186 passed`, then 7 realtime assertions and 4 fixture cleanup cases failed after the local `fakeredis` TCP emulator dropped pub/sub connections; the affected product modules were unchanged by this work.
- Source limitations recorded: the reference HTML was indexed without executing its mock scripts, and local browser policy prevented opening the copied `file://` reference for visual inspection. Product behavior was derived from its markup, labels, controls and action inventory, then implemented against the existing code architecture.

## 2026-09-08: Cross-session audit reconciliation

- A prior Claude review was reconciled with the current worktree. It identifies the next
  parity/UX verification targets as BoardPage URL state and deep links, guest-board
  frontend wiring, page add/reorder controls, hard-delete preview/confirmation UI,
  website-canvas comment move/resize, calendar drag/drop, website page tabs, status-label
  consistency, toast/confirm adoption, query-key consolidation, comment parent/reply
  normalization, debounced/scoped search, and the larger god-file/design-system/i18n
  cleanup items. These are audit targets, not claims that each item is complete or safe
  to implement without checking the current code and product decisions.
- The review confirms that guest manual reanchoring remains member-only under the existing
  permission matrix. Guest drag/resize affordances must therefore be hidden or disabled,
  and the 401 behavior should remain covered by a regression test; no guest privilege is
  inferred from the frontend review UI.
- Verification limits remain important: local emulator-backed checks are not production
  health evidence, and shared or cloud database fixtures must not be used. No credentials
  or connection strings from cross-session chat notes are recorded in this repository.

## 2026-09-08: God-file split handoff

- The cross-session audit work split the large frontend/widget files while preserving
  their existing public import paths and behavior: `TicketsPage`, `CommentsTab`, and
  `BoardPage` now delegate to feature-local components, and the widget `index.ts`/`ui.ts`
  logic is split into focused modules under `apps/widget/src`.
- FE-01/FE-02 query-key and comment-cache consolidation is included in the same working
  tree. The i18n rollout remains intentionally deferred; no completion is claimed for
  FE-07/FE-08 styling/icon cleanup beyond the work explicitly present in this batch.
- The handoff notes identified duplicate implementations across concurrent sessions;
  this delivery snapshot reconciles the current worktree versions before publication.
- This synchronization turn intentionally did not rerun tests or builds at the user's
  request. Earlier session-reported checks remain historical evidence and should be
  revalidated before the next release.

## 2026-09-07 — audit batch 02 (M-03, M-07)

- **Delivered:** replaced the direct project-document hard-delete with owner/admin-only
  preview and confirmation contracts. The preview enumerates the workspace-scoped graph
  and private object keys, reports counts and creates a one-hour plan. Confirmation
  requires the same actor, exact project name, explicit acknowledgement, an archived
  project and an unchanged graph. It locks the project, creates durable object
  tombstones, completes R2/MinIO cleanup, deletes Mongo dependencies in order and emits
  one correlation-ID summary event. Normal UI deletion remains recoverable archiving.
- **Delivered:** page deletion now refuses pages referenced by comments, revisions,
  revision diffs or project assets and returns the reference counts; deleting an empty
  page emits `page.deleted`.
- **Delivered:** additive named indexes for notification unread lookup, share-link
  project listing, normalized page URLs, revision current/history reads, recovery
  history, refresh-token families, event feeds and active OTP lookup. Authorized guest
  HTTP/WebSocket activity now refreshes `last_seen_at`; the existing 180-day TTL remains.
  The migration is dry-run by default and never drops or renames an index.
- **Evidence:**
  `docs/implementation/evidence/audit-batch-02-index-explain.json` seeds 2,500 documents
  per collection. All 11 representative queries move from `COLLSCAN` (2,500 examined)
  to plans containing `IXSCAN` (one document examined; one key except OTP at two). It
  also records the 15,552,000-second guest TTL and that no existing index was dropped.
- **Verification passed:** focused backend integration suite `38 passed`; full backend
  suite `219 passed, 1 failed`, with the sole failure an out-of-scope stale M-04 project
  settings assertion (`test_projects.py::test_create_and_list_projects`). Workspace
  scoping check passed; touched Python files pass Ruff; focused mypy passes. Generated
  OpenAPI JSON/TypeScript are reproducible. Touched frontend files pass ESLint, web
  typecheck passes and the production web build succeeds.
- **Baseline checks still red outside this batch:** full `mypy app/` has the existing
  `auth/repository.py:137` aggregate-pipeline type error; full web lint has 13 existing
  errors plus one warning in unrelated UI files; the monorepo lint/typecheck/build run
  stops on that lint task. These were not changed because this batch is limited to
  M-03/M-07.
- **Traceability:** FD-AUD-022 is partial overall (safe delete delivered; duplicate and
  export are separate M-13 scope). FD-AUD-048 is partial overall (safe page/revision/
  recovery retention delivered; deploy/version product UI remains separate). The
  M-03/M-07 portion of FD-AUD-051 is delivered with migration, TTL/GC and explain
  evidence. Detailed file/change/risk evidence is in
  `docs/implementation/audit-batch-02-report.md`.

## 2026-09-07: Login outage from comment request index

- Fixed the Railway startup E11000 reported in the supplied logs: the compound
  sparse unique index included legacy comments with missing/null request IDs.
  Startup now creates a uniquely named partial index for string request IDs only.
  Existing comments and indexes are preserved; workspace-scoped uniqueness remains.
- Added a dry-run-first inspection/apply command in
  `backend/scripts/migrate_comment_request_index.py`; see TDR-0017 for rollout and
  the limitation of installations that still retain the old sparse index.
- Passed: 15 focused tests covering real MongoDB startup with legacy records,
  repeated lifespan/preflight requests, scoped uniqueness, existing-index coexistence,
  Google login persistence/rejection, and security. Tests used isolated local MongoDB
  on 27027, Redis emulator on 6389 and S3 emulator on 9010; no production fixtures.
  The initial test attempt hit local S3 region configuration; setting the emulator
  region to us-east-1 resolved it.
- Passed: Ruff and mypy on changed Python files; workspace-scoping check; six
  frontend typecheck/build tasks (cached, existing large-chunk warning).
- Production rollout/health and an interactive fresh Google sign-in remain to be
  confirmed. No OAuth callback code from the report was replayed.
- Hotfix `7191804` was pushed to GitHub `main` from an isolated worktree based on
  `11fea12`; the same 15 tests passed on that exact deployment branch. Unpublished
  local account/session changes were preserved locally and excluded from the push.
  Direct production health requests timed out from this machine, and Railway CLI
  access was unavailable, so deployment success is not claimed.

## External dependencies and unresolved product decisions

AI provider authorization/configuration; billing provider/prices/webhook credentials; verified guest domain restrictions; real email delivery credentials; password/2FA/SSO policy. Core local implementation can proceed independently. The HTML's simulated accounts, fake 2FA QR, in-memory credits and checkout toasts must never be copied as working product behavior.

## Verification commands

`pnpm turbo run lint typecheck build`; backend `ruff check`, `mypy app/`, `pytest`, `scripts/check_workspace_scoping.py`; regenerate `packages/types` from locally exported FastAPI OpenAPI without requiring a production server. Integration tests require isolated MongoDB, Redis and S3-compatible storage. Record unavailable infrastructure honestly; never substitute test counts from the historical README.
