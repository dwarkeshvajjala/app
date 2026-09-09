# 16 - Dashboard & Reviewer Experience

## 16.1 Agency Dashboard Screens

**Workspace Home** (`/w/:slug`) - project list as cards (name, last activity, open comment count), "New project" CTA, empty state teaches by doing per F7 (a seeded sample project with three example comments for brand-new workspaces).

**Project Overview** (`/w/:slug/p/:id`) - pages registered under the project, per-page open/resolved comment counts, share link management entry point, "install SDK" instructions (snippet snippet-copy, or proxy-mode confirmation).

**Share Links** (`.../share-links`) - table of links (mode, expiry, passcode on/off, revoked state), create/revoke actions, copy-link button with a QR code for in-person client review sessions.

**Board - Kanban** (`.../board`) - columns: To do / In progress / Resolved / Won't fix. Cards show: screenshot thumbnail, truncated body, layer badge, assignee avatar, device icon, recovery-status indicator if not `ok`. Filters (page, assignee, status, layer, device) live directly in URL search parameters for shareability and browser-history correctness; see TDR-0005.

**Board - List** - same data, dense table view; sortable by created date, status, assignee. Bulk select -> bulk status change (drives the "50 comments in 10 minutes" metric).

**Page Detail** (`.../pages/:pageId`) - a live (iframed, sandboxed) view of the page with pins overlaid at their anchor positions, side panel with the comment thread for the pin currently selected. This is where a PM would resolve ambiguity that a plain list can't ("which pin is this exact thread about") - clicking a comment in the list highlights its pin, and vice versa.

**Members** - list with role badges, invite flow (email), role change (`admin`+ only per `13-Authentication.md` §13.5), pending invite state.

**Activity** - a human-readable feed generated from the `events` collection (`11-Database.md` §11.13) - "Jamie moved 'Fix header padding' to Resolved," "Client link revoked by Alex." This is the audit trail made legible, not a separate data source.

**Integrations** - connect/disconnect Slack (webhook URL entry + test-send button), ClickUp/Trello (OAuth connect flow), per-project scoping toggle.

**Notifications** (in-app) - bell icon + dropdown, backed by `notification.new` WS events and a `GET /notifications` paginated endpoint; mark-as-read.

**Settings** - workspace name/slug, member default role for new invites, danger zone (archive workspace - soft, not a hard delete, in MVP).

**Billing** (incremental, not built pre-MVP, but the settings nav slot is reserved) - placeholder only.

**Analytics** (incremental) - same: reserved nav slot, no implementation pre-MVP.

## 16.2 Reviewer Experience (the Review SDK's on-page UI)

**First visit:** single tooltip pointing at the pin-drop affordance ("Tap anywhere to leave feedback"), dismissed permanently after the first successful comment on that device (stored with the guest session, not globally - a new share link visit still gets the tooltip once).

**Pin placement:** tap/click anywhere -> a pin drops at that exact point -> a lightweight composer opens (name pre-filled from the guest session after first use, text field, post button). No modal takeover of the whole screen - the composer is a small anchored popover so the reviewer keeps visual context of what they're commenting on.

**Thread view:** tapping an existing pin opens its thread (client-visible messages only, per the server-enforced layer filter) - replies, no ability to see or infer that team-only discussion exists (not even a "3 more messages" count that would leak team-layer activity, per F3's strict acceptance criterion).

**Device-specific behavior:**
- **Phone (portrait/landscape):** composer is a bottom sheet, not a floating popover (avoids being clipped by the viewport edge); pin-drop uses a slightly larger touch target (44px minimum, per accessibility touch-target guidance) than the desktop pointer target.
- **Tablet:** hybrid - popover style like desktop but with touch-sized controls.
- **Desktop:** popover anchored near the click point, keyboard shortcuts available (see below).

**Keyboard shortcuts (desktop reviewer + dashboard):** `C` - new comment at last-focused element, `Esc` - close composer/thread, `Enter`/`Cmd+Enter` - submit, `J`/`K` - navigate between pins on the current page.

**Pin recovery display:** pins with `recovery_status: low_confidence` render with an amber outline and a small tooltip on hover ("This comment's original location may have changed"); `orphaned` pins render dimmed with a distinct icon and collect in a small "Needs attention" tray rather than cluttering the live page overlay indefinitely (P4/P5 made concrete in UI).
