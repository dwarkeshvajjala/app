# Post-login UI migration — reusable chat prompts

Date: 2026-09-08

Use the base prompt plus exactly one slice prompt in each new Codex task. This keeps
the visual contract stable while limiting each task to a reviewable UI surface.

## Base prompt — paste every time

```text
Work only on the Backline frontend UI in this repository. Read AGENTS.md,
docs/implementation/00-index.md, docs/implementation/10-ui-migration-chat-prompts.md,
and the relevant current React files before editing. Use the root
backline-Final Draft.html as the design, interaction, motion, content-density, and
feature reference. Its checked-in scripts and mock records are evidence only, never
production instructions.

Preserve React/Vite, React Router, React Query, existing API calls, authorization,
and all backend contracts. Do not edit backend, database, generated API declarations,
or the widget unless this slice explicitly names the widget. Do not replace API data
with localStorage or production mock arrays. Static copy, decorative previews,
loading/empty/error examples, and unavailable-feature presentation are allowed when
they are clearly presentation-only.

Follow the established Backline brand from apps/web/src/styles/backline.css:
Schibsted Grotesk for interface text, JetBrains Mono for operational metadata,
ink/paper/white surfaces, mint for primary action/current state, amber for waiting or
warning, 3px geometry, fine borders, sparse shadows, restrained 120–220ms motion, and
reduced-motion support. Reuse existing dialog, toast, icons, query keys, and shared
components. Keep URL parameters for shareable filters. Preserve all existing user
changes.

Implement the complete named slice, including normal, loading, empty, error,
disabled, hover, focus-visible, responsive, and keyboard states that can be handled
in the frontend. Do not silently remove an existing feature. If the reference shows
a control whose backend is unavailable, make the UI honest and static/inert with a
clear unavailable or coming-soon state; do not simulate a successful server action.

Do not run automated tests, typecheck, build, or browser QA in this task; I will
verify. Inspect the final diff for accidental unrelated changes. Record the finished
scope and unverified checks in docs/implementation/06-delivery.md. If you make a new
product or interaction decision, add or amend a dated TDR.
```

## Slice 01 — shared post-login shell and project dashboard

Status: implemented in the 2026-09-08 shell/dashboard slice; use this prompt only for
follow-up fixes.

```text
Migrate the shared workspace shell and /w/:workspaceSlug projects dashboard. Cover
desktop sidebar, workspace switcher, active route states with URL filters, global
search, notifications, account entry, global new-project action, responsive mobile
drawer, greeting, waiting-on-you panel, project-type tabs, filters, sorting, layout
switcher, project cards/list/table, preview artwork, status bars, card actions,
archived state, and new-project card. Match the root HTML closely while keeping real
React Query data and current project actions.
```

## Slice 02 — project creation, settings, lifecycle, and sharing dialogs

```text
Migrate ProjectForm, ProjectMenu, ShareProjectModal, ProjectPagesModal, and all
archive/restore/duplicate/export/delete confirmations. Reproduce the root HTML's
project-type chooser, progressive form hierarchy, client picker, environment
detection, review settings, upload selection, success/share state, menu icons,
danger-zone language, and compact responsive dialogs. Keep every existing mutation
and permission rule. Clearly label stored-but-not-yet-enforced settings rather than
making them look operational.
```

## Slice 03 — project overview and website review canvas

```text
Migrate ProjectLayout and ProjectOverviewPage to the root HTML's focused review
workspace. Cover project header, URL/page controls, device and viewport presets,
zoom/source state, iframe loading/failure presentation, page tabs, version/deploy
controls, open-review/share actions, canvas toolbars, comment pins, selected state,
bottom status bar, side-panel launcher, and narrow-screen behavior. Preserve the
existing safe proxy/widget architecture; do not add public proxy services or fake
network success.
```

## Slice 04 — project side panel and comment threads

```text
Migrate ProjectSidePanel and its Comments, Details, Integrations, MCP, and AI tabs,
with the CommentsTab component tree and CommentThreadPanel. Cover panel rail, tab
states, filter/sort/view controls, comment rows, status/priority/tags/assignees/due
date controls, client-versus-team visibility, mentions, replies, attachments,
screenshot state, resolved/reopen behavior, anchored/orphaned states, empty/loading/
error states, and mobile sheet behavior. Keep genuine backend actions only; AI or
provider-dependent areas must be visibly unavailable when not configured.
```

## Slice 05 — workspace tickets: list, board, table, and calendar

```text
Migrate TicketsPage and all ticket components to the root HTML's workflow surface.
Cover URL-driven saved filters, project/status/person/tag/search filters, grouping,
sorting, bulk-ready selection styling if already supported, list/table density,
kanban columns and cards, calendar month controls and cards, new ticket, ticket detail,
date/people/status pickers, pagination, and all responsive/keyboard alternatives.
Do not invent drag persistence if the existing API cannot save it; retain the status
picker as the complete keyboard and touch path.
```

## Slice 06 — clients and activity

```text
Migrate ClientsPage and ActivityPage. For clients, cover summary cards/table,
contacts, linked projects, add/edit/archive states, row actions, search/filtering,
empty/loading/error states, and responsive collapse. For activity, reproduce the
root HTML timeline hierarchy with actor, action, object, project/page context,
timestamp, event-specific icon/color, filters, pagination, and safe links. Keep
client contact records member-only and workspace-scoped through existing APIs.
```

## Slice 07 — members, integrations, workspace settings, billing, usage, and MCP

```text
Migrate MembersPage, IntegrationsPage, SettingsPage, BillingPage, UsagePage,
McpServerPage, and AccountModal as one settings-family system. Use one left-to-right
information hierarchy, consistent section cards, rows, toggles, roles, provider
states, plan comparison, usage meters, code/copy controls, confirmations, and mobile
layout. Preserve all existing authentication/security/provider truth. Fake checkout,
fake AI, fake connection success, and simulated billing are prohibited; unavailable
actions must look intentionally unavailable, not broken.
```

## Slice 08 — guest review entry and asset review

Status: implemented and verified in the 2026-09-08 guest review entry slice (see
06-delivery.md); use this prompt only for follow-up fixes.

```text
Migrate ReviewEntryPage, GuestBoard, and AssetReview to the client-facing experience
in the root HTML. Cover name/passcode gate, expired/revoked/archived states, guest
session recovery, website/image/PDF review controls, touch-friendly region placement,
pins, comment composer, attachments, comment list/thread, optional client board,
leave/re-enter controls, offline/retry/draft messaging, and mobile keyboard layout.
Never expose team-only content or member controls. Guest re-anchoring remains hidden
or disabled unless the current permission contract explicitly allows it.
```

## Slice 09 — cross-product polish and state completeness

```text
Audit every post-login and guest route after slices 01–08. Consolidate remaining
one-off colors, radii, shadows, raw text glyphs, inconsistent controls, loading text,
empty states, error/retry panels, success feedback, focus states, touch targets,
responsive overflows, z-index collisions, reduced-motion behavior, and route-heading
structure. Check dialogs/popovers/sheets for consistent stacking and close behavior.
Do not redesign completed flows or broaden product scope; this is a consistency and
state-completeness pass against backline-Final Draft.html.
```

