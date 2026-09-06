# Final Draft HTML parity audit

Date: 2026-09-07
Status: open backlog; this document records what is still pending after the current implementation pass.

This audit compares the supplied Final Draft HTML with the actual React frontend, widget, FastAPI backend, MongoDB document model, and current API contracts. The HTML is treated as product and interaction evidence. Its seeded people, accounts, passwords, fake AI results, fake credits, fake checkout, embedded assets, and prototype toasts are not production instructions.

## Status key

- `[x] Implemented`: the behavior exists as a real persisted or server-backed flow.
- `[~] Partial`: a meaningful slice exists, but one or more source behaviors are missing or differ.
- `[ ] Pending`: the behavior is absent or still only a placeholder.
- `Intentional divergence`: the source prototype uses a fake or unsafe behavior that should be replaced by the current architecture rather than copied literally.

Priority levels:

- **P0**: blocks production parity, security, data integrity, or a core user journey.
- **P1**: important product behavior or a major screen gap.
- **P2**: smaller interaction, visual, or convenience gap.

## Source integrity finding

### FD-AUD-001 — Repository reference does not match the supplied HTML

- Status: `[ ] Pending`
- Priority: **P0**
- Supplied source: `C:\Users\dvajj\Downloads\backline-Final Draft.html`
- Supplied source SHA-256: `27455b8ef30395a1724016da3ad70575c74b816da32037e3ce87e981e95afba4`
- Supplied source size: 571,683 bytes, 6,720 lines.
- Repository copy: `docs/reference/backline-final-draft.html`
- Repository copy SHA-256: `24623eed476467c44342652d9add00c10b0b39d95e77188f6f3c456c631bc991`
- Repository copy size: 578,403 bytes.
- Existing inventory: `docs/reference/html-inventory.md` records the supplied source hash, not the checked-in copy hash.

Pending action:

- Replace the repository reference with the exact supplied file.
- Regenerate `html-inventory.md` from that exact file.
- Record the final hash in this document and in the delivery ledger.
- Re-run the parity audit after the replacement.

Acceptance:

- The download and checked-in reference have identical bytes and SHA-256.
- The inventory, PRD, flow matrix, and audit all reference the same source.

## Existing implementation that is considered complete for this pass

These parts are present as real product flows and should not be re-counted as missing:

- Workspace-scoped project, client, ticket, activity, member, asset, and share-link APIs.
- Project creation, metadata update, client association, archive, restore, and environment selection.
- Ticket status, priority, tags, multiple assignees, waiting-on fields, nullable due dates, filters, grouping, list, board, table, calendar, replies, and CSV export.
- Client create, edit, project association, search, and archive.
- Activity pagination and tenant-scoped activity events.
- Private asset uploads through S3-compatible storage, signed asset URLs, PDF rendering, multi-page navigation, image/PDF region comments, and guest asset review.
- Website proxy review, Browse/Comment mode, share links, guest name/passcode entry, guest sessions, comment replies, attachment support in the widget, realtime comment events, and anchor recovery infrastructure.
- Workspace member invite, role changes, removal, workspace switching through the workspace picker, integrations, MCP, usage, and notification read-state APIs.
- Frontend lint, typecheck, build, focused backend tests, scoping checks, and generated OpenAPI/type contracts as recorded in `docs/implementation/06-delivery.md`.

The items below are the remaining parity backlog.

## Shell, workspace, and navigation

### FD-AUD-002 — Desktop gate behavior

- Status: `[~] Partial / intentional divergence`
- Priority: **P2**
- HTML evidence: lines 1896–1932, `#deskOnly`.
- Source behavior: dashboard use is blocked below 1024px; guest review links remain usable on smaller screens.
- Current implementation: the React dashboard is responsive and attempts to work on smaller screens.
- Gap: the exact source behavior is not reproduced. The current behavior may be a better product decision, but it must be documented and tested intentionally.

Pending decision:

- Keep responsive dashboard behavior and update the PRD, or add an explicit desktop gate while preserving mobile guest review.

Acceptance:

- The chosen rule is documented, implemented consistently, and covered by a browser test at widths below and above 1024px.

### FD-AUD-003 — Workspace switcher and create-workspace modal

- Status: `[~] Partial`
- Priority: **P1**
- HTML evidence: lines 2097–2138, `#wsBtn`, `#wsPop`, `#wsScrim`, `#newWsBtn`.
- Current implementation: workspace listing and creation exist in `WorkspacePickerPage`; the dashboard rail links the workspace button back to `/`.
- Gap: the in-shell workspace popover, workspace list, selected-state behavior, slug preview, and create-workspace modal are missing from the dashboard shell.
- Current locations: `apps/web/src/features/workspaces/WorkspacePickerPage.tsx`, `apps/web/src/app/layout/DashboardSidebar.tsx`.

Pending action:

- Add the workspace popover to the rail or explicitly document the picker-only behavior.
- Preserve the real workspace API and switch token flow.

Acceptance:

- A signed-in user can open the rail switcher, change workspaces, create a workspace, see the generated slug preview, and land in the new workspace without a full-page dead end.

### FD-AUD-004 — Account button in the application shell

- Status: `[ ] Pending`
- Priority: **P1**
- HTML evidence: lines 2192–2210, `#meBtn`.
- Current implementation: the rail footer exposes the user name and a Sign out button only.
- Gap: clicking the account identity does not open the profile, notifications, or security modal.
- Current location: `apps/web/src/app/layout/DashboardSidebar.tsx`.

### FD-AUD-005 — Global search

- Status: `[ ] Pending`
- Priority: **P0**
- HTML evidence: lines 2192–2198, `#gSearch`, `#searchPop`, `runSearch()` around line 5250, keyboard handlers around lines 4167–4200.
- Source behavior: search comments, projects, and people; group results; open a project or thread; support `/` and Cmd/Ctrl+K; escape closes the result panel.
- Current implementation: project search in `ProjectsPage` and ticket search in `TicketsPage`; no global search endpoint or UI.
- Missing backend: scoped search service, result schema, indexes, pagination, and permission filtering.

Pending action:

- Add a workspace-scoped search endpoint and Mongo search strategy.
- Add a global shell search component with keyboard shortcuts and result routing.

Acceptance:

- A search never returns another workspace's project, client, member, comment, or ticket.
- Results open the exact project/page/thread and empty, partial, and permission-filtered results behave correctly.

### FD-AUD-006 — Notification list behavior

- Status: `[~] Partial`
- Priority: **P1**
- HTML evidence: lines 2199–2203, `renderNotifs()` around line 5280.
- Current implementation: unread count, notification list, mark one read, mark all read, and realtime invalidation exist in `NotificationBell.tsx`.
- Gap: notification click actions do not navigate to the related project/thread; only a small set of notification types is described; the HTML-style unread rows, event copy, and related destinations are incomplete.
- Current locations: `apps/web/src/features/notifications/NotificationBell.tsx`, `backend/app/modules/notifications/`.

Pending action:

- Add notification target metadata and route on click.
- Add assignment, mention, reply, status, share, deploy, and integration event descriptions as the backend emits them.

## Authentication and account security

### FD-AUD-007 — Password sign-in

- Status: `[ ] Pending / intentional architecture divergence`
- Priority: **P0**
- HTML evidence: lines 1943–1972, `data-lg-form="in"`.
- Source behavior: email/password sign-in, password reveal, forgot-password entry, keep-me-signed-in, inline validation, caps-lock warning, and loading state.
- Current implementation: email OTP request/verify plus Google OAuth in `LoginPage.tsx`.
- Backend: `backend/app/modules/auth/router.py` contains OTP, Google callback, refresh, logout, and workspace switch only.

Pending decision:

- Either implement password authentication and its security controls, or formally replace the HTML password model with OTP-only authentication in the PRD and acceptance matrix.

### FD-AUD-008 — Account creation and password reset

- Status: `[ ] Pending`
- Priority: **P0**
- HTML evidence: lines 1975–2047, signup/reset/sent views.
- Missing: name, email, password strength, terms acceptance, reset email request, reset completion, reset token expiry, reset-token invalidation, and password email delivery.
- Current location: `apps/web/src/features/auth/LoginPage.tsx` and `backend/app/modules/auth/`.

### FD-AUD-009 — Login usability controls

- Status: `[~] Partial`
- Priority: **P2**
- HTML evidence: lines 6233–6289 and 6546–6678.
- Missing: caps-lock indicator, password strength bar, show/hide controls, email account suggestions, saved-account selection, and keep-signed-in behavior.

### FD-AUD-010 — Profile, preferences, and notification settings

- Status: `[ ] Pending`
- Priority: **P1**
- HTML evidence: lines 5717–5819, `accPanel()`.
- Missing: first name, last name, email, client-facing role, avatar upload/remove, comment email preference, digest preference, mention email preference, weekly resolved summary, and persisted user settings.
- Current Settings page only changes workspace name and contains a disabled workspace avatar placeholder.

### FD-AUD-011 — Password change, sessions, and 2FA

- Status: `[ ] Pending / prototype security needs replacement`
- Priority: **P0**
- HTML evidence: CSS around line 819 and account security flow around lines 5738–5776.
- Missing: change-password form, password verification, active-session list, sign out one device, sign out all other devices, 2FA enrollment, recovery codes, and secure session invalidation.
- The HTML QR is a generated prototype visual. It must be replaced with a real TOTP enrollment flow before production.

## Dashboard and project management

### FD-AUD-012 — Waiting-on-you dashboard block

- Status: `[~] Partial`
- Priority: **P1**
- HTML evidence: lines 2213–2236, `renderAttn()` around line 2871.
- Current implementation: `ProjectsPage` loads up to three reply-needed tickets and links to tickets.
- Gap: the HTML distinguishes waiting threads, author, time, project, page, and thread destination with its exact count and ordering. Current behavior is close but does not fully reproduce the source ordering and project/page context rules.

### FD-AUD-013 — Project types and coming-soon panels

- Status: `[~] Partial`
- Priority: **P2**
- HTML evidence: lines 2716–2735 and `soonPanel()` around line 3021.
- Current implementation: Website, Images, PDF, Web App, and Mobile routes exist; Web App/Mobile are generic placeholder pages.
- Gap: missing the detailed source copy, roadmap bullets, target dates, and “Tell me when it ships” action.
- Note: Web App and Mobile are correctly not presented as working project types.

### FD-AUD-014 — Project filters, status filters, and legend

- Status: `[~] Partial`
- Priority: **P1**
- HTML evidence: lines 2903–3020, `filtered()`, `renderContent()`, `SORTS`, and `VIEWS`.
- Current implementation: type, client, archived, search, sort, and card/list/table display modes exist in `ProjectsPage`.
- Missing: per-project status filters for Active/In review/Blocked/Resolved, status legend, exact source popover behavior, and source-level filter combinations.

