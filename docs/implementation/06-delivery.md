# Delivery and verification ledger

## 2026-09-08: Post-login UI migration — clients and activity slice (corrected)

- A prior uncommitted pass at this slice rewrote `ClientsPage`/`ActivityPage` onto
  classnames copied verbatim from `backline-Final Draft.html`'s own embedded
  stylesheet (`.wrap`, `.head`, `.toolbar`, `.search`, `.rows`, `.cl-row`, `.cl-head`,
  `.act`, `.act-day`, `.act-ic`, `.card-new`, `.sel`, `.kbd`, `.btn-new`, `.btn-solid`,
  `.btn-quiet`, `.modal-body`, `.modal-foot`, `.field`, `.req`, `.hint`, `.ghost-btn`,
  `.chipf`, `.top-right`, `.seg`, `.plus`). None of those selectors exist in
  `apps/web/src/styles/backline.css` — confirmed by grepping the stylesheet for every
  one of them — so both pages would have rendered with no brand styling at all
  (default block/inline layout, no ink/paper/mint treatment, no 3px geometry). This
  violated the base prompt's "follow the established Backline brand from
  apps/web/src/styles/backline.css" / "reuse existing … shared components" rule. This
  entry replaces that pass; the earlier log text above it is no longer accurate and is
  superseded by this one.
