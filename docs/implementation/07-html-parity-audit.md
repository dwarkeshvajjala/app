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