### FD-AUD-015 — Project card content and previews

- Status: `[~] Partial`
- Priority: **P1**
- HTML evidence: lines 2948–3006, `THUMB`, `THUMBFOR`, `deployFlag`, card hover actions.
- Current implementation: project cards show a generated initial or generic browser preview, client, environment, open/resolved counts, last activity, share, settings, archive/restore.
- Missing: actual preview thumbnails, project pins/people, deployment warning/recovery badge, page/open counts, exact card overlay actions, and duplicate action.
- Current locations: `apps/web/src/features/projects/ProjectsPage.tsx`, `apps/web/src/features/workspaces/ProjectCard.tsx`.

### FD-AUD-016 — Three-step project creation wizard

- Status: `[~] Partial`
- Priority: **P1**
- HTML evidence: lines 2388–2400 and `openNP()/renderNP()` around lines 5404–5483.
- Current implementation: `ProjectForm.tsx` creates website/image/PDF projects and uploads files.
- Missing: explicit three-step state, client contact fields, reviewer invitation emails, file drop area, file previews, remove/change file behavior, source completion screen, ask-name checkbox, and guest preview.

### FD-AUD-017 — File validation and asset type parity

- Status: `[~] Partial`
- Priority: **P1**
- HTML evidence: lines 5010–5060 and project seed data containing SVG assets.
- Current implementation: PNG/JPEG/WebP/GIF and PDF validation, 50 image limit, 200-page PDF limit, 20 MB limit.
- Missing: SVG support, source-compatible content type handling, and UI acceptance of SVG files.
- Current locations: `apps/web/src/features/projects/ProjectForm.tsx`, `apps/web/src/features/assets/AssetReview.tsx`, `backend/app/modules/assets/service.py`.

## Project settings and lifecycle

### FD-AUD-018 — Persisted project review settings

- Status: `[ ] Pending`
- Priority: **P0**
- HTML evidence: lines 2317–2368.
- Missing fields:

  1. Capture browser/device details.
  2. Re-anchor comments after deployment.
  3. Let reviewers resolve their own comments.
  4. Show the ticket board to the client.
  5. Email digest to the client.

- Current backend `ProjectSettingsOut` only exposes `proxy_mode` and `snippet_installed`.
- Current locations: `backend/app/modules/projects/schemas.py`, `backend/app/modules/projects/service.py`, `apps/web/src/features/projects/ProjectForm.tsx`.

Pending action:

- Extend the project settings schema and migration/backfill strategy.
- Enforce these flags in widget, guest review, comment moderation, board visibility, and notification jobs.

### FD-AUD-019 — Project menu actions

- Status: `[~] Partial`
- Priority: **P0**
- HTML evidence: lines 2371–2386 and `projMenuHTML()` around line 3066.
- Implemented: settings/name update, archive/restore.
- Pending: manage pages, deploy history, duplicate, export comments, delete project, and exact confirmation flows.

### FD-AUD-020 — Page management

- Status: `[ ] Pending`
- Priority: **P1**
- HTML evidence: `openPages()` around line 5305 and page controls around lines 4597–4608.
- Current backend: pages can be registered/listed by the SDK, but the dashboard cannot add, rename, reorder, or remove project pages.
- Pending action: add member-authorized page management with workspace/project validation and safe deletion rules.

### FD-AUD-021 — Deploy history and versions

- Status: `[ ] Pending`
- Priority: **P1**
- HTML evidence: `openDeploys()` around line 5313, version control around `VersionMenu`, and project preview controls around lines 3295–3322.
- Current implementation: version menu is a static “Version 1” component that opens a paywall; it does not create versions or display deploy history.
- Missing: deploy records, revision selection, re-anchor results, orphaned-comment review, version copy behavior, and historical comment linkage.

### FD-AUD-022 — Duplicate, delete, and per-project export

- Status: `[ ] Pending`
- Priority: **P1**
- HTML evidence: lines 4565–4620 and `exportCSV()` around line 5341.
- Current implementation: workspace ticket CSV exists; project-specific duplicate/delete/export does not.
- Pending action: add audited, workspace-scoped endpoints and confirmation UI. Hard deletion must follow retention and attachment cleanup rules.

## Website review canvas

### FD-AUD-023 — Website preview loading, fallback, and retry states

- Status: `[~] Partial`
- Priority: **P1**
- HTML evidence: `frameFor()`, `wireIframe()`, `race()`, `prepareHtml()` around lines 3137–3260 and 3374–3439.
- Current implementation: proxy iframe loading exists through the backend.
- Missing or different: source-style loading progress, proxy race state, direct-load fallback strip, retry button, “check URL” action, mock preview fallback, and explicit blank-page diagnostics.

### FD-AUD-024 — Preview controls

- Status: `[~] Partial`
- Priority: **P1**
- HTML evidence: `pvTop()` and `pvBottom()` around lines 3295–3497.
- Implemented: Browse/Comment mode, open in new tab, viewport presets, share, version menu, upgrade/private/approval shell.
- Pending: browser selector, custom width input, portrait/landscape orientation, zoom stepper, reload, undo/redo, exact browser/device capture state, and comment count behavior across pages.

### FD-AUD-025 — Page navigation and project/page header

- Status: `[ ] Pending`
- Priority: **P1**
- HTML evidence: `renderProject()`, `renderPage()`, `pvTop()`, and page rows around lines 3081–3115.
- Current implementation: project overview renders one proxy canvas; pages are not presented as a navigable project page list.
- Missing: page list, page navigation, page-specific header URL, page open state, page counts, and page-level project actions.

### FD-AUD-026 — Image/PDF canvas controls

- Status: `[~] Partial`
- Priority: **P1**
- HTML evidence: `frameFor()` asset branch around lines 3374–3439 and zoom controls around lines 3460–3488.
- Implemented: image/PDF rendering and page navigation.
- Pending: zoom controls in the real asset review, orientation/rotation behavior, download/open-file action, asset-level page/file management, and comment count parity.

## Comments and review interaction

### FD-AUD-027 — Comment sidebar filters and sorting

- Status: `[~] Partial`
- Priority: **P1**
- HTML evidence: `pageThreads()` and `renderSide()` around lines 3499–3607; sort/filter/display popovers around lines 2426–2438 and 4938–4960.
- Implemented: status filtering, layer filtering, current-page-only filtering, newest/oldest sorting, status counts, attachments, and thread opening.
- Pending: sort by replies, sort by status, tags, device types, browser/OS, assignees, compact/comfortable display, grouping by page, hide-resolved, active filter count, and exact popover behavior.
- Current location: `apps/web/src/features/projects/panel/CommentsTab.tsx`.

### FD-AUD-028 — Comment metadata controls

- Status: `[~] Partial`
- Priority: **P1**
- HTML evidence: `detailFor()` around lines 3653–3718, status/tag/assignee/date controls.
- Implemented: status, priority, tags, assignees, waiting-on fields, due date, replies, and layer values exist in the ticket/detail flow.
- Pending: the same controls directly in the project thread detail, exact tag/assignee pickers, multi-assignee display, custom date picker, clear/today behavior, and client-resolution permissions.

### FD-AUD-029 — Comment composer, screenshots, files, and mentions

- Status: `[~] Partial`
- Priority: **P1**
- HTML evidence: attachment helpers around lines 5355–5390; mention helpers around lines 5916–5946; composer handlers around lines 5993–6088.
- Implemented: widget comment and reply attachments; asset comment text and region creation; backend attachment contracts.
- Pending: dashboard composer attachment tray, screenshots in standalone tickets, member dashboard reply attachments, inline mention autocomplete, mention recipient validation, mention notifications, and attachment previews/removal in every authoring surface.

### FD-AUD-030 — Move and resize existing placed comments

- Status: `[ ] Pending`
- Priority: **P1**
- HTML evidence: `regionFor()` around lines 3430–3439 and move/resize handlers around lines 6095–6187.
- Current widget tracks pins as the page changes, but the dashboard does not expose the source’s explicit selected-region handles and persisted manual move/resize interaction.
- Pending action: add an authorized comment-anchor update route, UI handles, coordinate validation, conflict handling, and audit events.

### FD-AUD-031 — Undo and redo

- Status: `[ ] Pending`
- Priority: **P2**
- HTML evidence: `pushUndo()`, `doUndo()`, `doRedo()` around lines 3034–3052 and keyboard handlers around lines 4167–4200.
- Current implementation: no application-level undo/redo for status, placement, assignment, or other reversible actions.
- Pending action: implement server-safe inverse operations or document that undo/redo is intentionally excluded from the production architecture.

## Ticket and board experience

### FD-AUD-032 — Ticket view modes

- Status: `[~] Partial`
- Priority: **P1**
- HTML evidence: `renderThreads()` around lines 4047–4152; `tList()`, `tBoard()`, `tTable()`, and `tCal()` around lines 3824–3954.
- Implemented: list, board, table, calendar, grouping, filters, replies, and CSV export in `TicketsPage.tsx`.
- Pending: exact source labels/counts, ticket IDs/page/pinned markers in every view, source empty states, and consistent ordering across all views.

### FD-AUD-033 — Ticket filters and sorting

- Status: `[~] Partial`
- Priority: **P1**
- HTML evidence: `TSORTL`, `TGROUPL`, assignee picker, and table cell filters around lines 3977–4152.
- Implemented: status, project, priority, tag, assignee, view, grouping, and several sort options.
- Pending: multi-person assignee filter with stacked faces, assignee/tag sorting, clickable table filters, active filter chips matching the source, and exact default due-date ordering.

### FD-AUD-034 — Ticket drag and drop

- Status: `[ ] Pending`
- Priority: **P1**
- HTML evidence: ticket drag handlers around lines 6188–6232; `data-drop-col`, `data-drop-day`, and `data-drag-tid`.
- Current implementation: board cards use status selects; calendar tickets are not draggable.
- Pending action: implement optimistic drag/drop with server update, rollback on failure, stale-event handling, and due-date/status audit events.

### FD-AUD-035 — Due date picker and standalone ticket form

- Status: `[~] Partial`
- Priority: **P1**
- HTML evidence: `dpHTML()` around lines 5856–5915 and `openNewTicket()` around lines 3977–4022.
- Implemented: due dates and standalone team tickets.
- Pending: source calendar picker with month navigation, Clear, Today, inline placement, screenshot attachments, tags, project/page selection, and exact new-ticket validation.

## Clients and activity

### FD-AUD-036 — Client summary table