- Rebuilt `ClientsPage` on the real `bl-` design system already used by every other
  migrated route: `.bl-wrap`/`.bl-head`/`.bl-head-actions`, `.bl-toolbar.wrap` +
  `.bl-search` (the same label/icon-span/input markup `ProjectsPage` uses) with an
  Escape-to-clear key handler, `.bl-table`/`.bl-table-wrap` for the row list (the same
  primitive the pre-existing `ClientsPage` and `MembersPage` tables use), `.bl-avatar`
  + `.bl-text-button` for the client/contact lockup, `.bl-chip`/`.bl-chip-row` for the
  linked-project list capped at 3 with a "+N more" chip, `.bl-select` for the existing
  row-actions dropdown, and `.bl-empty` for the empty state. The add/edit dialog now
  uses `Dialog` + `.bl-compact-form`/`.bl-required`/`.bl-input` (the same field
  grouping `ProjectForm`/`ProjectMenu`'s rename dialog use) and the archive
  confirmation uses `.bl-dialog-intro` + `.bl-dialog-actions` with `.bl-quiet`
  (cancel) / `.bl-button danger` (confirm) — the same confirm-footer pattern
  `ProjectMenu`'s `ConfirmAction` uses — instead of an unstyled ad hoc footer.
- Rebuilt `ActivityPage` on `.bl-tabs` for the event-type filter (the same
  underline-tab component `ProjectsPage`'s type tabs use, not a bespoke `.seg`),
  `.bl-group-title` for day headers, and the pre-existing `.bl-activity` card/article
  list (already defined in `backline.css` for exactly this page). Added one
  genuinely new but on-brand touch: a per-event-category color (`EVENT_META`, a
  `Record` of `{icon, color}` keyed by the event-type prefix), the same "small local
  colour map applied via inline `style`" convention `PRIORITY_META`/`STATUS_META`
  already use in the comments panel, painted onto the existing `.bl-avatar` icon slot
  instead of introducing new circular icon CSS. Pagination uses the existing
  `.bl-pagination` component instead of one-off inline styles.
- No behavior/data-contract changes: client-side search against the loaded client
  array, the archive/create/update mutations and their query-key invalidation, and
  activity's offset/event-type/date-grouping query all match the pre-existing
  contracts exactly — only markup and class names changed.
- Also reverted one unrelated stray whitespace change (trailing spaces on a
  ` ```text ` fence line) in `docs/implementation/10-ui-migration-chat-prompts.md`
  left over from the same prior pass.
- Not run at the user's request: lint, typecheck, build, automated tests, local
  preview, browser interaction QA, keyboard journey QA, and responsive screenshot
  comparison. Every classname used was verified against `backline.css` by direct
  grep (not assumed), but the file has not been rendered in a browser in this pass —
  visual/responsive verification is still required before this is considered done.

## 2026-09-08: Post-login UI migration — workspace tickets slice

- Migrated `TicketsPage` and its component tree to the Final Draft's workflow surface,
  reusing the priority/status/due-date visual language the comments-panel slice already
  built (`PRIORITY_META`, `STATUS_META`, `dueMeta` in
  `features/projects/panel/comments/types.ts`) instead of a second copy, plus the
  shared `Dialog`, `Avatar`, `bl-comment-popover`/`bl-review-menu-row` popover pattern,
  and existing icon set.
- Added `TicketToolbar` (Sort / Group / "Show work for" popovers, replacing three plain
  `<select>`s) matching the root HTML's `tsortPop`/`tgrpPop`/`whoPop`; a new dense
  `TicketRow` list view (priority bar, single-line title/subtitle, status and priority
  quick-edit, tag filter chips, stacked assignee avatars, due badge) alongside the
  existing `StatusSelect`/priority-select/date-input inline editing so list mode kept
  every control table mode already had; and a `TicketTable` with sortable column
  headers (Project/Status/Priority/Due, driving the same `sort` URL param the toolbar
  does) and a click-to-filter project-name cell. Board and calendar cards gained a
  priority-colored edge, due badges, and stacked assignee avatars (board now takes a
  `members` prop); existing drag-to-change-status and drag-to-set-due-date persistence
  (already backed by the real `updateComment` mutation) were not touched.
- Added the header tab counts (Everyone/Assigned to me/Needs your reply/Waiting on
  client/Overdue) from the existing workspace dashboard summary query, a unified
  "Filtering by" active-filter chip row (status/project/priority/tag/assignee, each
  independently clearable), and empty-state "Show all tickets"/"New ticket" actions.
- `NewTicket` gained the due-date and tags fields `TicketCreate` already supports but
  the form omitted, using the same `DatePicker`/chip-toggle pattern as `TicketDetail`.
  A screenshot/attachment control is shown disabled with a "Coming soon" badge:
  `TicketCreate` has no attachment field, so this mirrors the root HTML's control
  without simulating an upload that would silently drop the file.
- Honesty decision, not a new product/interaction contract beyond TDR-0018/TDR-0019:
  the dashboard ticket-list API's `assignee` filter takes one value
  (`TicketFilters.assignee: str | None`), unlike the reference's in-memory multi-person
  filter, so "Show work for" is a single pick (selecting someone else replaces the
  previous selection) rather than a multi-select the backend cannot honor. No bulk
  ticket-selection UI was added — no bulk endpoint exists to back it.
- Existing React Router structure, all React Query keys/invalidation
  (`invalidateTicketsAndDashboard`), the `updateComment`/`createTicket`/`createReply`
  API calls, URL-encoded filters (search/status/project_id/priority/tag/view/sort/
  group/display/assignee/offset/ticket), and workspace authorization were preserved.
  No backend, database, generated API declaration, or widget file was changed.
- Not run at the user's request: lint, typecheck, build, automated tests, local
  preview, browser interaction QA, keyboard journey QA, and responsive screenshot
  comparison. The final diff was inspected for scope only; release verification,
  including confirming the new sortable-header/filter-cell/toolbar-popover markup
  compiles and renders correctly, remains required before this is considered done.

## 2026-09-08: Post-login UI migration — project side panel and comments slice

- Migrated `ProjectSidePanel` and its Comments/Details/Integrations/MCP/AI tabs off
  the pre-migration Tailwind theme onto the Final Draft `bl-` brand, reusing the
  vocabulary already shipped for `ShareProjectModal`, `TicketDetail`, and the review
  workspace toolbar rather than inventing a new one. TDR-0019 records the specific
  reuse, scope and behavior decisions.
- Rebuilt the `CommentsTab` tree (`StatusChips`, `FilterSortBar`, `ViewOptionsBar`,
  `CommentsList`, `CommentRow`, `comments/types.ts`): status label/color now come from
  `@backline/ui`'s shared workflow module instead of a second, drifting copy; added
  the previously-missing device-type and assignee filter sections; comment cards now
  show priority, due date (with overdue/due-today/due-tomorrow language), tags,
  assignee avatars, `@mention` highlighting, screenshot previews (and a capture-failed
  note), attachment chips, a layer badge (client-visible/team-only) on every row, and
  an anchor-recovery badge for orphaned/low-confidence comments. Loading uses real
  skeletons, and a dedicated error state with retry now exists (previously absent).
  Grouping by page resolves real page titles/URLs instead of a raw page id.
- Wired `CommentThreadPanel` into the Comments tab as an "open thread" action on every
  row (distinct from the row's existing click-to-navigate-to-pin behavior, which is
  preserved), and rebuilt it on the shared `Dialog` component with status, priority,
  tags, assignees, due date, and waiting-on/waiting-on-client editing - the same
  fields and components (`DatePicker`, `PeoplePicker`) `TicketDetail.tsx` already uses
  for the same underlying comment record. `BoardPage.tsx`'s existing usage is
  unchanged. Fixed a pre-existing bug where assignee/waiting-on ids were compared
  against the wrong member field (workspace membership id instead of user id),
  meaning a saved assignee could never show as selected again.
- Restyled `DetailsTab`, `IntegrationsTab`, `McpTab`, `AiTab`, `CollaboratorsModal`,
  `ProFeatureModal`, and `UpgradeToProModal` onto the same brand; `CollaboratorsModal`/
  `ProFeatureModal`/`UpgradeToProModal` now use the shared `Dialog` component (native
  modal semantics, focus containment/return, Escape) instead of hand-rolled overlay
  divs. MCP connectors, workspace-integration quick toggles, and BugHunt AI remain
  visibly static/gated - no fake connection, AI, or billing success was added.
- Existing React Query keys/invalidation, comment/reply/attachment API calls,
  workspace/member/share-link data, authorization boundaries, and the widget's
  `postMessage` pin-navigation contract were preserved. No backend, database,
  generated API declaration, or widget file was changed.
- Not run at the user's request: lint, typecheck, build, automated tests, local
  preview, browser interaction QA, keyboard journey QA, and responsive/mobile-sheet
  screenshot comparison. The final diff was inspected for scope; release verification
  is still required. One known pre-existing accessibility nesting concern was not
  changed in this pass: `CommentRow`'s clickable row (`role="button"`) still contains
  further interactive buttons (resolve/menu/reply), inherited from before this slice.

## 2026-09-08: Post-login UI migration — project review workspace slice

- Migrated `ProjectLayout` and the website `ProjectOverviewPage` to the Final Draft's
  focused review workspace: compact project/environment/URL header, URL-backed page,
  mode, viewport, orientation and zoom state, keyboard page-tab navigation, genuine
  open-review/share actions, safe-proxy browser frame, and a dense bottom status bar.
- Reworked the canvas around the existing private proxy and separately bundled widget.
  Loading, timeout/failure, no-link, snippet-only-link, cross-origin-page, archived,
  project-query and page/share-query states are explicit. No public proxy, layout mock,
  localStorage data, or simulated network success was added.
- Preserved widget-owned comment placement and navigation, and added a persistent
  selected comment row/status after the side panel asks the iframe to reveal its real
  pin. The panel launcher now uses the ink/paper/mint rail on desktop and a usable
  bottom launcher/sheet arrangement at narrow widths; the panel's full content
  migration remains Slice 04 scope.
- Rebuilt viewport and version controls with grouped responsive presets, bounded custom
  dimensions, real revision-history loading/empty/error/current states, and the shared
  React Query key factory. Browser emulation, deploy-triggered capture and alternate
  preview sources remain honestly unavailable rather than pretending to change server
  or widget behavior.
- Existing React Router structure, workspace authorization resolution, React Query API
  calls and cache updates, project/page/share dialogs, and website-versus-asset routing
  were retained. No backend, database, generated API declaration, or widget file was
  changed.
- Not run at the user's request: lint, typecheck, build, automated tests, local preview,
  browser QA, responsive screenshot comparison, and end-to-end keyboard QA. The final
  source diff was inspected only; release verification remains required.

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
