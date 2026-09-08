# Backline — Master HTML Integration, Implementation Gap & Senior Code Review Audit

**Date:** 2026-09-07  
**Purpose:** single execution document for a high-capability coding agent after integrating the supplied Final Draft HTML into the existing Backline product.  
**Mode:** audit/review only. **Do not make code changes merely because this file mentions them; re-verify current working-tree behavior first.**  
**Primary objective:** avoid redoing correctly implemented work, find real regressions/gaps/security issues caused or exposed by the HTML integration, and finish the product in the established Backline architecture rather than copying prototype behavior literally.

---

## 1. Inputs, evidence quality, and hard limits

This document consolidates and deduplicates:

1. `backline-Final Drafthtml` — supplied prototype/product-interaction reference.
2. `07-html-parity-audit.md` — exhaustive parity inventory: **FD-AUD-001..054**, **UX-AUD-001..084**, **LANG-AUD-001..009**.
3. `08-senior-code-review-audit.md` — read-only implementation review against the then-current dirty working tree.
4. `audit-review-summary.md` — shorter summary; useful context, but superseded where the senior audit is more specific.
5. Backline engineering specs in `docs/spec/**`, accepted TDRs in `docs/tdr/**`, and existing implementation.

### Evidence confidence

- **HTML baseline: verified.** Supplied HTML SHA-256 is `27455b8ef30395a1724016da3ad70575c74b816da32037e3ce87e981e95afba4`, size **571,683 bytes**, **6,720 lines**. This matches the resolved baseline in FD-AUD-001.
- **Parity audit: exhaustive source inventory.** Treat it as the authoritative list of prototype-derived behaviors, not as proof that the current code does or does not implement them.
- **Senior audit: code-observation evidence from 2026-09-07.** It reports repo `F:\qa tool\app`, `main`, commit `d8564c2 feat: add workspace global search`, with roughly 200 modified and 15 untracked files. Those observations are valuable, but the next agent **must re-run `git status`, inspect diffs, and re-test** because the working tree may have changed since that review.
- **Current unpushed tree is not independently re-opened by this consolidation pass.** Therefore phrases such as “exists”, “untracked”, “unused”, or exact line numbers derived from the senior audit are **review evidence to verify**, not a fresh guarantee.

### Source-of-truth precedence

Use this order for every conflict:

1. Accepted `docs/tdr/**` decision.
2. `docs/spec/**` engineering specification.
3. Current implementation.
4. Final Draft HTML as product/interaction evidence.
5. New assumptions in this document.

Never “fix parity” by regressing an accepted architecture decision.

---

## 2. Non-negotiable architecture constraints before touching code

### 2.1 Backend layering

Keep `router -> service -> repository -> MongoDB`. Routers own HTTP concerns only; services own business/authorization/orchestration; repositories own DB access. Do not preserve or introduce raw `db.*` calls in routers/services for convenience.

### 2.2 Server state and frontend state

React Query owns server state. URL/search params own shareable filter/view state where TDRs say so. Zustand is only for genuinely shared ephemeral UI state. Do not duplicate project/comment/member/API truth in Zustand.

### 2.3 API contracts

Pydantic backend schemas are canonical. Generate TypeScript API types from OpenAPI. Do not manually duplicate DTOs/enums. Add CI drift detection after schema changes.

### 2.4 Multi-tenancy and guest privacy

Every tenant-owned read/write must be workspace scoped. Workspace/role/project/share checks must be enforced server-side. Guest/client endpoints and WebSocket channels must never reveal team-only data, even through counts, notification bodies, presence, metadata, export, or error details.

### 2.5 Review SDK authentication

Do **not** introduce a separate `projectToken` authentication model because older SDK spec text shows one. Accepted architecture uses the **share-link authentication model** for supported review approaches. Conceptually keep `Backline.init({ shareToken, apiBaseUrl? })` unless a new TDR intentionally changes it.

### 2.6 Screenshot upload key

Screenshot upload occurs before comment creation. Do not require a comment ID in the storage key. Use a UUID-style key under workspace/project, e.g. `screenshots/{workspace}/{project}/{uuid}.jpg`, per the accepted TDR/project decision. Older `18-Storage-Deployment.md` text containing `{comment_id}` is stale relative to that decision.

### 2.7 Anchor/revision/recovery separation

Anchor generation and snapshot generation must share the same node identity/hash implementation. Page diffing and anchor recovery are distinct responsibilities: recovery independently searches for the best node in the new snapshot. Do not make the diff artifact the authoritative recovery decision input if accepted TDR-0007 says otherwise. Permanently orphaned comments do not retry forever; manual re-anchor can reset recovery state.

### 2.8 Realtime

WebSocket events update React Query caches rather than creating another server-state store. Prevent duplicates between optimistic comment creation and `comment.created`. Guest subscriptions remain privacy-scoped and must not receive staff-only presence/data.

### 2.9 Proxy mode

Proxy mode is intentionally limited. Do not turn parity work into a universal browser proxy. Preserve known limits around JS navigation, fetch/XHR, History API, CSS URLs, `srcset`, non-GET forms, and target-site cookies unless architecture intentionally changes.

### 2.10 Prototype-only behavior

The HTML's seeded credentials, fake AI results/credits, fake checkout, fake provider states, and prototype-only toasts are evidence of desired UX only. They are **not production instructions**. AI/billing/provider functionality must remain honest until backed by real persistence, jobs, provider contracts, permissions, quota/entitlement logic, and failure handling.

---

## 3. What should receive only a quick regression check

Do not spend a full implementation cycle rebuilding these unless re-verification shows regression:

- Workspace-scoped project, client, ticket, activity, member, asset, and share-link APIs.
- Project creation, metadata update, client association, archive/restore, environment selection.
- Ticket status/priority/tags/multiple assignees/waiting-on/due date/filter/group/list/board/table/calendar/replies/CSV foundations.
- Client create/edit/project association/search/archive foundations.
- Activity pagination and tenant-scoped event feed foundations.
- Private asset upload, signed URLs, PDF rendering, multi-page navigation, image/PDF region comments, guest asset review foundations.
- Website proxy review, Browse/Comment mode, share links, guest name/passcode entry, guest sessions, replies, widget attachments, realtime comment events, anchor/recovery infrastructure.
- Member invite/role change/removal, workspace picker switching, integrations foundation, MCP/usage placeholder surfaces, notification read-state APIs.
- Existing lint/typecheck/build/focused tests/OpenAPI generation only count as complete **if they still run against the dirty tree**.
- **OTP + Google authentication is the chosen model.** FD-AUD-007/008 are intentional divergences; do not re-add password signup/reset because the HTML had them.
- **Fake AI and fake checkout should not be implemented.** FD-AUD-043/044 are intentional divergences until a real product decision/provider implementation exists.

Regression checks for the above still need security, route, mutation, realtime, and browser coverage; “foundation exists” does not mean every parity detail is done.

---

## 4. Consolidated severity order

### Stop-ship / P0

1. **M-01** Tenant/workspace/session authorization holes.
2. **M-02** Share-link/project/guest policy fields stored but not enforced.
3. **M-03** Destructive delete, retention, R2 cleanup, and audit integrity.
4. **M-04** Project review settings schema + actual enforcement.
5. **M-05** Auth/account/session model consistency and session ownership.
6. **M-06** Notification privacy/wiring and digest preference enforcement.
7. **M-07** DB indexes/query-shape safety for current hot paths.
8. **M-08** Typed mutation/export contracts, idempotency, CSV safety, pagination.
9. **M-09** Security/negative/browser acceptance suite before declaring parity complete.