- Status: `[~] Partial`
- Priority: **P1**
- HTML evidence: `renderClients()` around lines 3736–3798.
- Implemented: client list, contact data, project chips, create/edit, search, archive.
- Pending: open count, resolved count, reviewer count, last activity, total workspace summary, exact client/project chips, and source table layout.

### FD-AUD-037 — Client action menu

- Status: `[ ] Pending`
- Priority: **P1**
- HTML evidence: `data-clact` handlers around lines 4370–4455.
- Missing: rename, invite reviewer, new project for client, see all projects, export client activity, and source archive confirmation behavior.
- Current location: `apps/web/src/features/clients/ClientsPage.tsx` only exposes Edit and Archive.

### FD-AUD-038 — Activity filters and grouping

- Status: `[~] Partial`
- Priority: **P1**
- HTML evidence: `renderActivity()` around lines 4023–4046.
- Implemented: tenant-scoped activity feed, server pagination, event links.
- Pending: Everything / My actions / From clients / Deploys filters, Today/Yesterday/Earlier grouping, event icons, source copy, deploy/reanchor events, and correct thread destination for every actionable event.

## Sharing and guest review

### FD-AUD-039 — Project access roles

- Status: `[ ] Pending / intentional architecture divergence`
- Priority: **P0**
- HTML evidence: lines 2276–2315 and role picker lines 2416–2424.
- Source behavior: per-project access roles Can view, Can comment, Can edit, and Remove access.
- Current implementation: email invites create workspace-wide Member/Admin membership.
- Current locations: `apps/web/src/features/workspaces/ShareProjectModal.tsx`, `CollaboratorsModal.tsx`, `backend/app/modules/workspaces/`.
- Pending decision: add project-scoped ACLs or explicitly remove this requirement from the product contract.

### FD-AUD-040 — Share link controls

- Status: `[~] Partial`
- Priority: **P1**
- HTML evidence: lines 2288–2315 and `linkSettingsHTML()` around lines 5821–5855.
- Implemented: active link, copy, passcode, expiry fields in the API, link creation, and revoke.
- Pending: inline enable/disable, Never/7 days/30 days selector, password toggle, domain restriction, comment export toggle, regenerate-link action, ask-reviewer-name toggle, and visible persisted policy state.
- Current share-link form does not expose the existing `expiresAt` API option.

### FD-AUD-041 — Guest preview and guest session controls

- Status: `[~] Partial`
- Priority: **P1**
- HTML evidence: guest gate lines 2438–2453 and guest handlers around lines 5947–5968.
- Implemented: real share-link resolution, name gate, passcode, guest session, guest comments, guest replies, archived/revoked/expired checks.
- Pending: “Open the guest view” from the share modal, explicit leave-review behavior, ask-name policy enforcement, domain-policy enforcement, and consistent guest controls across website, image, and PDF review.

### FD-AUD-042 — Guest permissions and client board visibility

- Status: `[ ] Pending`
- Priority: **P0**
- HTML evidence: project settings lines 2348–2357 and link settings around line 5821.
- Missing: server-enforced reviewer resolve permission, client board visibility policy, client-visible due-date/assignee hiding, export permission, and verified domain restrictions.
- These must be enforced by backend authorization, not only hidden in React.

## AI, plans, and providers

### FD-AUD-043 — AI actions

- Status: `[ ] Pending / intentional prototype divergence`
- Priority: **P1**
- HTML evidence: lines 3566–3570 and `runAI()` around lines 5484–5683.
- Source actions: summarize open comments, build task list, find duplicates, suggest assignments, generate a progress summary, draft replies, and export/copy results.
- Current implementation: `AiTab.tsx` always opens a Pro paywall.
- Pending action: add provider-backed job/API contracts, quota/credit accounting, error states, privacy rules, and result persistence only after provider configuration exists.
- Do not implement the HTML’s in-memory `CREDITS` or heuristic “AI” as production behavior.

### FD-AUD-044 — Plans and checkout

- Status: `[ ] Pending / intentional prototype divergence`
- Priority: **P1**
- HTML evidence: `openPlans()` around lines 5684–5716.
- Current implementation: static plan display and upgrade modal; no payment provider, checkout session, webhook verification, entitlement enforcement, invoices, or plan limits.
- Pending action: choose billing provider, model server-verified entitlements, add webhook reconciliation, and enforce limits in backend services.

## Backend and database backlog

### FD-AUD-045 — Project document/schema expansion

- Status: `[ ] Pending`
- Priority: **P0**
- Current schema location: `backend/app/modules/projects/schemas.py`.
- Missing persisted project fields:

  - Capture browser/device flag.
  - Reanchor flag.
  - Reviewer-resolve flag.
  - Client-board visibility flag.
  - Client digest flag.
  - Project type/environment values for asset projects.
  - Duplicate source/lineage metadata.
  - Deletion/retention state.

### FD-AUD-046 — User, security, and preference documents

- Status: `[ ] Pending`
- Priority: **P0**
- Missing database data:

  - Password hash and password history/updated time.
  - Password reset tokens with expiry and single-use state.
  - 2FA secret, enrollment state, and recovery codes.
  - Active refresh-token/session device records.
  - Profile fields and avatar storage reference.
  - Notification preferences and digest schedule.
  - Mention preference.

### FD-AUD-047 — Sharing and access-policy documents

- Status: `[ ] Pending`
- Priority: **P0**
- Missing database data:

  - Project-scoped collaborator roles.
  - Share-link enabled/disabled state separate from revocation where needed.
  - Ask-reviewer-name policy.
  - Domain restrictions and verification state.
  - Comment-export permission.
  - Reviewer-resolve permission.
  - Link regeneration lineage and invalidation audit.

### FD-AUD-048 — Pages, deploys, versions, and recovery history

- Status: `[ ] Pending`
- Priority: **P1**
- Current pages are primarily SDK-registered records.
- Missing:

  - Dashboard page create/update/delete/reorder.
  - Deploy/revision records.
  - Version selection and copied comments.
  - Reanchor run records and per-comment outcomes.
  - Deploy history events and project recovery UI.

### FD-AUD-049 — Search and notification data model

- Status: `[ ] Pending`
- Priority: **P0**
- Missing:

  - Search indexes or a documented bounded-search strategy.
  - Search result projection across projects, comments, people, and tickets.
  - Mention recipient records and deduplication.
  - Notification target route metadata.
  - Deploy, reply, mention, share, and status notification types.

### FD-AUD-050 — Asset and comment mutation contracts

- Status: `[~] Partial`
- Priority: **P1**
- Implemented: normalized asset regions, comment anchors, recovery status, attachments, screenshots, and reanchor endpoint.
- Pending:

  - SVG inspection and safe delivery.
  - Asset delete/reorder/update metadata.
  - Manual comment-region move/resize endpoint.
  - Mention payload and notification contracts.
  - Dashboard-side attachment upload flow.
  - Asset comment metadata updates from the review screen.

### FD-AUD-051 — Indexes, retention, and cleanup

- Status: `[ ] Pending`
- Priority: **P1**
- Missing or needing confirmation:

  - Search indexes for the selected search strategy.
  - Session/token cleanup indexes.
  - Reset-token TTL index.
  - Notification read-state and target indexes.
  - Deploy/version/recovery indexes.
  - Asset cleanup when projects/files are deleted.
  - Audit-event coverage for security-sensitive mutations.

## Quality and acceptance backlog

### FD-AUD-052 — Browser parity journeys

- Status: `[ ] Pending`
- Priority: **P0**
- Required journeys:

  1. Login, signup, reset, logout, and session invalidation.
  2. Workspace switch and workspace creation from the shell.
  3. Global search to project and thread.
  4. New website project through share and guest preview.
  5. New image project including SVG validation.
  6. New PDF project with multiple pages.
  7. Project settings persistence and policy enforcement.
  8. Page management and deploy/recovery history.
  9. Comment create, reply, attachment, mention, move, resize, and status update.
  10. Ticket drag/drop across board and calendar.
  11. Client action menu and activity export.
  12. Share-link expiry, passcode, regenerate, domain, and export policy.
  13. Profile, preferences, password, sessions, and 2FA.
  14. Notification click-through and read state.

### FD-AUD-053 — Negative and security journeys

- Status: `[ ] Pending`
- Priority: **P0**
- Required checks:

  - Wrong workspace project/client/member IDs.
  - Guest access to member-only routes.
  - Assignment to a foreign user.
  - Client/project references from another tenant.
  - Expired, revoked, regenerated, and archived links.
  - Invalid/duplicate tags and invalid dates.
  - Reply counted as a root ticket.
  - Empty/global search with no results.
  - CSV formula injection.
  - Upload failure and partial-upload recovery.
  - Missing AI/billing provider configuration.
  - Stale realtime updates and optimistic drag/drop rollback.
  - Domain restriction bypass by manually typing an email.
  - Client-visible/team-only reply leakage.

### FD-AUD-054 — Documentation reconciliation

- Status: `[~] Partial`
- Priority: **P1**
- Current documents: `01-prd.md`, `02-flow-matrix.md`, `03-frontend.md`, `04-backend.md`, `05-database.md`, and `06-delivery.md`.
- Gap: the flow matrix describes requirements more completely than the delivery ledger, but it does not yet mark every row with its exact current status and source/current file evidence.
- Pending action: update the flow matrix and delivery ledger after each backlog item, and never describe a planned feature as delivered.

## Recommended implementation order

### Phase 0 — Correct the audit baseline

- [ ] Replace the repository HTML copy with the supplied source.
- [ ] Regenerate the inventory.
- [ ] Re-run this audit against the corrected hash.

### Phase 1 — Production blockers

- [ ] Decide OTP-only versus password/signup/reset authentication.
- [ ] Add account profile, preferences, sessions, and security flows.
- [ ] Add project settings fields and server enforcement.
- [ ] Add global search.
- [ ] Add share-link policy enforcement and decide project-scoped collaborator roles.

### Phase 2 — Core project lifecycle

- [ ] Finish the new-project wizard and SVG support.
- [ ] Add page management, duplicate, delete, project export, deploy history, and versions.
- [ ] Complete website canvas controls and page navigation.
- [ ] Complete asset review controls and asset management.

### Phase 3 — Review and ticket parity

- [ ] Complete comment filters, composer attachments, mentions, date picker, and placement editing.
- [ ] Add ticket drag/drop and exact filter/sort behavior.
- [ ] Complete client summary/action menu and activity grouping.
- [ ] Complete notification destinations and event types.

### Phase 4 — Provider-backed features

- [ ] Implement AI only after provider, privacy, quota, and job contracts are approved.
- [ ] Implement billing only after checkout, webhook, entitlement, and limit enforcement are available.
- [ ] Keep prototype credits, heuristic AI, and fake checkout out of production.

## Current conclusion