### P1 core correctness and maintainability

10. **M-10** Shared UI primitives, forms, feedback, dialogs/popovers, dates/copy/validation.
11. **M-11** Shell/workspace/account/search/notification navigation behavior.
12. **M-12** Project dashboard/cards/wizard/filter/type/file lifecycle.
13. **M-13** Project lifecycle: settings/menu/pages/deploys/versions/duplicate/export/delete.
14. **M-14** Website/image/PDF canvas controls and asset lifecycle.
15. **M-15** Comment/thread/attachment/mention/move-resize/undo behavior.
16. **M-16** Ticket/board/calendar drag, keyboard, deep-link, filter semantics.
17. **M-17** Clients/activity/members/integrations management behavior.
18. **M-18** Localization foundation and translation-safe contracts.
19. **M-19** Accessibility/design-system consolidation.
20. **M-20** Resilience/performance/resource lifecycle/query synchronization.
21. **M-21** CI/OpenAPI/migration/docs/TDR reconciliation.

### P2 / intentional product decisions

22. **M-22** Desktop gate, visual prototype fidelity, coming-soon copy, theme/motion polish, real AI/billing decisions.

---

# 5. Detailed master workstreams

## M-00 — Baseline integrity and first-pass verification

**Severity:** gate  
**Source:** FD-AUD-001 + branch/working-tree note in senior audit.

### Already correct
- Supplied Final Draft HTML hash/size matches the resolved parity baseline.
- The audit inventory is comprehensive enough to use as traceability input.

### Required first actions
- Run `git status --short`, `git branch -vv`, `git rev-parse HEAD`, and inspect all unpushed/untracked files before coding.
- Recompute hash for `docs/reference/backline-final-draft.html` and compare with the hash above.
- Read accepted TDRs touching review auth, board URL state, realtime, recovery, proxy scope, notifications, launch readiness, and any newer TDR created after the senior audit.
- Build a small evidence table: `claim -> current file -> test -> verified/changed since audit`.

### Acceptance
- No later task is marked complete solely because either audit said it was complete.
- No old spec behavior is restored when an accepted TDR supersedes it.

---

## M-01 — Workspace/tenant/session authorization holes

**Severity:** P0 / stop-ship  
**Deduplicates:** BE-02 authorization findings + FD-AUD-039/042/053 + related UX error/permission points.

### Review evidence to re-verify
- `integrations/router.py` reportedly accepts `/{workspace_id}/...` without `require_workspace_match`, allowing a token scoped to workspace A to target workspace B's URL.
- Guest actor reportedly can `PATCH/DELETE` pages because page routes use a general actor dependency rather than member/project-management permission.
- `revoke_session_family` reportedly has no `family_id + user_id` ownership check.
- Project access is workspace-role-only; no project ACL exists despite prototype roles implying finer-grained access.

### Correct method
- Every workspace-ID route must enforce workspace context/match centrally.
- Every project/page mutation must resolve resource -> project -> workspace and require the correct permission; guest write access should be explicit and narrow, never inherited accidentally from a generic actor type.
- Session-family revoke must query by both current user and family ID; unknown/non-owned family is 404/403 with no leakage.
- Decide project-scoped ACL explicitly: either implement a `project_collaborators` model + `require_project_access` or record a TDR that Backline intentionally stays workspace-wide for the current product. Do not simulate ACL only in UI.

### Files/modules to inspect
`backend/app/modules/integrations/router.py`, `pages/router.py`, `pages/service.py`, `auth/router.py`, `auth/service.py`, `core/permissions.py`, `core/actor_access.py`, workspace/project access helpers, all routers containing `{workspace_id}`.

### Repo-wide checks
- `rg -n "require_workspace_match|require_workspace_context" backend/app/modules/*/router.py`
- `rg -n "get_current_actor" backend/app/modules/*/router.py`
- `rg -n "family_id|revoke_family" backend/app/modules/auth`
- Add an AST/CI rule for `/{workspace_id}/` routes that lack the workspace dependency, with explicit allowlist only where justified.

### Impact matrix
- **API/schema:** permission errors must remain typed 401/403.
- **DB:** no new denormalized workspace-less access path.
- **React Query:** permission failures should evict/redirect only relevant queries, not clear global data blindly.
- **Realtime:** verify guest/member subscriptions enforce the same workspace/project visibility.
- **Tests:** parameterized cross-tenant GET/PATCH/DELETE/WS tests for every module; session-family ownership test; guest page mutation denial.

---

## M-02 — Share-link/project/guest policy enforcement

**Severity:** P0 / stop-ship  
**Deduplicates:** FD-AUD-039..042, FD-AUD-047, UX-AUD-065..070, part of BE-02.

### Review evidence to re-verify
Policy-like fields such as `ask_reviewer_name`, `domain_restrictions`, `comment_export_permission`, `reviewer_can_resolve`, and `show_board_to_client` reportedly exist in schema/write paths but have zero enforcement reads. Guest-session creation reportedly accepts empty names even when name should be required. Expiry comparison logic differs between access helpers.

### Correct method
- Create typed policy submodels; avoid schemaless mutable defaults.
- Centralize `check_share_policy()` and `check_project_review_policy()` in service/access code.
- Apply those checks at **every** relevant operation: guest-session creation, comment status/resolve, board data, assignee/due visibility, export, allowed-domain verification, link regeneration/revocation/expiry, and realtime payload eligibility.
- Domain restriction must be verified server-side from trusted request/session context; never trust a client-provided origin string alone.
- “Show board to client” must produce a deliberately client-safe DTO/endpoint; do not reuse staff board payload and hide fields in React.

### Files/modules
`share_links/schemas.py`, `share_links/service.py`, `projects/schemas.py`, `comments/service.py`, board/dashboard services, export service, review bootstrap/guest-session service, widget bootstrap.

### Acceptance
- A guest cannot infer team-only data via counts, board cards, notification text, assignees, due dates, export, WebSocket, or errors.
- Expired/revoked/domain-restricted links fail consistently.
- Ask-name, resolve-own-comment, board visibility, export permission are server-enforced and covered by raw-API tests.

---

## M-03 — Destructive deletion, retention, R2 garbage collection, and audit integrity

**Severity:** P0 / stop-ship  
**Deduplicates:** DB-03, FD-AUD-022/048/051, UX destructive-action items.

### Review evidence to re-verify
- `hard_delete_project` reportedly deletes only the project document.
- `delete_page` reportedly cascades nothing and emits no audit event.
- No `delete_object` path reportedly exists for R2 assets/screenshots/attachments.
- Deleting a page can silently break project comment joins and leave R2/Mongo orphans.

### Correct method
- Keep delete UI disabled/hidden until deletion semantics are safe.
- Prefer archive/soft-delete for normal product lifecycle.
- For true hard-delete, implement a dry-run-first cascade workflow: enumerate affected collections and object keys -> report counts -> authorization/confirmation -> backup/retention gate -> delete R2 objects/tombstones -> delete Mongo in dependency-safe order -> emit one auditable summary event with counts/correlation ID.
- Page deletion should either block when referenced data exists or soft-delete with recoverability; it must never silently orphan comments/revisions.
- Add R2 tombstone/GC strategy and retry-safe worker behavior.

### Files/modules
`projects/service.py`, `pages/service.py`, `pages/repository.py`, `assets/service.py`, storage client, revisions/snapshots/comments/recovery repositories, new migration/cleanup scripts.

### Acceptance
- No hard delete can leave reachable DB rows pointing to missing data or orphan private blobs.
- Destructive jobs are idempotent/retryable, workspace-scoped, and auditable.
- Automated test seeds a realistic project graph, runs dry-run + delete, verifies counts and zero leftovers.