The current branch has a usable foundational Backline implementation, but it is not yet complete parity with the supplied Final Draft HTML. The authoritative pending work is every item marked `[ ]` above, plus the missing portions of `[~]` items. The most urgent work is source correction, authentication/security, project settings enforcement, global search, sharing policy enforcement, and the missing project lifecycle APIs.

## Expanded UI, UX, accessibility, resilience, and localization audit

This section records the smaller behaviors that are easy to miss when comparing only
routes and API endpoints. It covers the source HTML's micro-interactions and the
current React/widget implementation in `apps/web/src` and `apps/widget/src`. A screen
is not considered complete until its normal, loading, empty, validation, error,
success, keyboard, touch, responsive, and permission states are defined.

The existing FD-AUD items remain the feature-level backlog. The UX-AUD items below
are additional acceptance work; they do not mean that a feature is complete merely
because its primary screen renders.

### Visual system and design consistency

#### UX-AUD-001 — One product shell and one design-token source

- Status: `[ ] Pending`
- Priority: **P1**
- HTML evidence: the source uses one rail, one popover/modal vocabulary, shared CSS
  variables, and the same button, input, chip, and status patterns across dashboard,
  project, account, and guest screens.
- Current implementation: the active dashboard uses `DashboardSidebar.tsx` and
  `styles/backline.css`, while `WorkspaceSidebar.tsx` and Tailwind utilities provide a
  second shell vocabulary. Both patterns remain in the repository.
- Gap: spacing, borders, controls, navigation, icon treatment, and responsive rules
  can drift between screens. A future fix applied to one shell can leave the other
  inconsistent.
- Acceptance: choose one active shell and token layer, remove or explicitly mark
  stale alternatives, and add visual checks for navigation, buttons, forms, cards,
  tables, dialogs, popovers, and guest review.

#### UX-AUD-002 — Replace platform-dependent text symbols with the icon system

- Status: `[~] Partial`
- Priority: **P2**
- HTML evidence: source controls use consistent inline SVG icons for search, menus,
  status, copy, undo/redo, reload, browser, attachment, and navigation actions.
- Current implementation: several controls use Unicode or emoji such as `▦`, `↳`,
  `☷`, `◷`, `♧`, `⌕`, `🔔`, `×`, and arrows, while other screens use SVG assets.
- Gap: glyph shape, baseline, weight, and meaning vary by operating system and are
  not consistently exposed to assistive technology.
- Acceptance: use the shared icon components or an audited SVG set; every decorative
  icon is hidden from the accessibility tree and every icon-only action has a stable
  accessible name and tooltip.

#### UX-AUD-003 — Typography, density, and control sizing parity

- Status: `[~] Partial`
- Priority: **P2**
- HTML evidence: the source defines a tight mono metadata scale, compact controls,
  consistent headings, and deliberate card/table density.
- Current implementation: the active shell mixes `backline.css`, Tailwind text sizes,
  and browser defaults for form controls.
- Gap: heading, label, helper, error, metadata, and table density vary by route; some
  small controls become difficult to use at touch sizes.
- Acceptance: document the type scale, spacing scale, minimum control heights, and
  desktop/mobile density rules, then verify all routes at the agreed sizes.

#### UX-AUD-004 — Color contrast and color-independent status communication

- Status: `[~] Partial`
- Priority: **P1**
- HTML evidence: status colors are paired with readable status labels and counts.
- Current implementation: status dots and colored borders are used in the sidebar,
  board, calendar, project cards, pins, and selects; some muted text and colored
  metadata are defined only in CSS.
- Gap: contrast has not been audited for normal text, disabled states, dark styles,
  focus rings, or user-created status/tag combinations. Color alone must not convey
  status, layer, or permission.
- Acceptance: run automated and manual contrast checks for light, dark, focus,
  disabled, hover, and error states; retain a text/icon/status label everywhere a
  color indicator appears.

#### UX-AUD-005 — Motion and reduced-motion behavior

- Status: `[ ] Pending`
- Priority: **P2**
- HTML evidence: source cards, reveal states, loading states, canvas transitions, and
  toast/panel changes use motion.
- Current implementation: CSS transitions, card transforms, iframe/review changes,
  and widget tooltip/toast timing exist, but there is no
  `prefers-reduced-motion` policy.
- Gap: users who request reduced motion may still see movement, and there is no
  documented duration/easing policy.
- Acceptance: add a reduced-motion stylesheet and test card, modal, toast, preview,
  pin, and route transitions with motion disabled.

#### UX-AUD-006 — Theme and system color behavior

- Status: `[~] Partial`
- Priority: **P2**
- Current implementation: some Tailwind dark classes exist, but `backline.css` uses
  hard-coded light surfaces, borders, input backgrounds, and dialog headers.
- Gap: the active shell, dialogs, asset review, and widget can render mixed light and
  dark surfaces; there is no explicit theme preference contract.
- Acceptance: either ship a complete light-only product and remove misleading dark
  classes, or define light/dark/system behavior and test every surface, iframe,
  dialog, popover, and guest review state.

#### UX-AUD-007 — Long content, localization expansion, and overflow

- Status: `[~] Partial`
- Priority: **P1**
- Current implementation: several project names, URLs, ticket titles, and card rows
  truncate or use fixed widths; some chips wrap but some controls remain compact.
- Gap: long translated labels, long names, right-to-left text, pasted URLs, large
  counts, and long comment bodies can break cards, toolbars, tables, dialogs, and
  popovers.
- Acceptance: test 2x translated labels, 200-character names, long URLs, large
  counts, multiline comments, and mixed scripts at 320px, 768px, 1024px, and wide
  desktop sizes without clipped actions or accidental horizontal page scroll.

#### UX-AUD-008 — Shared toast and live-status system

- Status: `[ ] Pending`
- Priority: **P1**
- HTML evidence: `toast()` is used for copy, save, archive, invite, status, upload,
  account, guest, and AI feedback.
- Current implementation: success feedback is often absent, inline, or handled by
  component-local text; the dashboard has no shared toast region.
- Gap: users cannot reliably tell whether a mutation succeeded, is still running, or
  failed after the relevant form disappears.
- Acceptance: create one accessible toast/notification service with success, error,
  warning, and progress variants; define duration, dismissal, deduplication, focus,
  and screen-reader announcement behavior.

#### UX-AUD-009 — Page title, favicon, and route context

- Status: `[ ] Pending`
- Priority: **P2**
- Current implementation: route components do not set document titles for workspace,
  project, board, ticket, client, activity, settings, guest, or error states.
- Gap: browser tabs, history, screen-reader context, and copied links do not identify
  the active product surface.
- Acceptance: set localized titles such as project name plus section, update them on
  route/data changes, and provide a product favicon and meaningful error-page title.

#### UX-AUD-010 — Visible connection and offline state

- Status: `[ ] Pending`
- Priority: **P1**
- Current implementation: `connectionStore.ts`, `WSProvider.tsx`, and `ws-client.ts`
  track connection state, but the active UI does not provide a persistent connection
  indicator or an offline/reconnecting action.
- Gap: realtime events, notification updates, and optimistic mutations can become
  stale without explaining why.
- Acceptance: show connected, reconnecting, offline, and reconnected states; preserve
  drafts where possible; identify mutations that need retry and never imply a save
  succeeded before the server confirms it.

### Shell, navigation, and route behavior

#### UX-AUD-011 — Workspace switcher interaction contract

- Status: `[~] Partial`
- Priority: **P1**
- HTML evidence: `#wsBtn`, `#wsPop`, `#wsScrim`, selected workspace state, and
  `#newWsBtn`.
- Current implementation: `DashboardSidebar` links the workspace identity to `/`,
  while `WorkspacePickerPage` owns the actual list and creation flow.
- Gap: there is no in-shell open/close state, selected row, keyboard navigation,
  outside-click handling, workspace slug preview, or return focus contract.
- Acceptance: open from the shell by mouse, keyboard, and touch; close with Escape,
  outside click, and selection; preserve the current workspace until switching
  succeeds; restore focus to the trigger.

#### UX-AUD-012 — Mobile navigation and mobile project actions

- Status: `[~] Partial`
- Priority: **P1**
- Current implementation: at 640px the rail becomes a horizontal navigation strip and
  hides the rail footer; `WorkspaceSidebar` has an `isOpen` prop but the active layout
  does not expose a mobile menu trigger.
- Gap: mobile users can lose access to account, billing, notification, workspace,
  and project actions; the source explicitly treats member dashboard and guest review
  as different responsive experiences.
- Acceptance: define the mobile dashboard rule, provide a labelled menu button and
  drawer if the dashboard is supported, keep all required actions reachable, and
  preserve the guest review canvas and comment composer on narrow screens.

#### UX-AUD-013 — Active navigation and query-state correctness

- Status: `[~] Partial`
- Priority: **P1**
- Current implementation: `DashboardSidebar.active()` compares the full pathname and
  search string, while other routes use `NavLink`; query parameters are written by
  individual screens.
- Gap: equivalent query order, extra filters, ticket deep links, and status views can
  lose active styling or produce inconsistent back navigation.
- Acceptance: use a route-aware active-state policy; preserve supported query
  parameters; define canonical URL serialization and verify refresh, copy/paste,
  browser back, forward, and direct deep-link behavior for every filter/view.

#### UX-AUD-014 — Route transition loading and focus restoration

- Status: `[ ] Pending`
- Priority: **P1**
- Current implementation: route-level states are plain text such as `Loading...`,
  `Loading workspace...`, and `Opening ...`; there is no shared skeleton or route
  heading focus behavior.
- Gap: the page can appear blank or jump in height, and keyboard users do not know
  that navigation completed.
- Acceptance: provide route-appropriate skeletons, preserve layout dimensions, move
  focus to the new page heading or main landmark, and announce errors without
  stealing focus from active inputs.

#### UX-AUD-015 — Breadcrumbs, back links, and project context

- Status: `[~] Partial`
- Priority: **P1**
- HTML evidence: project/page headers show project, page, URL, and back/list context.
- Current implementation: project routes use a lightweight header, but page, board,
  share-link, and ticket context is not consistently visible or navigable.
- Gap: users can enter a deep project route and lose the workspace/project/page
  hierarchy; guest and member routes use different context without a shared contract.
- Acceptance: define context headers and breadcrumbs for dashboard, project, page,
  board, ticket, share-link, and guest states, including safe fallback labels when
  data is unavailable.

#### UX-AUD-016 — Global keyboard shortcuts and shortcut discoverability

- Status: `[~] Partial`
- Priority: **P1**
- HTML evidence: `/`, Cmd/Ctrl+K, Escape, Enter, undo, redo, and form-specific
  keyboard handlers.
- Current implementation: only local Escape/focus behavior exists in selected modal
  components; global search and the source shortcut system are absent.
- Gap: shortcuts are neither implemented consistently nor documented, and they can
  conflict with typing inside inputs or with browser behavior.
- Acceptance: implement or explicitly remove each shortcut, scope it away from text
  inputs, show a shortcut help affordance, support Windows/macOS key labels, and test
  keyboard-only flows.

#### UX-AUD-017 — Popover close, outside click, and scroll behavior

- Status: `[~] Partial`
- Priority: **P1**
- Current implementation: notification and custom menus use local open state; there
  is no shared outside-click, Escape, focus, or scroll/reposition contract.
- Gap: menus can remain open after route changes, appear off-screen near viewport
  edges, or be disconnected from their trigger after scrolling.
- Acceptance: every popover has one owner, closes on Escape/outside click/selection,
  repositions on scroll/resize, stays within the viewport, and returns focus to its
  trigger.

#### UX-AUD-018 — Navigation error and not-found recovery

- Status: `[~] Partial`
- Priority: **P1**
- Current implementation: missing workspaces redirect to `/`, and `NotFoundPage` and
  `GlobalErrorFallback` provide basic recovery buttons.
- Gap: redirects can hide whether a workspace/project was deleted, archived, or
  unauthorized; recovery does not preserve the original URL or explain next steps.
- Acceptance: distinguish not found, archived, forbidden, expired guest link, and
  server failure; offer the safest relevant action and retain a recoverable route
  where appropriate.

### Forms, validation, and mutation feedback

#### UX-AUD-019 — Authentication autocomplete and one-time-code ergonomics

- Status: `[~] Partial`
- Priority: **P1**
- HTML evidence: username/password/new-password/email autocomplete, password reveal,
  caps-lock warning, email suggestions, and 6-digit form submission behavior.
- Current implementation: OTP email and code forms exist, but the inputs do not fully
  declare autocomplete semantics, one-time-code behavior, paste handling, resend,
  expiry, or a countdown.
- Acceptance: support password-manager and OS OTP autofill, paste a code safely,
  show resend/expiry state, preserve email when returning, and expose all states to
  screen readers.

#### UX-AUD-020 — Inline validation and error association

- Status: `[ ] Pending`
- Priority: **P1**
- Current implementation: many errors render as a paragraph with `role="alert"`, but
  fields do not consistently use `aria-invalid`, `aria-describedby`, field-level
  messages, or server-field error mapping.
- Gap: users may not know which control failed, especially in multi-field project,
  ticket, integration, and settings forms.
- Acceptance: map client and server errors to fields, mark invalid controls, connect
  helper/error text, keep the first invalid field reachable, and retain entered data.

#### UX-AUD-021 — Submit, pending, success, and duplicate-submit states

- Status: `[~] Partial`
- Priority: **P1**
- Current implementation: several mutations disable a button and change its label,
  but mutation feedback and cache refresh rules vary by feature.
- Gap: some screens close immediately, some leave stale data, and some have no
  success announcement; network retries can duplicate invites, comments, uploads, or
  exports.
- Acceptance: define an idempotency strategy for repeatable mutations, show a stable
  pending state, confirm server success, invalidate/update affected queries, announce
  success, and preserve the form on failure.

#### UX-AUD-022 — Unsaved changes and destructive close behavior

- Status: `[ ] Pending`
- Priority: **P1**
- Current implementation: dialogs close from backdrop/close buttons without a common
  dirty-form check; project, ticket, account, client, and integration forms can hold
  edits locally.
- Gap: accidental Escape, outside click, route change, or workspace switch can discard
  work with no warning.
- Acceptance: track dirty state, warn before destructive close/navigation, provide
  Save/Discard/Cancel choices, and do not block safe closes after a confirmed save.

#### UX-AUD-023 — Copy, export, download, and clipboard fallback

- Status: `[~] Partial`
- HTML evidence: copy share link, copy review link, copy AI output, export comments,
  and download/open asset actions.
- Current implementation: some screens use `navigator.clipboard` directly or browser
  downloads; feedback and fallback behavior are not shared.
- Gap: insecure contexts, denied clipboard permissions, popup blocking, large exports,
  and filename/encoding failures are not consistently explained.
- Acceptance: use one copy/export service with success/error status, manual fallback,
  safe filenames, UTF-8/BOM policy where needed, progress for large exports, and a
  visible download/open result.

#### UX-AUD-024 — File picker, drag/drop, upload progress, and recovery

- Status: `[~] Partial`
- HTML evidence: new-project drop area, file preview/remove/change controls, screenshot
  attachment tray, and upload error feedback.
- Current implementation: file inputs and upload mutations exist, but the main form
  does not expose the full drop-zone, per-file status, cancellation, retry, duplicate,
  or partial-success flow.
- Gap: users cannot reliably see which file failed, what is still uploading, or whether
  a created project has all expected files.
- Acceptance: support click and drag/drop, keyboard file selection, per-file preview,
  type/size/page validation, progress, cancel, retry, remove, duplicate detection,
  partial-success recovery, and an accessible status summary.

#### UX-AUD-025 — URL and environment validation

- Status: `[~] Partial`
- HTML evidence: source URL helper, environment detection, proxy/load checks, and
  "check URL"/retry behavior.
- Current implementation: `ProjectForm.tsx` validates required text and heuristically
  detects staging from the URL, but the user-facing validation and proxy diagnostics
  are incomplete.
- Gap: malformed URLs, blocked hosts, redirects, authentication walls, localhost,
  unsafe schemes, and environments that disagree with the selected value are not
  explained before submission.
- Acceptance: normalize and validate URL/origin server-side and client-side, explain
  unsupported targets, show the detected environment with an editable override, and
  provide a check/retry path that does not lose the form.

#### UX-AUD-026 — Date, time, timezone, and due-date editing

- Status: `[~] Partial`
- HTML evidence: custom date picker with month navigation, Clear, Today, and inline
  due-date placement.
- Current implementation: native date inputs and `toLocaleDateString()`/`toLocaleString()`
  are used in several screens.
- Gap: format, timezone, week start, relative labels, and clear/today behavior differ
  by browser and are not tied to an explicit user/workspace timezone.
- Acceptance: store instants and date-only values deliberately, expose locale/timezone
  preferences, provide clear/today and keyboard calendar behavior, and test DST and
  boundary dates.

#### UX-AUD-027 — Form reset and retry after partial failure

- Status: `[ ] Pending`
- Priority: **P1**
- Current implementation: some mutations report an error but do not restore a failed
  upload, invite, integration save, or project creation step to a retryable state.
- Acceptance: define which values remain, which side effects are already committed,
  and which button retries each failure; never suggest that a failed operation is
  safe to repeat when it is not idempotent.

### Dialogs, menus, and overlays

#### UX-AUD-028 — Dialog focus trap, labelling, and return focus

- Status: `[~] Partial`
- Current implementation: `Dialog.tsx` uses native `<dialog>.showModal()` and restores
  the previously active element, while several custom overlays implement their own
  Escape handling.
- Gap: custom `CommentThreadPanel`, `NewProjectModal`, `ComingSoonModal`, and other
  overlays do not share the same focus trap, labelled-by/description, scroll-lock,
  return-focus, and nested-dialog behavior.
- Acceptance: standardize a dialog primitive; every modal has a unique title,
  description when needed, initial focus, focus containment, Escape behavior, backdrop
  policy, scroll lock, and reliable focus restoration.

#### UX-AUD-029 — Modal backdrop and accidental dismissal policy

- Status: `[~] Partial`
- Current implementation: some overlays close on backdrop click, while native dialogs
  and project flows have different behavior.
- Gap: a click outside a long form, an asset composer, or a destructive confirmation
  can have different consequences depending on the route.
- Acceptance: classify informational, editable, and destructive overlays; define when
  backdrop click is allowed and test it with dirty and pending states.

#### UX-AUD-030 — Menu semantics and keyboard navigation

- Status: `[ ] Pending`
- HTML evidence: workspace, project, role, sort, filter, display, tag, assignee,
  date, AI, account, and link-setting popovers.
- Current implementation: many are ordinary `div`/`button` groups without a shared
  menu/listbox/combobox contract.
- Acceptance: use the correct ARIA pattern, support Arrow/Home/End/Enter/Space/Escape,
  type-ahead where appropriate, expose selected/disabled states, and return focus to
  the trigger.

#### UX-AUD-031 — Overlay viewport positioning and layering

- Status: `[~] Partial`
- Priority: **P1**
- Current implementation: some popovers use fixed positioning and some use local
  absolute positioning; z-index values are distributed across CSS and Tailwind.
- Gap: menus can clip inside scrolling containers, sit behind sticky toolbars, or
  render off-screen near the right/bottom edge.
- Acceptance: use one overlay layer/positioning strategy, test every anchor near all
  viewport edges, and handle scroll/resize/zoom without detached menus.

### Dashboard and project-list micro-interactions

#### UX-AUD-032 — Dashboard greeting, date, and attention block states

- Status: `[~] Partial`
- HTML evidence: `#greet`, `#greetSub`, `#headDate`, `#attnThreads`, and
  `#allThreads`.
- Current implementation: waiting tickets are loaded into `ProjectsPage`, but the
  source's greeting/date logic, count consistency, ordering, author/time/page context,
  and zero-state action are not fully reproduced.
- Acceptance: define timezone-aware greeting, skeleton, zero, one, many, and error
  states; keep header counts, sidebar counts, and filtered results consistent.

#### UX-AUD-033 — Project type tabs and ARIA tab behavior

- Status: `[~] Partial`
- HTML evidence: `#typeTabs` uses a tablist and type content region.
- Current implementation: project types are buttons/links with `aria-pressed` or
  ordinary links; the content region is not a complete tab pattern.
- Acceptance: either use correct tabs with `aria-selected`, tab panels, keyboard arrow
  navigation, and URL state, or document that these are filters and implement them as
  filter controls with an accessible result summary.

#### UX-AUD-034 — Project filters, clear state, and result explanation

- Status: `[~] Partial`
- Current implementation: project search, client, archive, type, sort, and display
  parameters exist, but there is no shared active-filter summary or clear-all action.
- Gap: users can arrive at an empty result and not know which filter caused it; filter
  changes can also reset unrelated state.
- Acceptance: show active filter chips, clear one/all, announce result count, preserve
  independent filters, and offer a useful empty state for both no data and no match.

#### UX-AUD-035 — Project card action discoverability and keyboard parity

- Status: `[~] Partial`
- HTML evidence: card hover actions include open, share, settings, menu, and archive.
- Current implementation: actions are rendered in card footers but preview/focus
  behavior, action order, and keyboard visibility are not defined as one contract.