---

## M-04 — Persisted project review settings with real enforcement

**Severity:** P0  
**Deduplicates:** FD-AUD-018/045 + guest/comment/notification settings effects.

### Required settings from parity backlog
At minimum verify/implement the product decision for:
1. capture browser/device details;
2. re-anchor comments after deployment;
3. let reviewers resolve their own comments;
4. show ticket board to client;
5. email digest to client;
plus project type/environment/lineage/retention fields only if approved by the product model.

### Correct method
- Define a typed Pydantic `ProjectSettings` submodel and additive defaults/backfill.
- Persist under the established project settings model; do not scatter top-level booleans unless a TDR says so.
- Enforce each flag in the owning backend flow, not only UI.
- Frontend settings mutation uses generated types, narrow React Query update/invalidation, visible success/error state, and unsaved-change protection.

### Impact areas
Widget metadata capture, guest resolve mutation, client-board endpoint/DTO, notification/digest workers, revision/recovery trigger behavior, project settings UI, audit events.

### Tests
Default/backfill, toggle authorization, guest behavior per flag, realtime cache update, digest behavior, raw API leakage tests.

---

## M-05 — Auth/account/session model consistency

**Severity:** P0 for ownership/session safety, P1 for profile/2FA UX  
**Deduplicates:** FD-AUD-007..011, FD-AUD-046, UX-AUD-019, account-modal work.

### Preserve
- OTP + Google only. Do not reintroduce password sign-in/reset because the HTML contains it.

### Real gaps
- OTP ergonomics: `autocomplete="one-time-code"`, paste, resend cooldown/expiry/countdown, clear validation/error association.
- Account/profile/preferences UI and avatar persistence.
- Session list/revoke correctness and ownership.
- 2FA/TOTP only if product chooses it; if added, real encrypted secret + enrollment confirmation + recovery-code hashes + revoke semantics. Never copy the prototype QR flow as fake security.
- User preference date fields must be typed datetimes in API contracts.

### Acceptance
- OTP flow completes without password assumptions; refresh rotation/reuse/session revoke tested.
- Preferences persist and are consumed by notifications/localization.
- No password fields/collections are accidentally added by parity work unless a superseding TDR explicitly changes auth architecture.

---

## M-06 — Notifications, activity routing, privacy, and digest correctness

**Severity:** P0 privacy / P1 UX  
**Deduplicates:** BE-04, FD-AUD-006/038/049, UX-AUD-063, LANG email concerns.

### Review evidence to re-verify
- Reply/mention/status notification functions reportedly exist with no call sites.
- Assignment notification reportedly receives insufficient route metadata, leaving `target_route=None`.
- Digest reportedly ignores user preferences and may include team-layer bodies for all members.
- Event type strings are partly ad hoc rather than canonical constants.

### Correct method
- Notifications are emitted from domain service actions that create the fact: reply, mention, assignment, status change, integration failure, etc.
- Route metadata must be constructed from authoritative workspace/project/page/comment IDs and produce a stable deep link.
- Digest applies recipient preferences and visibility before rendering; team-only content must never reach a recipient who cannot view it.
- Store stable event/type codes; localize display text later at rendering time.
- Notification click routes to exact project/page/thread, not generic ticket detail.

### Tests
Per notification type: creation, unread count, mark read/all, realtime event, click target, preference off, team-layer privacy, deleted target fallback.

---

## M-07 — MongoDB indexes and query-shape verification

**Severity:** P0/P1 depending route scale  
**Deduplicates:** DB-01, FD-AUD-049/051, UX-AUD-080.

### Review evidence to re-verify
Candidate missing/weak indexes:
- notifications unread path around `(workspace,user,read_at,created)`;
- share links workspace+project+created;
- pages workspace+project+normalized URL;
- revisions workspace+page+captured/current;
- recovery logs workspace+comment+created;
- refresh token family lookup `(user_id,family_id)` / `(family_id,revoked_at)`;
- events `(workspace,type,created,_id)` for filtered activity;
- OTP active/consumed lookup;
- guest `last_seen_at` TTL behavior/touch.

### Method
- Add indexes **additively**, not by dropping old ones first.
- Capture representative query `explain()` before/after and realistic cardinality.
- Every index must match a real repository filter/sort shape and preserve workspace prefix where appropriate.
- Do not add denormalized count/name columns as an index workaround.

### Acceptance
Migration/index creation is idempotent; CI/integration test verifies index definitions; hot queries avoid collection scans at realistic seed size.

---

## M-08 — Typed mutation/export contracts, mass-assignment, idempotency, pagination

**Severity:** P0/P1  
**Deduplicates:** BE-01/03, FD-AUD-020/022/050/053, UX mutation/large-list points.

### Review evidence to re-verify
- Raw DB calls in service/digest modules bypass repository boundaries.
- Page update passes an untyped `changes: dict` into `$set`, creating mass-assignment risk.
- Project update has dual contract styles.
- CSV export reportedly returns header-only/stub data, lacks formula-injection sanitization and permission enforcement.
- Mutating POSTs lack a consistent idempotency scheme.
- Pagination varies across offset, cursor, slices, and unbounded arrays.

### Correct method
- Pydantic update models travel router -> service; service allow-lists domain changes; repository receives typed/normalized fields.
- Move all DB queries into repository methods with explicit workspace ID.
- Export must be typed/streamed, permissions checked, CSV formula cells escaped/prefixed safely, and large exports bounded/backgrounded if necessary.
- Add idempotency for retry-prone POSTs (`Idempotency-Key` or a canonical `client_request_id` unique per workspace/operation).
- Standardize list contracts: cursor/keyset for comments/search/notifications; bounded offset where UX truly needs page numbers; never unbounded project comment arrays at large scale.

---

## M-09 — Security, negative, browser, and regression acceptance suite

**Severity:** P0 release gate  
**Deduplicates:** FD-AUD-052/053/054, UX-AUD acceptance matrix, spec `19-Testing-CI`.

### Required negative tests
- Cross-workspace member token against every workspace/project/resource route.
- Guest attempts to fetch team layer, team counts, staff presence, assignee/due metadata, internal notifications, or export.
- Revoked/expired/passcode/domain-restricted share links.
- Empty/invalid guest name under ask-name policy.
- Guest page PATCH/DELETE denial.
- Session-family revoke ownership.
- CSV formula payloads (`=`, `+`, `-`, `@` leading values) remain inert.
- SVG active-content cases are rejected/sanitized.
- Hard-delete cleanup and retry failure cases.

### Browser journeys
Cover the 14 parity journeys from FD-AUD-052 plus critical spec journeys: login/workspace/project/share, mobile guest comment, realtime dashboard receipt, team-only reply privacy, revision/recovery, attachment lifecycle, project settings, page management, notification deep link, ticket keyboard workflow, slow/offline/reconnect states.

### Tooling gate
`pnpm turbo run lint typecheck build`, frontend tests, Playwright/axe, backend `ruff`, `mypy`, `pytest`, workspace-scoping check, OpenAPI generation drift check, dependency audit, widget bundle/performance budget.

---

## M-10 — Shared UI primitives, form state, feedback, dates/copy/validation

**Severity:** P1, high leverage  
**Deduplicates:** FE-06/08, UX-AUD-008..010, 019..031, part of 071..077.

### Review evidence to re-verify
- `Toast.tsx`, `use-focus-trap`, `use-click-outside`, `use-document-title`, `use-unsaved-changes` reportedly exist untracked/partially wired.
- `useToast` reportedly has zero feature consumers while `alert()` / `confirm()` remain.
- Five+ copy-to-clipboard implementations, several date/time implementations, copy-pasted search inputs, repeated `.trim()` validation.
- One native dialog and multiple hand-rolled overlays use inconsistent Escape/outside-click/focus behavior.