- Acceptance: all card actions are reachable without hover, have specific accessible
  names, preserve the card link behavior, and do not trigger the wrong action when the
  card or preview is clicked.

#### UX-AUD-036 — Project preview fidelity and failure state

- Status: `[~] Partial`
- Current implementation: `ProjectCard.tsx` uses a generated initial or generic browser
  preview because there is no real per-project screenshot capture.
- Gap: cards do not distinguish loading, stale, failed, unavailable, or intentionally
  mocked previews; recovery/deploy warnings are not clear.
- Acceptance: provide preview loading/error/placeholder states, alt text or an
  equivalent label, refresh/retry, and a visible reason when a preview is unavailable.

#### UX-AUD-037 — New-project wizard state machine

- Status: `[~] Partial`
- HTML evidence: `#stp1`, `#stp2`, `#stp3`, `#npBody`, `#npFoot`, `#npBack`, and
  `#npCreate`.
- Current implementation: `ProjectForm.tsx` uses one form for website/image/PDF and
  does not expose the source's three-step progress, back behavior, or completion view.
- Acceptance: define step validation, Back/Next/Create labels, preserved inputs,
  close/reopen behavior, step focus, draft recovery, and a success state with review
  link, copy, open, and guest-preview actions.

#### UX-AUD-038 — Client selection and inline client creation

- Status: `[~] Partial`
- HTML evidence: new-project client contact fields, `#ncName`, `#ncCont`, `#ncMail`,
  and inline add-client path.
- Current implementation: a client select and a `new` name field exist, but contact
  details, dedupe, cancellation, and validation are not equivalent.
- Acceptance: allow selecting, creating, and cancelling a client without losing
  project fields; validate and normalize email; prevent duplicates; show the created
  client as selected only after persistence succeeds.

#### UX-AUD-039 — Project type/file acceptance and SVG path

- Status: `[~] Partial`
- Priority: **P1**
- Current implementation: image/PDF inputs and asset upload controls exclude SVG in
  their `accept` values.
- Gap: the source data contains SVG assets, so the UI and API need an explicit safe
  SVG decision rather than silently rejecting or treating it as a raster image.
- Acceptance: decide sanitized SVG support, validate content and size server-side,
  render safely, show correct thumbnails/previews, and explain unsupported files.

#### UX-AUD-040 — Coming-soon and disabled feature honesty

- Status: `[~] Partial`
- HTML evidence: Web App/Mobile coming-soon panels and “Tell me when it ships”.
- Current implementation: placeholder routes and a `ComingSoonModal` exist, but the
  exact roadmap copy, notify action, persisted interest, and disabled-feature wording
  are not a complete product flow.
- Acceptance: every unavailable feature has a consistent reason, expected behavior,
  notification opt-in with consent, success state, and no misleading enabled control.

### Project review canvas and asset-review micro-interactions

#### UX-AUD-041 — Preview load progress, fallback, and retry

- Status: `[~] Partial`
- HTML evidence: `#ifLoad`, `#ifStat`, `#ifNote`, `data-retry`, `data-usemock`, and
  the direct-load fallback strip.
- Current implementation: proxy iframe loading exists, but source-level progress,
  timeout, fallback, retry, URL check, blank-page diagnosis, and mock-preview choice
  are incomplete.
- Acceptance: make each preview state visible and actionable; preserve Comment/Browse
  mode and selected page across retry; explain whether the issue is target-site,
  proxy, browser policy, or network failure.

#### UX-AUD-042 — Viewport, browser, orientation, zoom, reload, undo, and redo controls

- Status: `[~] Partial`
- HTML evidence: `#vpBtn`, `#wIn`, `#brBtn`, `#brPop`, `data-zoom`, `data-dev`,
  `data-orient`, `data-reload`, `data-undo`, and `data-redo`.
- Current implementation: `ViewportMenu`, Browse/Comment mode, open-new-tab, and a
  version/paywall control exist; browser selector, custom width, orientation, zoom,
  reload, and undo/redo parity are missing or static.
- Acceptance: every control has a real state, keyboard/touch operation, disabled
  reason, accessible label, URL/persistence policy, and a clear result when the
  selected configuration cannot be applied.

#### UX-AUD-043 — Canvas keyboard, touch, and pointer behavior

- Status: `[ ] Pending`
- Priority: **P1**
- Current implementation: website commenting relies on iframe/widget pointer behavior;
  image/PDF selection relies on pointer coordinates and a “center” fallback button.
- Gap: keyboard-only users cannot place or edit a region, touch scrolling and drawing
  can conflict, and pointer capture/cancel behavior is not consistently communicated.
- Acceptance: provide keyboard alternatives, minimum hit areas, touch-safe pan/draw
  behavior, pointer cancel recovery, and instructions that change with View/Comment
  mode.

#### UX-AUD-044 — Page header, page list, and page navigation feedback

- Status: `[ ] Pending`
- HTML evidence: project/page header, page rows, `data-open-page`, and page open counts.
- Current implementation: pages can be registered/listed by the SDK but are not a
  navigable dashboard page list with active state and page-specific controls.
- Acceptance: show current page, URL/file, comment count, open state, page actions,
  loading/error, and a safe empty state; preserve the selected page on refresh and
  shareable deep links.

#### UX-AUD-045 — Image/PDF zoom, rotation, download, and page errors

- Status: `[~] Partial`
- Current implementation: image/PDF rendering, page navigation, and region comments
  exist in `AssetReview.tsx`.
- Gap: zoom/rotation/download/open-file behavior, page-render errors, file switch
  focus, and per-page comment counts are incomplete.
- Acceptance: add accessible zoom/fit controls, page error/retry, rotation policy,
  download/open behavior, loading progress, and a clear distinction between document
  navigation and comment navigation.

#### UX-AUD-046 — Asset add, replace, remove, and reorder lifecycle

- Status: `[~] Partial`
- Current implementation: upload is available from the review screen, but asset
  management is not a complete lifecycle.
- Gap: users cannot reliably replace a failed file, remove/reorder assets, edit
  filename/metadata, or understand whether deleting an asset deletes its comments.
- Acceptance: define asset ownership, delete/reorder/replace confirmation, comment
  retention behavior, upload progress, and recovery for every asset operation.

### Comment, thread, and collaboration UX

#### UX-AUD-047 — Comment filter, sort, and display controls

- Status: `[~] Partial`
- HTML evidence: sort (`newest`, `oldest`, `replies`, `status`), filter, display mode,
  current-page toggle, hide-resolved, grouping, and active-filter count controls.
- Current implementation: `CommentsTab.tsx` covers a meaningful subset, but not the
  full sort/filter/display contract.
- Acceptance: define every option, selected state, count, clear-all behavior, URL or
  project-state persistence, result ordering, and empty result explanation.

#### UX-AUD-048 — Thread list focus, selection, and page jump

- Status: `[~] Partial`
- Current implementation: comments can be opened and a project comment can link to a
  board/ticket route; the complete source selection/highlight/scroll contract is not
  present.
- Acceptance: selecting a thread highlights the pin/card, scrolls the canvas to the
  correct page/region, updates the URL when appropriate, and returns focus to the
  thread when the user closes the detail panel.

#### UX-AUD-049 — Thread detail and reply panel behavior

- Status: `[~] Partial`
- Current implementation: `CommentThreadPanel.tsx` and asset review replies exist,
  with local Escape handling.
- Gap: custom dialog focus containment, attachments, mention support, error placement,
  pending/retry state, reply visibility explanation, and stale-thread recovery are
  inconsistent between dashboard, board, asset, and guest surfaces.
- Acceptance: use one thread component contract with author/time/layer/status,
  attachment/mention controls, retryable errors, live updates, focus return, and
  permission-aware actions.

#### UX-AUD-050 — Comment metadata controls and immediate feedback

- Status: `[~] Partial`
- HTML evidence: status, priority, tags, assignee, waiting-on, due date, and client
  resolution controls.
- Current implementation: many controls exist in ticket/detail views, not as a
  consistent comment-thread experience.
- Acceptance: show current value, pending state, success state, permission state, and
  conflict/error state for each control; do not silently clear dependent fields when
  a status changes.

#### UX-AUD-051 — Attachments and screenshot tray

- Status: `[~] Partial`
- HTML evidence: `data-shotpick`, `data-shotdrop`, attachment previews and remove
  controls.
- Current implementation: widget attachments and backend attachment contracts exist;
  dashboard comment/ticket composer support is incomplete.
- Acceptance: support keyboard file selection, per-file progress, preview/remove,
  retry, size/type errors, screenshot failure messaging, and safe download labels on
  every authoring surface.

#### UX-AUD-052 — Mentions and recipient feedback

- Status: `[ ] Pending`
- HTML evidence: `menPop`, mention scanning/insertion, and mention recipient behavior.
- Current implementation: plain text comment/reply fields do not provide mention
  autocomplete or recipient validation.
- Acceptance: type `@` to open a workspace-scoped list, support keyboard selection,
  preserve plain-text fallback, prevent foreign-workspace recipients, show selected
  mentions accessibly, and generate one deduplicated notification per recipient.

#### UX-AUD-053 — Move, resize, and region editing affordances

- Status: `[ ] Pending`
- HTML evidence: `data-region`, `data-rz`, selected-region handles, move/resize
  handlers, and saved/reverted feedback.
- Current implementation: placement creation and anchor recovery exist, but dashboard
  users cannot perform the source's explicit move/resize interaction.
- Acceptance: show selection handles only for authorized users, support keyboard and
  pointer editing, clamp valid coordinates, show saving/error/conflict state, and
  provide cancel/undo behavior.

#### UX-AUD-054 — Undo/redo scope and safe inverse actions

- Status: `[ ] Pending`
- HTML evidence: `pushUndo`, `doUndo`, `doRedo`, and keyboard shortcuts.
- Current implementation: no shared inverse-action history for status, metadata,
  placement, assignment, or merge.
- Acceptance: define which operations are reversible, keep server/audit consistency,
  expire unsafe history, handle concurrent changes, and announce the result.

#### UX-AUD-055 — Client/team visibility clarity

- Status: `[~] Partial`
- Current implementation: some forms use `Client visible` and `Team only` labels.
- Gap: the layer is not consistently visible in list rows, thread headers, replies,
  notifications, exports, guest screens, and ticket detail; users can misread who will
  see a reply.
- Acceptance: display a persistent layer badge and explanation wherever a comment or
  reply is authored or read, with backend permission state reflected in the UI.

### Ticket, client, activity, and workspace-management UX

#### UX-AUD-056 — Ticket view controls and consistent counts