### Correct method
- One `Modal/Dialog` primitive: labelled, focus trap, Escape, dismissal policy, scroll lock, return focus.
- One `Popover/Menu` primitive with keyboard semantics and collision/viewport handling.
- One toast/live-region provider; replace browser `alert/confirm` with product UI.
- `useCopyToClipboard`, one locale-aware date/time formatter layer, shared `SearchInput`, typed form schemas, consistent `Field` error association, unsaved-change guard.
- Do not hide a destructive confirmation behind a generic toast.

### Repo-wide checks
`rg -n "alert\(|confirm\(|window\.confirm|queryKey:\s*\[|toLocale(Date|Time|String)|navigator\.clipboard" apps/web/src`

---

## M-11 — Application shell, workspace/account/search/notification navigation

**Severity:** P1  
**Deduplicates:** FD-AUD-002..006, UX-AUD-011..018, 032 and navigation parts.

### Subtasks
- **Workspace switcher:** wire the in-progress popover into `DashboardSidebar`, real switch-token flow, selected state, create workspace/slug preview, keyboard/outside-click/return-focus.
- **Account entry:** wire account identity to real profile/preferences/security modal/page; signout remains accessible.
- **Global search:** debounce, per-kind grouping/ranking/pagination, exact project/page/thread routes, permission-filtered results, empty/error states, `/` and Cmd/Ctrl+K with discoverability.
- **Notifications:** route-on-click to exact target with deleted/unauthorized fallback.
- **Route UX:** loading skeletons, not-found recovery, page title, focus restoration, breadcrumbs/back context, mobile project actions where supported.
- **Desktop gate:** keep responsive dashboard unless product decides otherwise; record decision and test below/above 1024px instead of blindly copying prototype gate.

---

## M-12 — Project dashboard, cards, filters, creation wizard, file types

**Severity:** P1  
**Deduplicates:** FD-AUD-012..017, UX-AUD-032..040.

### Required review
- Waiting-on-you ordering/context/count semantics.
- Project type tabs and honest coming-soon states.
- Filters: type/client/archive/search/sort plus product-approved status semantics and clear/legend behavior.
- Card preview loading/failed/stale states, actual thumbnails if architecture supports them, people/pins/deploy/recovery indicators, counts, duplicate action only after safe lifecycle implementation.
- New-project wizard as a real state machine with back/forward, validation, file drop/progress/retry/remove/replace, client selection/inline creation, reviewer invite only if backed by server/email behavior, completion screen/guest preview.
- SVG: either sanitize and sandbox end-to-end or reject consistently. Never allow an unsanitized SVG because one layer sniffs it while another forbids it.

### State impact
Project lists/cards remain React Query server state; wizard step and unsaved local form state stay component/ephemeral. URL filters remain URL-owned.

---

## M-13 — Project lifecycle: menu, pages, deploys/versions, duplicate/export/delete

**Severity:** P1, but delete path depends on M-03  
**Deduplicates:** FD-AUD-018..022 and lifecycle UX.

### Page management
Dashboard add/rename/reorder/remove with member authorization, typed updates, workspace/project checks, safe delete semantics, audit events, and active-page URL/deep-link behavior. Guest page registration remains separate from staff page management.

### Deploy/version history
Do not fake a version menu. If implementing, define the data model first (`deploys`/version metadata/revision links/recovery-run summary), how a deploy relates to existing revision engine data, and what historical comments/anchors mean. Avoid duplicating revision truth in a second incompatible model.

### Duplicate
Specify exactly what duplicates: project metadata/settings/pages/share links/comments/assets/revisions? Default safe choice is metadata/settings/pages without comments/history unless product says otherwise. Record lineage and audit event.

### Export
Project-specific export follows M-08 safety/permissions and client/team visibility rules.

### Delete
Blocked until M-03 cascade/retention is production-safe.

---

## M-14 — Website preview, image/PDF canvas, page navigation, asset lifecycle

**Severity:** P1  
**Deduplicates:** FD-AUD-023..026, UX-AUD-041..046, resource lifecycle issues.

### Website preview
Explicit loading/progress, timeout, retry, failed/blocked-frame diagnostics, open-original/new-tab safety, Browse/Comment state, viewport/orientation/zoom/reload controls only where they actually affect review context.

### Page navigation
Project/page header, registered page list, active page, per-page counts, deep links, page selection feedback. Do not confuse dashboard page management with widget's idempotent page registration.

### Image/PDF
Zoom, rotation if approved, page navigation, download with signed URL, loading/error state, add/replace/remove/reorder lifecycle, region-comment coordinate transforms across zoom/rotation.

### Pointer/keyboard/touch
No pointer-only region or pin editing. Provide keyboard equivalents and 44px mobile targets where reviewer UI requires it.

### Resource cleanup
Revoke object URLs/listeners, abort stale fetches, avoid polling when WebSocket provides freshness, handle signed-URL refresh.

---

## M-15 — Comments, threads, attachments, mentions, move/resize, undo

**Severity:** P1, privacy-sensitive  
**Deduplicates:** FD-AUD-027..031, UX-AUD-047..055, FE-04/09.

### Architecture cleanup
Split oversized `CommentsTab.tsx`, `BoardPage.tsx`, widget `ui.ts`/`index.ts` before adding more behavior. Reuse canonical workflow status/layer components.

### Filters/thread detail
Status/layer/page/assignee/device/browser/tag/sort/group/hide-resolved only if they are product-approved; keep URL/shareability rules consistent. Thread deep link must survive reload/back/forward.

### Attachments/screenshots
Dashboard replies need the same safe attachment lifecycle as widget where required: upload progress, retry, preview, delete, signed reads, correct visibility. Screenshot failures must not block comment posting.

### Mentions
Do not keep a notification type without a parser/recipient model. Define mention tokenization, stable member IDs, edit behavior, duplicate recipient suppression, permission checks, notification emission, and plain-text rendering.

### Move/resize/reanchor
If the product needs post-placement editing, add a dedicated typed endpoint and distinguish **visual region resize** from **anchor manual reassignment**. Validate target page/project/workspace, clamp geometry, detect stale/concurrent edits, audit the change, and update realtime caches.

### Undo/redo
Only implement reversible actions with well-defined server-safe inverse semantics. Otherwise record a TDR/wont-do; do not build a local-only history that lies after server state changes.

---

## M-16 — Tickets, board, calendar, drag/drop, deep links

**Severity:** P1  
**Deduplicates:** FD-AUD-032..035, UX-AUD-056..060, FE-03/04/05.

### Preserve what works
List/board/table/calendar/group/replies/CSV, filters, status/priority/tags/multi-assignee/waiting/due foundations reportedly exist.

### Fixes
- Single workflow status source of truth across comments/board/tickets/widget; eliminate `todo` label drift (`To do` vs `Not started`).
- Split `TicketsPage.tsx` components/data hooks.
- Put shareable view/deep-link state in URL; `?comment=<id>` must be bidirectional, not seeded once into local state.
- Drag/drop uses optimistic React Query update + rollback + audit/event, but keyboard menu/select provides equivalent operation.
- Accessible date picker with Today/Clear/nav, locale-aware week/day names, timezone semantics, validation.
- Clickable rows/cells and ticket detail have exact route/not-found behavior.

---

## M-17 — Clients, activity, members, integrations

**Severity:** P1  
**Deduplicates:** FD-AUD-036..038, UX-AUD-061..064.