- Status: `[~] Partial`
- HTML evidence: list, board, table, calendar, view counts, grouping, and ticket IDs.
- Current implementation: all four views are present, but labels are raw lower-case
  values and source-level counts, IDs, page markers, and empty states are incomplete.
- Acceptance: provide localized, human labels, active state, per-view counts, loading
  and empty states, stable ordering, and equivalent actions in every view.

#### UX-AUD-057 — Ticket filters, chips, and clear-all flow

- Status: `[~] Partial`
- Current implementation: status/project/priority/tag/assignee/view/group/sort filters
  exist through URL parameters.
- Gap: multi-select filters, stacked assignees, active chips, reset, filter counts,
  and no-results recovery do not fully match the source.
- Acceptance: show every active filter, clear one/all without resetting the view,
  preserve filters in copied URLs, and announce result counts.

#### UX-AUD-058 — Board drag/drop and keyboard alternative

- Status: `[ ] Pending`
- HTML evidence: `data-drag-tid`, `data-drop-col`, `data-drop-day`, drag highlight,
  status/due-date feedback, and rollback path.
- Current implementation: board cards use status selects and calendar tickets are not
  draggable.
- Acceptance: implement pointer and keyboard move, valid drop target feedback,
  optimistic update, server confirmation, rollback/error, stale-event handling, and a
  non-drag alternative with the same result.

#### UX-AUD-059 — Calendar semantics and due-date workflow

- Status: `[~] Partial`
- Current implementation: the calendar renders a month grid and opens tickets, but it
  uses a visual grid rather than a complete accessible calendar interaction.
- Gap: no Today shortcut, month/year picker, keyboard grid navigation, clear date
  affordance, due-date timezone explanation, or consistent no-due-date behavior.
- Acceptance: implement an accessible calendar, localize weekday/month labels, support
  keyboard navigation and Today/Clear, and keep due-date edits synchronized with the
  ticket detail form.

#### UX-AUD-060 — Ticket detail deep links and not-found behavior

- Status: `[~] Partial`
- Current implementation: `?ticket=` opens a dialog and can report that a ticket is
  not in active projects.
- Gap: archived/deleted/permission-denied tickets are not clearly distinguished, and
  closing the dialog does not consistently restore the originating list focus.
- Acceptance: preserve the originating filters/view, distinguish ticket states, focus
  the triggering row after close, and provide a safe project/page link when available.

#### UX-AUD-061 — Client table responsive and summary behavior

- Status: `[~] Partial`
- HTML evidence: client summary columns, project chips, counts, last activity, and
  action menu.
- Current implementation: `ClientsPage.tsx` shows client/contact/projects/since and
  edit/archive actions.
- Gap: the table does not provide the source summary counts, a mobile card strategy,
  sortable columns, or a clear project/client empty state.
- Acceptance: define desktop table and mobile card layouts, accessible row actions,
  summary metrics, sorting, pagination/large-list behavior, and client-specific empty
  states.

#### UX-AUD-062 — Client action menu and destructive archive recovery

- Status: `[~] Partial`
- Current implementation: edit and archive exist; the source also exposes rename,
  invite reviewer, new project, see all projects, activity export, and archive
  confirmation.
- Acceptance: provide all authorized actions, explain what remains after archive,
  prevent accidental action selection, show mutation feedback, and provide a restore
  path if the product contract supports it.

#### UX-AUD-063 — Activity filters, grouping, and actionable destinations

- Status: `[~] Partial`
- HTML evidence: Everything/My actions/From clients/Deploys, Today/Yesterday/Earlier,
  event icons, copy, and destinations.
- Current implementation: activity pagination and a small event-type filter exist;
  rows display raw event-type text and a general project link.
- Acceptance: add the source filters/grouping, localized event copy/icons, actor and
  target metadata, exact project/page/thread destination, and a helpful empty state.

#### UX-AUD-064 — Members, integrations, billing, usage, settings, and MCP honesty

- Status: `[~] Partial`
- Current implementation: pages and controls exist, but some features are placeholders
  or use static display/paywall behavior.
- Gaps: invite/resend/remove/role actions, secret-field masking, connection failure and
  retry, plan/usage limits, settings dirty state, and the MCP connect contract need
  consistent UI states. A control must not look live when its backend is not available.
- Acceptance: for every workspace-management control define loading, success, failure,
  empty, permission, retry, and disabled/provider-unconfigured states and test them.

### Sharing and guest-review UX

#### UX-AUD-065 — Share modal permission explanation

- Status: `[~] Partial`
- HTML evidence: invite field, role picker, per-person access rows, link toggle,
  settings, guest preview, and ask-name control.
- Current implementation: `ShareProjectModal.tsx` and `CollaboratorsModal.tsx` expose
  a subset of invites and link management.
- Gap: the role meaning, workspace/project scope, effective permission, and pending
  invite state are not consistently clear.
- Acceptance: show role descriptions, current/pending/expired access, permission
  source, remove confirmation, and a server-confirmed result for each action.

#### UX-AUD-066 — Link expiry, passcode, domain, export, and regeneration controls

- Status: `[~] Partial`
- HTML evidence: `linkSettingsHTML`, expiry options, password toggle, domain control,
  export toggle, regenerate link, and ask-reviewer-name option.
- Current implementation: API fields exist for some policies, but the UI does not
  expose or persist the complete policy set.
- Acceptance: make each policy visible, explain its effect, validate values, show
  timezone/date meaning, warn before regeneration/revocation, and display the exact
  effective link state after save.

#### UX-AUD-067 — Copy/open/revoke/expired share-link feedback

- Status: `[~] Partial`
- Current implementation: copy, create, and revoke exist in parts of the app.
- Gap: popup blockers, clipboard failure, expired/revoked/archived links, and stale
  modal data are not consistently handled.
- Acceptance: provide a clear result for copy/open/revoke, refresh policy state after
  mutation, distinguish expired/revoked/archived/forbidden review links, and offer the
  right next action without exposing private project data.

#### UX-AUD-068 — Guest entry, name/passcode, and session recovery

- Status: `[~] Partial`
- HTML evidence: guest gate, name input, start reviewing, passcode/link checks, leave
  guest review, and guest controls.
- Current implementation: real share resolution, guest sessions, passcodes, and guest
  comments exist.
- Gap: ask-name policy, passcode errors, session expiry, reload/re-entry, leave-review,
  and consistent website/image/PDF controls need one guest contract.
- Acceptance: support name validation, passcode retry/lockout messaging, session
  expiry recovery, leave/re-enter, link state errors, draft protection, and no member
  chrome on guest routes.

#### UX-AUD-069 — Guest mobile review and touch comment flow

- Status: `[~] Partial`
- Priority: **P1**
- Current implementation: asset review has a mobile media rule and the widget has a
  shadow DOM UI, but canvas, pin, composer, thread, and attachment behavior need a
  real narrow-screen journey.
- Acceptance: test 320px/375px/768px guest website, image, and PDF journeys with
  touch scrolling, comment placement, keyboard appearance, composer repositioning,
  attachment selection, and thread close/reopen.

#### UX-AUD-070 — Guest connection, draft, and server-error feedback

- Status: `[ ] Pending`
- Current implementation: widget errors are shown inside a thread or toast, but there
  is no complete offline/reconnect/draft policy for a guest comment.
- Acceptance: show capture/upload/post stages, keep unsent text and attachments on
  recoverable failure, explain screenshot failure separately from comment failure,
  reconnect realtime state, and prevent duplicate posts on retry.

### Accessibility and inclusive interaction

#### UX-AUD-071 — Landmark, skip-link, and page-heading structure

- Status: `[~] Partial`
- Current implementation: routes use `main`, `nav`, `aside`, headers, tables, and
  dialogs in places, but there is no global skip link or consistent one-main/one-h1
  contract.
- Acceptance: add skip-to-content, stable landmarks, one useful page heading, logical
  heading hierarchy, and a route focus target for every member and guest screen.

#### UX-AUD-072 — Focus-visible and touch-target audit

- Status: `[~] Partial`
- Current implementation: some controls have focus styles; many text buttons and
  icon-only controls rely on default browser focus or small padding.
- Gap: compact project actions, close buttons, notification bell, pins, filter chips,
  and widget actions may be difficult to operate by keyboard or touch.
- Acceptance: every interactive control has a visible focus indicator with sufficient
  contrast and a minimum touch target, with exceptions documented for dense canvas pins.

#### UX-AUD-073 — Screen-reader announcements for async state

- Status: `[ ] Pending`
- Current implementation: selected queries use `role="status"`/`role="alert"`, but
  saves, copies, route changes, realtime changes, uploads, and toasts are not governed
  by one live-region policy.
- Acceptance: add polite status and assertive error regions where appropriate, avoid
  duplicate announcements, announce count/filter changes, and test with a screen
  reader on forms, dialogs, board, calendar, canvas, and guest widget.

#### UX-AUD-074 — Accessible names, descriptions, and state attributes

- Status: `[~] Partial`
- Current implementation: several controls have `aria-label`/`aria-pressed`, but
  repeated raw text buttons, table actions, tabs, popovers, status selects, and custom
  panels are not uniformly named or described.
- Acceptance: verify every interactive element in the rendered DOM has a useful name,
  every toggle exposes state, every menu exposes relationship, and every error/helper
  text is associated with its control.

#### UX-AUD-075 — Keyboard completion for non-pointer interactions

- Status: `[ ] Pending`
- Scope: workspace switch, search, notification, project menu, filters, page list,
  canvas mode, comments, thread, mention, file picker, board, calendar, share modal,
  guest review, and account tabs.
- Acceptance: create a keyboard-only journey from login through project creation,
  comment/reply, ticket update, sharing, and logout; no required result may depend on
  hover, drag, pointer coordinates, or color.

#### UX-AUD-076 — Zoom, reflow, orientation, and assistive technology support

- Status: `[ ] Pending`
- Priority: **P1**
- Gap: fixed canvas widths, sticky toolbars, tables, popovers, and compact controls
  need testing at 200%/400% browser zoom, landscape/portrait, and narrow reflow.
- Acceptance: meet WCAG reflow expectations for dashboard/forms; document the review
  canvas's intentional horizontal workspace behavior and provide a usable alternative
  for controls that cannot reflow.

#### UX-AUD-077 — Reduced cognitive load and confirmation language

- Status: `[ ] Pending`
- Gap: source and current UI use concise labels, but warnings, destructive actions,
  visibility changes, link regeneration, archive/delete, and provider paywalls need
  consistent plain-language explanations.
- Acceptance: define action verbs, consequences, recovery language, and confirmation
  requirements; avoid ambiguous labels such as generic “Save” when scope is unclear.

### Resilience, performance, and production UX

#### UX-AUD-078 — Skeletons and layout stability