### Clients
Open/resolved/reviewer/last-activity/total values should be repository aggregations, not duplicated count columns. Add responsive summary behavior, menu actions, archive recovery/confirmation, export only when permission-safe.

### Activity
Filters Everything/Mine/Clients/Deploys, Today/Yesterday/Earlier grouping, stable event icons/copy, exact destinations, and `(workspace,type,created)` query/index support. Activity remains a human rendering of append-only `events`, not a parallel history database.

### Members/integrations
Honest provider configuration states, secret masking, test-connection/error/retry, disconnect audit, per-project scoping only if backed by the integration model and authorization. Recheck integration workspace-match hole from M-01.

---

## M-18 — Localization foundation

**Severity:** P1 foundation; translations themselves can stage  
**Deduplicates:** LANG-AUD-001..009 and UX expansion/date/ARIA issues.

### Review evidence to re-verify
Senior audit reports `lib/i18n.ts`, `use-locale.ts`, `locales/en|hi-IN` as partial starts, roughly 21 keys vs 500+ strings, unsafe `as TranslationKeys`, multiple date systems, hardcoded weekdays/plurals, no complete locale preference/fallback contract.

### Correct rollout
1. Complete English extraction first; every product string, placeholder, validation, ARIA label, toast, modal, empty/error/loading state gets a stable key.
2. Define locale ownership: user preference -> workspace/default/browser fallback; persist authenticated preference and guard browser storage errors.
3. One locale-aware date/number/relative-time layer using the active locale/timezone.
4. Backend sends stable error/event codes; frontend/email/widget localize presentation.
5. Widget locale plumbing must preserve bundle budget; use lightweight catalogs/chunks if needed.
6. Add pseudo-locale expansion/missing-key CI.
7. Only after English is complete, validate one full additional locale (e.g. `hi-IN` if product audience warrants it), then RTL readiness with logical CSS/bidi isolation before Arabic/Hebrew.

### Do not translate
User-authored comments, provider payloads, URLs/IDs, or third-party content unless a separate translation feature is approved.

---

## M-19 — Accessibility and design-system consolidation

**Severity:** P1  
**Deduplicates:** FE-07/08, UX-AUD-001..007 and 071..077.

### Review evidence
Three styling dialects reportedly coexist: `backline.css` `bl-*`, Tailwind, `packages/ui`; dark mode only applies to some paths. Raw Unicode/emoji icons coexist with SVG icon libraries. Focus-trap helper exists but is unused by the main dialog.

### Correct method
- `packages/ui` is the component API; Tailwind/design tokens are implementation; reduce `backline.css` toward tokens/legacy bridge rather than a parallel component system.
- One canonical icon library/component exports; remove platform-dependent glyphs for controls.
- Canonical `StatusBadge`/`LayerBadge` must use label + icon + color, not color alone.
- Decide dark-mode contract: fully support or explicitly light-only for current dashboard slice; do not leave half-themed screens.
- Add skip link, landmarks, one logical H1, focus-visible, accessible names/state attributes, live-region policy, reduced-motion, keyboard completion, zoom/reflow/orientation checks.
- Board/pin drag always has keyboard alternative.

---

## M-20 — React Query synchronization, resilience, large data, resource lifecycle

**Severity:** P1  
**Deduplicates:** FE-01/02/03 + UX-AUD-078..084.

### React Query evidence to re-verify
- Ad-hoc `queryKey: [...]` arrays outside `query-keys.ts`.
- Three independent comment upsert implementations.
- Whole-workspace invalidation for narrow mutations.
- Asset polling despite WebSocket freshness.
- Board view/open thread partly local rather than URL-owned.

### Correct method
- Expand central `qk` factory and prohibit ad-hoc keys via lint/code review.
- Shared cache merge/upsert helpers for `comment.created/updated/recovery_updated`; handle optimistic-ID reconciliation to avoid duplicate WS insertion.
- Narrow mutation invalidation; polling only where no realtime fact exists.
- Query stale/loading/error/skeleton contracts per surface.
- Debounced search with cancellation/placeholder data.
- Large lists use server pagination/windowing where scale requires it.
- Error boundaries show safe correlation IDs, retry when safe, never expose secrets/PII.
- Privacy-safe telemetry: route/error code/correlation ID/performance, not comment bodies, passcodes, tokens, screenshot URLs, or provider secrets.

---

## M-21 — CI, OpenAPI drift, migrations, docs/TDR reconciliation

**Severity:** P1 release discipline  
**Deduplicates:** FD-AUD-054, senior acceptance section, spec engineering rules.

### Required gates
- Regenerate OpenAPI types in CI and fail on diff: conceptually `generate && git diff --exit-code packages/types`.
- Workspace-scoping lint/script must actually exist at the path CI/tests invoke; fix path drift instead of assuming it runs.
- Add lint/checks for ad-hoc React Query keys, raw browser alerts/confirms, direct `toLocale*` where disallowed, raw glyph controls, workspace-less destructive queries, unenforced policy fields where mechanically detectable.
- Add dry-run-first migration/backfill tooling for schema/index/retention changes.
- Update `docs/implementation/02-flow-matrix.md` and `06-delivery.md` per slice with exact status and file/test evidence; never label unpushed/unwired scaffolding “delivered”.
- Any architecture/product divergence gets a dated TDR.

### Explicit stale-doc reconciliation candidates
- Older Review SDK `projectToken` text vs accepted share-link auth TDR.
- Older R2 screenshot `{comment_id}` key text vs pre-comment upload UUID decision.
- Older board-Zustand wording vs TDR putting shareable filters in URL params.
- Older recovery orchestration prose vs TDR separating diff artifact from actual anchor matching decision.

---

## M-22 — Product decisions and low-risk parity polish

**Severity:** P2 unless product promise makes it higher.

- Desktop dashboard gate vs responsive behavior: record the decision and test it.
- Coming-soon copy, roadmap dates, “notify me” only if there is a real notification capture flow.
- Project preview/card visual fidelity, control density, motion, reduced-motion, theme, tooltips.
- AI and billing remain placeholders until real architecture/providers/entitlements exist. A fake credit counter or fake checkout is a regression in product honesty.

---

# 6. Cross-cutting implementation rules for every task

For each task, the coding agent must write a mini impact note **before editing**:

`Requirement -> owning module -> relevant TDR/spec -> current data flow -> DB/API/schema -> React Query/cache -> realtime -> security/workspace/guest -> storage/cleanup -> accessibility/responsive/i18n -> tests.`

Then apply these rules:

1. **Modify the established pattern, not a parallel subsystem.**
2. **Pydantic types first** for API/domain changes; regenerate TS types.
3. **Repository owns Mongo access.** Every tenant query includes workspace scope.
4. **Server enforces policy.** UI visibility is convenience only.
5. **React Query owns server state.** URL owns shareable route/filter state; local/Zustand only ephemeral UI.
6. **Realtime follows the same visibility boundary as REST.**
7. **Storage mutation includes cleanup/retention/audit.**
8. **Every new interaction has loading/error/success/empty/keyboard/touch behavior.**
9. **Do not add new libraries/state systems/collections without proving the existing architecture cannot support the requirement and filing a TDR where appropriate.**
10. **No claim of done without tests/evidence.**

---

# 7. Verification commands / repo-wide searches

Use/adapt these after re-checking actual paths:

```bash
# Working tree / scope
git status --short
git branch -vv
git rev-parse HEAD

# React Query/state
rg -n "queryKey:\\s*\\[|invalidateQueries|setQueryData|refetchInterval|\\.refetch\\(\\)" apps/web/src --glob '*.{ts,tsx}'
rg -n "useSearchParams|useState.*view|useState.*openThread|searchParams\\.get" apps/web/src/features --glob '*.tsx'

# UI primitives / dates / copy
rg -n "alert\\(|confirm\\(|window\\.confirm|navigator\\.clipboard|toLocale(Date|Time|String)" apps/web/src --glob '*.{ts,tsx}'
rg -n "<dialog|role=\"dialog\"|fixed inset-0|bl-popover" apps/web/src --glob '*.tsx'

# Backend layering/scoping
rg -n "db\\.[A-Za-z_]+\\.(find|aggregate|update_one|delete_one|delete_many|count_documents)" backend/app/modules --glob '*service.py'
rg -n "require_workspace_match|require_workspace_context" backend/app/modules/*/router.py
rg -n "delete_one|delete_many|delete_object|hard_delete" backend/app/modules

# Policies/notifications
rg -n "domain_restrictions|ask_reviewer_name|comment_export_permission|reviewer_can_resolve|show_board_to_client" backend/app --glob '*.py'
rg -n "notify_comment_|target_route|daily_digest|notify_on_" backend/app/modules

# DB/indexes
rg -n "create_index|expireAfterSeconds" backend/app/core/indexes.py

# i18n
rg -n "useTranslation|TranslationKeys|toLocale(Date|Time|String)|Intl\\." apps/web/src --glob '*.{ts,tsx}'

# Widget
rg -n "projectToken|shareToken|STATUS_LABELS|timeAgo|openComposer|openThreadView" apps/widget/src docs/spec docs/tdr --glob '*.{ts,md}'
```

Also list files over ~400 lines before each frontend/widget slice and split only where responsibilities are genuinely mixed.

---

# 8. Definition of Done for the integrated HTML change set

Do **not** use “looks like the HTML” as Definition of Done. The integration is done only when:

- Every P0/P1 master workstream is fixed or has an explicit accepted wont-do/TDR.
- Every source audit ID in the traceability ledger below maps to a master workstream and has a final evidence status.
- No cross-workspace or guest/team leakage is found in raw API or WebSocket tests.
- No stored permission/policy flag is presentation-only when it represents a security/product boundary.
- Destructive delete paths have complete retention/R2 cleanup/audit semantics.
- Query keys/invalidation/realtime do not duplicate comments or leave stale cross-screen state.
- Core routes have loading/empty/error/retry/success and keyboard behavior.
- OpenAPI generation produces no uncommitted type drift.
- `pnpm turbo run lint typecheck build`, frontend tests/E2E/axe, `ruff`, `mypy`, backend `pytest`, workspace-scoping lint, and relevant migration/index tests pass on the actual working tree.
- Documentation and accepted TDRs match what is shipped.

---

# 9. Final execution checklist for the next coding agent

1. Re-read accepted TDRs first; produce a conflict list against old spec/HTML.
2. Snapshot working tree and classify modified/untracked files by master workstream.
3. Verify M-01/M-02/M-03/M-05 before polishing UI.
4. Add/repair tests that reproduce each P0 defect before or with the fix.
5. Apply DB/index changes additively with dry-run/explain evidence.
6. Finish partially built shared primitives before creating more one-off UI.
7. Normalize React Query keys/cache updates before extending comments/tickets.
8. Implement lifecycle features only after their data/retention contracts are explicit.
9. Complete English/i18n foundation before translating isolated screens.
10. Run the full acceptance matrix and update delivery docs with concrete evidence.
11. Never mark a task complete because a file exists; it must be wired, reachable, secure, and tested.
12. If current code disproves an audit finding, update this master ledger with the evidence instead of “fixing” already-correct code.

---

# 10. Complete source traceability ledger — no omitted audit IDs

The following table contains **all 147 source audit IDs**. It is intentionally compact: duplicates are resolved by mapping each source point into the master workstream(s) above. The original audit remains useful for exact HTML line references, but the next agent should execute from the master workstreams and record final evidence here.

| Source ID | Original audit point | Source status | Priority | Master workstream |
|---|---|---|---|---|
| FD-AUD-001 | Repository reference does not match the supplied HTML | [x] Resolved 2026-09-07 | P0 | M-00 |
| FD-AUD-002 | Desktop gate behavior | [~] Partial / intentional divergence | P2 | M-11 |
| FD-AUD-003 | Workspace switcher and create-workspace modal | [~] Partial | P1 | M-11 |
| FD-AUD-004 | Account button in the application shell | [ ] Pending | P1 | M-11 |
| FD-AUD-005 | Global search | [~] Partial | P0 | M-11 |
| FD-AUD-006 | Notification list behavior | [~] Partial | P1 | M-11 |
| FD-AUD-007 | Password sign-in | [x] Intentional divergence | P0 | M-05 |
| FD-AUD-008 | Account creation and password reset | [x] Intentional divergence | P0 | M-05 |
| FD-AUD-009 | Login usability controls | [~] Partial | P2 | M-05 |
| FD-AUD-010 | Profile, preferences, and notification settings | [ ] Pending | P1 | M-05 |
| FD-AUD-011 | Password change, sessions, and 2FA | [ ] Pending / prototype security needs replacement | P0 | M-05 |
| FD-AUD-012 | Waiting-on-you dashboard block | [~] Partial | P1 | M-12 |
| FD-AUD-013 | Project types and coming-soon panels | [~] Partial | P2 | M-12 |
| FD-AUD-014 | Project filters, status filters, and legend | [~] Partial | P1 | M-12 |
| FD-AUD-015 | Project card content and previews | [~] Partial | P1 | M-12 |
| FD-AUD-016 | Three-step project creation wizard | [~] Partial | P1 | M-12 |
| FD-AUD-017 | File validation and asset type parity | [~] Partial | P1 | M-12 |
| FD-AUD-018 | Persisted project review settings | [ ] Pending | P0 | M-13 |
| FD-AUD-019 | Project menu actions | [~] Partial | P0 | M-13 |
| FD-AUD-020 | Page management | [ ] Pending | P1 | M-13 |
| FD-AUD-021 | Deploy history and versions | [ ] Pending | P1 | M-13 |
| FD-AUD-022 | Duplicate, delete, and per-project export | [ ] Pending | P1 | M-13 |
| FD-AUD-023 | Website preview loading, fallback, and retry states | [~] Partial | P1 | M-14 |
| FD-AUD-024 | Preview controls | [~] Partial | P1 | M-14 |
| FD-AUD-025 | Page navigation and project/page header | [ ] Pending | P1 | M-14 |
| FD-AUD-026 | Image/PDF canvas controls | [~] Partial | P1 | M-14 |
| FD-AUD-027 | Comment sidebar filters and sorting | [~] Partial | P1 | M-15 |
| FD-AUD-028 | Comment metadata controls | [~] Partial | P1 | M-15 |
| FD-AUD-029 | Comment composer, screenshots, files, and mentions | [~] Partial | P1 | M-15 |
| FD-AUD-030 | Move and resize existing placed comments | [ ] Pending | P1 | M-15 |
| FD-AUD-031 | Undo and redo | [ ] Pending | P2 | M-15 |
| FD-AUD-032 | Ticket view modes | [~] Partial | P1 | M-16 |
| FD-AUD-033 | Ticket filters and sorting | [~] Partial | P1 | M-16 |
| FD-AUD-034 | Ticket drag and drop | [ ] Pending | P1 | M-16 |
| FD-AUD-035 | Due date picker and standalone ticket form | [~] Partial | P1 | M-16 |
| FD-AUD-036 | Client summary table | [~] Partial | P1 | M-17 |
| FD-AUD-037 | Client action menu | [ ] Pending | P1 | M-17 |
| FD-AUD-038 | Activity filters and grouping | [~] Partial | P1 | M-17 |
| FD-AUD-039 | Project access roles | [ ] Pending / intentional architecture divergence | P0 | M-02 |
| FD-AUD-040 | Share link controls | [~] Partial | P1 | M-02 |
| FD-AUD-041 | Guest preview and guest session controls | [~] Partial | P1 | M-02 |
| FD-AUD-042 | Guest permissions and client board visibility | [ ] Pending | P0 | M-02 |
| FD-AUD-043 | AI actions | [ ] Pending / intentional prototype divergence | P1 | M-22 |
| FD-AUD-044 | Plans and checkout | [ ] Pending / intentional prototype divergence | P1 | M-22 |
| FD-AUD-045 | Project document/schema expansion | [ ] Pending | P0 | M-03/M-04/M-06/M-07/M-08 |
| FD-AUD-046 | User, security, and preference documents | [ ] Pending | P0 | M-03/M-04/M-06/M-07/M-08 |
| FD-AUD-047 | Sharing and access-policy documents | [ ] Pending | P0 | M-03/M-04/M-06/M-07/M-08 |
| FD-AUD-048 | Pages, deploys, versions, and recovery history | [ ] Pending | P1 | M-03/M-04/M-06/M-07/M-08 |
| FD-AUD-049 | Search and notification data model | [~] Partial | P0 | M-03/M-04/M-06/M-07/M-08 |
| FD-AUD-050 | Asset and comment mutation contracts | [~] Partial | P1 | M-03/M-04/M-06/M-07/M-08 |
| FD-AUD-051 | Indexes, retention, and cleanup | [ ] Pending | P1 | M-03/M-04/M-06/M-07/M-08 |
| FD-AUD-052 | Browser parity journeys | [ ] Pending | P0 | M-09/M-21 |
| FD-AUD-053 | Negative and security journeys | [ ] Pending | P0 | M-09/M-21 |
| FD-AUD-054 | Documentation reconciliation | [~] Partial | P1 | M-09/M-21 |
| UX-AUD-001 | One product shell and one design-token source | [ ] Pending | P1 | M-19 |
| UX-AUD-002 | Replace platform-dependent text symbols with the icon system | [~] Partial | P2 | M-19 |
| UX-AUD-003 | Typography, density, and control sizing parity | [~] Partial | P2 | M-19 |
| UX-AUD-004 | Color contrast and color-independent status communication | [~] Partial | P1 | M-19 |
| UX-AUD-005 | Motion and reduced-motion behavior | [ ] Pending | P2 | M-19 |
| UX-AUD-006 | Theme and system color behavior | [~] Partial | P2 | M-19 |
| UX-AUD-007 | Long content, localization expansion, and overflow | [~] Partial | P1 | M-19 |
| UX-AUD-008 | Shared toast and live-status system | [ ] Pending | P1 | M-10 |
| UX-AUD-009 | Page title, favicon, and route context | [ ] Pending | P2 | M-10 |
| UX-AUD-010 | Visible connection and offline state | [ ] Pending | P1 | M-10 |
| UX-AUD-011 | Workspace switcher interaction contract | [~] Partial | P1 | M-11 |
| UX-AUD-012 | Mobile navigation and mobile project actions | [~] Partial | P1 | M-11 |
| UX-AUD-013 | Active navigation and query-state correctness | [~] Partial | P1 | M-11 |
| UX-AUD-014 | Route transition loading and focus restoration | [ ] Pending | P1 | M-11 |
| UX-AUD-015 | Breadcrumbs, back links, and project context | [~] Partial | P1 | M-11 |
| UX-AUD-016 | Global keyboard shortcuts and shortcut discoverability | [~] Partial | P1 | M-11 |
| UX-AUD-017 | Popover close, outside click, and scroll behavior | [~] Partial | P1 | M-11 |
| UX-AUD-018 | Navigation error and not-found recovery | [~] Partial | P1 | M-11 |
| UX-AUD-019 | Authentication autocomplete and one-time-code ergonomics | [~] Partial | P1 | M-10 |
| UX-AUD-020 | Inline validation and error association | [ ] Pending | P1 | M-10 |
| UX-AUD-021 | Submit, pending, success, and duplicate-submit states | [~] Partial | P1 | M-10 |
| UX-AUD-022 | Unsaved changes and destructive close behavior | [ ] Pending | P1 | M-10 |
| UX-AUD-023 | Copy, export, download, and clipboard fallback | [~] Partial | P1/P2 by group | M-10 |
| UX-AUD-024 | File picker, drag/drop, upload progress, and recovery | [~] Partial | P1/P2 by group | M-10 |
| UX-AUD-025 | URL and environment validation | [~] Partial | P1/P2 by group | M-10 |
| UX-AUD-026 | Date, time, timezone, and due-date editing | [~] Partial | P1/P2 by group | M-10 |
| UX-AUD-027 | Form reset and retry after partial failure | [ ] Pending | P1 | M-10 |
| UX-AUD-028 | Dialog focus trap, labelling, and return focus | [~] Partial | P1/P2 by group | M-10 |
| UX-AUD-029 | Modal backdrop and accidental dismissal policy | [~] Partial | P1/P2 by group | M-10 |
| UX-AUD-030 | Menu semantics and keyboard navigation | [ ] Pending | P1/P2 by group | M-10 |
| UX-AUD-031 | Overlay viewport positioning and layering | [~] Partial | P1 | M-10 |
| UX-AUD-032 | Dashboard greeting, date, and attention block states | [~] Partial | P1/P2 by group | M-12 |
| UX-AUD-033 | Project type tabs and ARIA tab behavior | [~] Partial | P1/P2 by group | M-12 |
| UX-AUD-034 | Project filters, clear state, and result explanation | [~] Partial | P1/P2 by group | M-12 |
| UX-AUD-035 | Project card action discoverability and keyboard parity | [~] Partial | P1/P2 by group | M-12 |
| UX-AUD-036 | Project preview fidelity and failure state | [~] Partial | P1/P2 by group | M-12 |
| UX-AUD-037 | New-project wizard state machine | [~] Partial | P1/P2 by group | M-12 |
| UX-AUD-038 | Client selection and inline client creation | [~] Partial | P1/P2 by group | M-12 |
| UX-AUD-039 | Project type/file acceptance and SVG path | [~] Partial | P1 | M-12 |
| UX-AUD-040 | Coming-soon and disabled feature honesty | [~] Partial | P1/P2 by group | M-12 |
| UX-AUD-041 | Preview load progress, fallback, and retry | [~] Partial | P1/P2 by group | M-14 |
| UX-AUD-042 | Viewport, browser, orientation, zoom, reload, undo, and redo controls | [~] Partial | P1/P2 by group | M-14 |
| UX-AUD-043 | Canvas keyboard, touch, and pointer behavior | [ ] Pending | P1 | M-14 |
| UX-AUD-044 | Page header, page list, and page navigation feedback | [ ] Pending | P1/P2 by group | M-14 |
| UX-AUD-045 | Image/PDF zoom, rotation, download, and page errors | [~] Partial | P1/P2 by group | M-14 |
| UX-AUD-046 | Asset add, replace, remove, and reorder lifecycle | [~] Partial | P1/P2 by group | M-14 |
| UX-AUD-047 | Comment filter, sort, and display controls | [~] Partial | P1/P2 by group | M-15 |
| UX-AUD-048 | Thread list focus, selection, and page jump | [~] Partial | P1/P2 by group | M-15 |
| UX-AUD-049 | Thread detail and reply panel behavior | [~] Partial | P1/P2 by group | M-15 |
| UX-AUD-050 | Comment metadata controls and immediate feedback | [~] Partial | P1/P2 by group | M-15 |
| UX-AUD-051 | Attachments and screenshot tray | [~] Partial | P1/P2 by group | M-15 |
| UX-AUD-052 | Mentions and recipient feedback | [ ] Pending | P1/P2 by group | M-15 |
| UX-AUD-053 | Move, resize, and region editing affordances | [ ] Pending | P1/P2 by group | M-15 |
| UX-AUD-054 | Undo/redo scope and safe inverse actions | [ ] Pending | P1/P2 by group | M-15 |
| UX-AUD-055 | Client/team visibility clarity | [~] Partial | P1/P2 by group | M-15 |
| UX-AUD-056 | Ticket view controls and consistent counts | [~] Partial | P1/P2 by group | M-16 |
| UX-AUD-057 | Ticket filters, chips, and clear-all flow | [~] Partial | P1/P2 by group | M-16 |
| UX-AUD-058 | Board drag/drop and keyboard alternative | [ ] Pending | P1/P2 by group | M-16 |
| UX-AUD-059 | Calendar semantics and due-date workflow | [~] Partial | P1/P2 by group | M-16 |
| UX-AUD-060 | Ticket detail deep links and not-found behavior | [~] Partial | P1/P2 by group | M-16 |
| UX-AUD-061 | Client table responsive and summary behavior | [~] Partial | P1/P2 by group | M-17 |
| UX-AUD-062 | Client action menu and destructive archive recovery | [~] Partial | P1/P2 by group | M-17 |
| UX-AUD-063 | Activity filters, grouping, and actionable destinations | [~] Partial | P1/P2 by group | M-17 |
| UX-AUD-064 | Members, integrations, billing, usage, settings, and MCP honesty | [~] Partial | P1/P2 by group | M-17 |
| UX-AUD-065 | Share modal permission explanation | [~] Partial | P1/P2 by group | M-02/M-18 |
| UX-AUD-066 | Link expiry, passcode, domain, export, and regeneration controls | [~] Partial | P1/P2 by group | M-02/M-18 |
| UX-AUD-067 | Copy/open/revoke/expired share-link feedback | [~] Partial | P1/P2 by group | M-02/M-18 |
| UX-AUD-068 | Guest entry, name/passcode, and session recovery | [~] Partial | P1/P2 by group | M-02/M-18 |
| UX-AUD-069 | Guest mobile review and touch comment flow | [~] Partial | P1 | M-02/M-18 |
| UX-AUD-070 | Guest connection, draft, and server-error feedback | [ ] Pending | P1/P2 by group | M-02/M-18 |
| UX-AUD-071 | Landmark, skip-link, and page-heading structure | [~] Partial | P1/P2 by group | M-19 |
| UX-AUD-072 | Focus-visible and touch-target audit | [~] Partial | P1/P2 by group | M-19 |
| UX-AUD-073 | Screen-reader announcements for async state | [ ] Pending | P1/P2 by group | M-19 |
| UX-AUD-074 | Accessible names, descriptions, and state attributes | [~] Partial | P1/P2 by group | M-19 |
| UX-AUD-075 | Keyboard completion for non-pointer interactions | [ ] Pending | P1/P2 by group | M-19 |
| UX-AUD-076 | Zoom, reflow, orientation, and assistive technology support | [ ] Pending | P1 | M-19 |
| UX-AUD-077 | Reduced cognitive load and confirmation language | [ ] Pending | P1/P2 by group | M-19 |
| UX-AUD-078 | Skeletons and layout stability | [ ] Pending | P1/P2 by group | M-20 |
| UX-AUD-079 | Query cache, stale data, and cross-screen synchronization | [~] Partial | P1/P2 by group | M-20 |
| UX-AUD-080 | Large workspace and long-list behavior | [ ] Pending | P1/P2 by group | M-20 |
| UX-AUD-081 | Image, PDF, iframe, and widget resource lifecycle | [~] Partial | P1/P2 by group | M-20 |
| UX-AUD-082 | Error boundary and retry quality | [~] Partial | P1/P2 by group | M-20 |
| UX-AUD-083 | External navigation and popup safety | [~] Partial | P1/P2 by group | M-20 |
| UX-AUD-084 | Privacy-safe UI telemetry and support diagnostics | [ ] Pending | P1 | M-20 |
| LANG-AUD-001 | Locale ownership and fallback policy | Backlog / see source | P1 foundation | M-18 |
| LANG-AUD-002 | Translation architecture | Backlog / see source | P1 foundation | M-18 |
| LANG-AUD-003 | Language preference UI | Backlog / see source | P1 foundation | M-18 |
| LANG-AUD-004 | What must be translated | Backlog / see source | P1 foundation | M-18 |
| LANG-AUD-005 | Locale-aware dates, numbers, and relative time | Backlog / see source | P1 foundation | M-18 |
| LANG-AUD-006 | Translation-safe layout and typography | Backlog / see source | P1 foundation | M-18 |
| LANG-AUD-007 | RTL and bidirectional text readiness | Backlog / see source | P1 foundation | M-18 |
| LANG-AUD-008 | Backend, email, and integration localization | Backlog / see source | P1 foundation | M-18 |
| LANG-AUD-009 | Language QA and release gates | Backlog / see source | P1 foundation | M-18 |