- Status: `[ ] Pending`
- Current implementation: most screens show plain text loading messages and then swap
  to content.
- Gap: layout shifts cause lost scroll position and make the interface feel incomplete.
- Acceptance: add route/component skeletons that match the final layout, reserve image
  and preview space, and test loading at slow network conditions.

#### UX-AUD-079 — Query cache, stale data, and cross-screen synchronization

- Status: `[~] Partial`
- Current implementation: React Query invalidation and websocket events cover several
  resources, but notification, project, ticket, comment, activity, and share-link
  refresh behavior is not one documented matrix.
- Acceptance: document freshness and invalidation per resource, handle stale mutation
  responses, update open dialogs after realtime changes, and avoid refetch storms.

#### UX-AUD-080 — Large workspace and long-list behavior

- Status: `[ ] Pending`
- Scope: projects, comments, tickets, clients, members, notifications, activity,
  pages, assets, and share links.
- Acceptance: define pagination/windowing/search thresholds, loading-more state,
  selection behavior across pages, empty pages, and stable ordering; test with large
  seeded workspaces.

#### UX-AUD-081 — Image, PDF, iframe, and widget resource lifecycle

- Status: `[~] Partial`
- Current implementation: asset rendering, proxy iframe, screenshot capture, signed
  URLs, and widget tracking exist.
- Gap: cleanup, cancellation, stale iframe events, large PDF memory, object URLs,
  hidden tabs, repeated route changes, and failed screenshot capture need explicit UX
  behavior.
- Acceptance: cancel obsolete requests, release object URLs, cap/render large assets
  safely, surface recoverable errors, and verify no stale frame can mutate a new page.

#### UX-AUD-082 — Error boundary and retry quality

- Status: `[~] Partial`
- Current implementation: Sentry fallback and per-query error text exist.
- Gap: fallback exposes raw error details, most query errors lack a local retry action,
  and errors do not preserve route/action context consistently.
- Acceptance: show a user-safe message, keep diagnostic details private, provide local
  retry/reload/home choices, preserve recoverable form state, and attach correlation
  IDs to support diagnostics.

#### UX-AUD-083 — External navigation and popup safety

- Status: `[~] Partial`
- Current implementation: several external links use `target="_blank"` with `rel`,
  while iframe/open-new-tab/share flows have separate code paths.
- Acceptance: define external-link labels, popup-blocked handling, `noopener` policy,
  safe URL validation, and user-visible confirmation for opening a client-facing or
  guest view.

#### UX-AUD-084 — Privacy-safe UI telemetry and support diagnostics

- Status: `[ ] Pending`
- Acceptance: define events for failed saves, upload failures, retries, link failures,
  and route errors without recording comment bodies, tokens, passcodes, private URLs,
  or personal data; expose a support-safe request/correlation ID when needed.

## Language and localization support

### Current state

- Status: `[ ] Pending`
- Priority: **P1**
- Evidence: no i18n/localization package, translation catalog, locale preference,
  language selector, `Accept-Language` handling, or localized email/widget resource
  layer exists in the repository.
- Current implementation uses hard-coded English strings throughout React and the
  widget, raw event-type transformations such as `event.type.replace(...)`, native
  `toLocaleDateString()`/`toLocaleString()` calls without an explicit locale contract,
  English weekday labels in the ticket calendar, and English backend error messages.
- User-authored project names, client names, ticket bodies, comments, and URLs should
  remain user content; they must not be translated automatically.

### LANG-AUD-001 — Locale ownership and fallback policy

- Decide whether locale is user-level, workspace-level, or user-level with a
  workspace default. Recommended policy: user preference first, workspace default
  second, browser locale third, English fallback last.
- Store a BCP 47 locale such as `en`, `hi-IN`, or `es-ES`; do not store display names
  as the preference value.
- Define fallback for missing messages, unsupported locales, malformed locale tags,
  guest links, and signed-out login.
- Add tests proving a user never sees a blank label or untranslated message key.

### LANG-AUD-002 — Translation architecture

- Create a shared `packages/i18n` package with stable message IDs, locale loaders,
  plural/select/date/number formatting, and React/widget adapters.
- Use ICU-style messages or an equivalent format that supports plural and select rules;
  never build user-facing copy with string concatenation.
- Keep backend error codes stable and translate them at the client boundary. Backend
  emails and server-rendered messages must use the request/user locale explicitly.
- Make the widget bundle able to load only the selected locale and fall back safely
  when a translation chunk is unavailable.

### LANG-AUD-003 — Language preference UI

- Add a language selector to account preferences and, if required, a workspace default
  to workspace settings.
- Show the current language in its native name and an accessible English description.
- Apply the change immediately where possible, preserve unsaved form state, and
  announce the new language.
- Provide a guest/login language entry point without requiring an authenticated user.

### LANG-AUD-004 — What must be translated

Translate and test all of the following message domains:

- Login, OTP, signup/reset if implemented, Google callback, caps-lock, resend, expiry,
  validation, and authentication errors.
- Navigation, workspace/project/client/ticket/activity/settings/member/billing/usage/
  integration/MCP labels and empty states.
- Project types, wizard steps, file constraints, upload progress, preview loading,
  proxy failure, retry, browser/device/viewport controls, and page management.
- Comment status, priority, tags, layers, assignees, waiting-on, due dates, replies,
  mentions, attachments, screenshots, AI, and export actions.
- Share-link policies, guest name/passcode gates, expired/revoked/archived states,
  permission copy, and client-facing messages.
- Toasts, confirmations, errors, retry instructions, notification descriptions, and
  activity event copy.
- Email subjects/bodies, notification digests, invite/reset messages, and widget UI.

### LANG-AUD-005 — Locale-aware dates, numbers, and relative time

- Replace direct `toLocaleDateString()`/`toLocaleString()` calls with shared formatters
  that receive locale and timezone.
- Use locale-aware pluralization for project, ticket, comment, member, file, page,
  notification, and credit counts.
- Define date-only versus instant semantics for due dates, expiry, activity, and
  notification timestamps; test DST, UTC offsets, and “today/yesterday” boundaries.
- Localize calendar weekday/month names and first-day-of-week behavior.

### LANG-AUD-006 — Translation-safe layout and typography

- Test expansion of 30–100% for German/Spanish-style labels, compact scripts, and
  translated error messages.
- Test Devanagari, Arabic, CJK, combining marks, emoji, and mixed-script names in
  cards, avatars, chips, inputs, tables, comments, and canvas labels.
- Use locale-appropriate fonts with a fallback stack that supports the chosen launch
  languages; verify avatar initials when a script has no uppercase concept.
- Keep user content direction separate from interface direction where needed.

### LANG-AUD-007 — RTL and bidirectional text readiness

- Decide whether RTL is in the initial launch. If not, keep the data model and CSS
  ready for `dir="rtl"` later.
- Replace left/right-specific layout assumptions with logical CSS properties where
  feasible; test popover anchoring, arrows, breadcrumbs, ticket board, asset pins,
  attachment names, and mixed Arabic/Latin URLs.
- Use Unicode isolation around user names, URLs, IDs, dates, and status labels.

### LANG-AUD-008 — Backend, email, and integration localization

- Add locale to authenticated user/profile preferences and pass it to notification
  and digest workers.
- Use stable event codes with localized rendering instead of storing English display
  strings as the source of truth.
- Localize invite, password/OTP, share, digest, integration-failure, and billing
  emails with correct date/timezone and unsubscribe/preferences links.
- Do not translate third-party provider payloads or user-authored comment text unless
  a separate, explicit translation feature is approved.

### LANG-AUD-009 — Language QA and release gates

- Add pseudo-locale testing that expands strings and marks missing translations.
- Add screenshot/visual checks for every route and modal in each supported locale.
- Run keyboard, screen-reader, contrast, and 320px/400% zoom checks per locale.
- Verify fallback when a locale chunk fails, when a message ID is missing, and when a
  browser requests an unsupported language.
- Add translation completeness checks to CI and block releases with missing P0/P1
  product strings.

### Recommended language rollout

1. **Foundation:** extract all English strings, add locale preference/fallback,
   shared formatting, backend error codes, widget locale plumbing, and English as the
   complete reference catalog.
2. **First additional locale:** add Hindi (`hi-IN`) if the initial product audience
   matches the current India-based operating context; otherwise choose the highest
   user-volume locale from product analytics. Validate the architecture with a full
   end-to-end translation rather than translating only the login screen.
3. **Expansion:** add the next languages based on actual workspace/member/guest usage,
   with translator review for product terminology, email, widget, and guest flows.
4. **RTL readiness:** complete logical CSS and bidirectional text tests before adding
   Arabic, Hebrew, or another RTL locale.

## Audit acceptance matrix

Before calling the working website production-ready, verify every route and state in
this matrix for desktop, narrow mobile where supported, keyboard, screen reader,
slow network, offline/reconnect, light/dark policy, and each supported locale:

| Surface | Normal | Loading | Empty | Validation | Error/retry | Success | Permission/visibility |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Login/OTP | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Workspace picker/switcher | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Projects/dashboard | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| New-project wizard | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Project settings/lifecycle | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Website preview/canvas | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Image/PDF review | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Comments/threads | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Tickets/board/calendar | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Clients/activity | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Sharing/guest review | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Members/integrations | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Account/security/preferences | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Billing/usage/AI | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

## Updated priority order

1. **P0 production correctness:** replace the repository HTML reference, resolve the
   authentication model, enforce project/share/guest permissions, add project review
   settings, complete security/session behavior, and prevent cross-workspace leakage.
2. **P1 usable core journeys:** finish search, project lifecycle, page/version flow,
   canvas fallback and controls, comments/attachments/mentions, ticket drag/keyboard
   flow, share/guest policy, route/deep-link behavior, mutation feedback, and mobile
   navigation.
3. **P1 accessibility and resilience:** standardize dialogs/popovers, focus and live
   regions, keyboard alternatives, errors/retries, offline/reconnect, large-list
   behavior, and the acceptance matrix.
4. **P1 localization foundation:** extract messages, add locale preference/fallback,
   shared formatters, email/widget plumbing, and complete English catalog before
   translating additional languages.
5. **P2 polish:** icon replacement, typography/density, motion, theme, visual parity,
   tooltip polish, and lower-risk convenience interactions.

## Final audit conclusion

The product now has a detailed feature backlog and a separate micro-UX backlog. The
remaining work is broader than adding missing routes: each implemented-looking screen
still needs its state machine, feedback, permissions, keyboard/touch behavior,
responsive rules, accessibility semantics, resilience behavior, and localization
contract. Language support is currently not implemented; the recommended first step
is to build the localization foundation and complete English extraction before adding
Hindi or any other additional locale.