---

# 11. Reviewer notes on conflicts between the two audit files

The final execution plan should follow these reconciliations rather than averaging the audits:

- The short `audit-review-summary.md` is **less specific** than the senior review. Where it says tenant isolation is generally proper, the senior review identifies concrete holes; treat the concrete holes as higher-priority verification targets.
- The parity audit's “existing implementation considered complete” list means “foundation exists”, not “production-ready”. The senior review found correctness/architecture gaps inside several of those foundations.
- New untracked helpers/components are **not implemented** merely because they exist. The senior audit specifically reports wiring gaps for Toast, focus trap, i18n, workspace/account UI, project menu/pages, etc.
- Prototype parity is subordinate to product/security architecture. OTP-only auth, honest AI/billing placeholders, share-link review auth, URL-owned board filters, scoped proxy behavior, and recovery TDR decisions should not be reverted for visual parity.

---

# 12. Assumptions requiring explicit confirmation/TDR rather than silent implementation

1. Whether project-scoped collaborator ACLs are actually desired now or workspace-wide project access remains the product rule.
2. Whether dashboard must be blocked below 1024px or remain responsive.
3. Whether TOTP/2FA is in current scope.
4. Whether project deploy/version history should be a first-class model or a view over existing revisions/recovery runs.
5. Exactly what project duplication copies.
6. Whether guest client board view exposes statuses only or any assignee/due/internal metadata.
7. Whether SVG is needed; if yes, which sanitization/rendering policy is approved.
8. Whether undo/redo is required for server mutations or only local canvas edits.
9. Locale rollout beyond English and the source of locale preference precedence.
10. When AI/billing become real product scope; until then, keep them explicitly non-functional rather than simulated.

---

# 13. Final disposition

The HTML integration should be treated as a **cross-system product change**, not a frontend reskin. The highest-value next pass is not to chase every visual difference. It is to re-verify the dirty working tree, close authorization/policy/delete/privacy gaps, normalize backend contracts/indexes and React Query synchronization, wire the shared primitives that were started but not completed, and only then finish project/canvas/comment/ticket/share parity and polish.

This ordering prevents a stronger coding agent from spending time on already-correct prototype parity while production correctness remains unresolved.
