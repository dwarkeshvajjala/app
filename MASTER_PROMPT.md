# Backline QA Tool — Master Production-Readiness Prompt

Paste this entire file as one prompt into a new Claude Code session in this repo (`F:\qa tool\app`). It covers every issue the user raised plus additional issues found via direct code audit (file/line cited). Work through the parts in order — do not skip the "Already fixed / verify first" notes, they prevent redoing work or building duplicate features.

---

## 0. Already fixed — verify only

`apps/web/src/app/layout/WorkspaceLayout.tsx` line 31 used `useRef` but the file only imported `useCallback, useEffect, useState` from "react" — a `ReferenceError` on every authenticated page (AccountButton renders unconditionally in the topbar). **This has already been fixed** (import updated to include `useRef`). Just run the app once and confirm no console error on load before touching anything else.

---

## 1. Console error explained (no code change needed)

`POST https://gator.volces.com/list net::ERR_NAME_NOT_RESOLVED` does **not** appear anywhere in this codebase (confirmed via full-repo grep). `content.js:225` in the stack is the tell — this is a **browser extension** (a Volcengine/Doubao-related extension, likely an ad-blocker or translation tool) making its own network call, unrelated to this app. No fix needed here; if it's distracting, reproduce in an incognito window with extensions disabled to confirm it disappears.

---

## 2. Critical dark-mode / visual bugs (fix first — these are concrete, file-cited)

1. **Project card artwork is unreadable in dark mode.** `apps/web/src/features/projects/ProjectsPage.tsx` lines 78-144 (`ProjectArtwork` component) hardcodes light-only SVG fills (`#fff`, `#CDD2CC`, `#C5CBC4`, `#D9DDD8`, `#E1E5E8`, `#E9EDEA`, `#D7DDD8`, `#C9CECA`) for the website/image/PDF preview mockups shown on every project card (this is the `.bl-project-art` / `.bl-project-art-website` element the user pointed at in issue #1). There is no `:root.dark .bl-project-art` override anywhere in `backline.css`. Result: every card shows a bright white/light-gray rectangle against a dark card in dark mode — this is also the source of user-reported issue (a) "dark icons visible in white mode / wrong icon colors." Add a dark-mode palette for this SVG (swap the hardcoded fills for CSS custom properties that flip via `:root.dark`), and see Part 3 below for replacing this generic mockup with a real hero image built from the project's actual URL.

2. **`.bl-count` badge (issue b) has fragile, duplicated CSS, not a real dark-mode contrast bug.** Base rule at `backline.css:66`. A second, unscoped `.bl-count{...}` rule at `backline.css:1397` (plus `.bl-nav>a.is-on .bl-count` at `backline.css:1395`) silently overrides it in both themes because of equal specificity + later cascade order — not a clean `:root.dark .bl-count` override. Computed contrast is actually fine (light ≈5.2:1, dark ≈7.8:1, both pass WCAG AA), so if it still reads as invisible to the user, the actual bug is a rendering issue (e.g. `border-radius`/`padding`/`margin-left` from line 66 only survive because line 1397 doesn't redeclare them — fragile, easy to break). **Fix properly:** delete the duplicate at line 1397, merge it into a single `.bl-count` rule plus one explicit `:root.dark .bl-count` override, so there's one source of truth.

3. **`.bl-workspace` / `.bl-mark` (the brand logo + workspace name button, issue g) is defined FOUR times** in `backline.css` with conflicting values that override each other via cascade order alone: line 62 (`padding:18px 16px`), lines 656-657, line 808 (inside a `@media(max-width:760px)` block), and lines 1387-1388 (the one that actually wins, giving `padding:10px`, `margin:10px 10px 4px`, a real hover/expanded border). It IS a real `<button>` with `aria-haspopup`/`aria-expanded` (`apps/web/src/app/layout/DashboardSidebar.tsx:41-52`) — so the "no click functionality" complaint is about *visual* affordance, not missing behavior. **Fix:** delete the three dead/overridden `.bl-workspace`/`.bl-mark` blocks (lines 62-65ish, 656-657, 808), keep only the version at 1387-1389, and deliberately design its padding/hover/active state so it visually reads as clickable (cursor, hover background, subtle border) — the current "wins by cascade accident" state works but is one edit away from silently breaking again.

4. **Hardcoded non-token colors that will misrender in dark mode:**
   - `apps/web/src/features/activity/ActivityPage.tsx:18-22,26` — `EVENT_META` hardcodes hex colors (`#5B7FA6`, `#0A6B4B`, `#C2542E`, `#8E6BAE`, `#B08A1E`, fallback `#62665F`) for activity icon badges. Replace with CSS variables that flip in dark mode.
   - `apps/web/src/features/activity/ActivityPage.tsx:88` — `style={{ color: '#fff' }}` should be `var(--bl-invert-fg)`.
   - `apps/web/src/features/auth/LoginPage.tsx:247` — third decorative "pin" marker hardcodes `background:'#5B7FA6', color:'#fff'` while its two siblings (lines 245-246) correctly use `var(--mint)`/`var(--amber)`. Make it consistent.
   - `apps/web/src/features/projects/panel/comments/CommentRow.tsx:190` — "Delete thread" menu item hardcodes `color:"#A8401F"` instead of `var(--bl-error)` (which correctly lightens to `#FF9A7C` in dark mode).
   - `apps/web/src/features/projects/panel/McpTab.tsx:5` — "Cursor" brand swatch color `#14141A` is near-black; on a dark-mode card (`--bl-surface` ≈ `#171D19`) it's nearly invisible. Add a min-lightness fallback or dark-mode-specific swatch color for near-black brand colors.

5. **Font-family declared three different ways for `body`** (drift risk, not a visible bug today, but fix it now while touching CSS): `apps/web/src/index.css:13-14` and `apps/web/src/styles/backline.css:59` both hardcode the literal string `'Inter',Helvetica,Arial,sans-serif` instead of `var(--sans)`, while `backline.css:632` correctly uses the token. Also `.bl-input` at `backline.css:85` uses `font:13px 'Inter',sans-serif` (drops the `Helvetica,Arial` fallback chain). Consolidate all four to reference `var(--sans)`.

---

## 3. Typography & 3–4 color brand system (user issue f, h, i)

Pick ONE typography approach and apply consistently — recommend keeping the existing stack (Inter for UI text, JetBrains Mono for numeric/technical labels like counts, timestamps, IDs) since it's already Google-Fonts-standard and works well for international/multi-region readability. Do NOT introduce a third font family.

Define an explicit type scale and apply it everywhere (audit every hardcoded `font-size` in `.tsx`/`.css` files against this and consolidate):
```
H1 (page title):     28px / 700 / letter-spacing -0.03em
H2 (section title):  18px / 600 / letter-spacing -0.01em
H3:                  16px / 600
Body:                14px / 400 / line-height 1.45
Body small:          12px / 400 / line-height 1.4
UI label:            12px / 600
Mono/numeric (counts, timestamps, IDs): 10-11px / 500, var(--mono)
```
Minimum font size anywhere in the product: 10px (mono labels only) — nothing below 12px for actual reading content. Fix any component under this floor (audit needed — search for `font-size:9`, `font-size:8` literals and any 9px/9.5px Tailwind text classes).

Color palette — lock to exactly this set per theme (already mostly defined in `backline.css:1-60` and `:root.dark` at line ~1360 — the work here is auditing that every component actually uses these tokens instead of one-off hex values found in Part 2 item 4):
- **Ink** (primary text) — `--ink`
- **Muted** (secondary/tertiary text) — `--ink-2`/`--ink-3`/`--ink-4` collapsed conceptually to "muted"
- **Surface** (paper/card backgrounds) — `--paper`, `--surface`
- **Accent** — `--mint` (primary actions/success), `--amber` (warning/secondary), plus the existing `--bl-error` for destructive

Do this as a real audit: grep every `.tsx`/`.css` file for literal hex colors (`#[0-9A-Fa-f]{3,6}`) outside of `backline.css`'s own token definitions, and replace each with the matching CSS variable. Produce a short list of what you changed.

---

## 4. Layout & structural fixes (user issues c, d)

1. **Remove the `.bl-hatch` striped divider** (`backline.css:116` in the reference file pattern / search `.bl-hatch` and `.hatch` in `apps/web/src/styles/backline.css` and any component using it) — delete the element and its CSS, it's pure visual clutter with no function.

2. **Remove the "workspace / page-name" breadcrumb** the user called "hi / page name" — it's real code at `apps/web/src/app/layout/WorkspaceLayout.tsx:189`:
   ```jsx
   {location.pathname !== `/w/${workspace.slug}` && <nav aria-label="Breadcrumb" className="bl-mono"><Link to={`/w/${workspace.slug}`}>{workspace.name}</Link> / <span aria-current="page">{location.pathname.split("/").pop()?.replace(/-/g, " ")}</span></nav>}
   ```
   Remove this `<nav>` entirely (or replace with something more deliberate later — a real breadcrumb trail — but the user explicitly wants it gone for now). Do NOT confuse this with the large `<h1>{headline}</h1>` "Good morning, {firstName}" dashboard greeting in `ProjectsPage.tsx:227` — that one stays.

3. **Increase content width / reduce excessive side margins.** `.bl-wrap` (`backline.css:71`) currently caps at `max-width:1560px` — widen it (e.g. 1760-1800px, or use a percentage-based max-width like `min(1800px, 96vw)`) so large desktop screens aren't wasting horizontal space. Re-check the `@media(min-width:1650px)` project-grid override at `backline.css:87` still looks right at the new width.

---

## 5. Static / dummy data — full removal list

Full inventory (confirmed via direct code read, not guesswork). For each, either wire to a real backend endpoint or, if no endpoint exists yet, replace with a loading skeleton / empty state — never a fallback to fake data:

1. `apps/web/src/features/projects/ProjectsPage.tsx` — `PREVIEW_PALETTES` (4 hardcoded color schemes, deterministically hashed per project ID) — this is decorative and can stay UNLESS it's meant to represent real per-project branding; if so, needs a backend field.
2. `apps/web/src/features/projects/footer/BrowserMenu.tsx` — hardcoded browser list (Chrome 125, Safari 17.4, Firefox 126, Edge 124) — **NOTE: this feature already exists in the frontend**, contradicting the assumption it was "missing" (see Part 6, it's not a net-new build, it's a persistence gap).
3. `apps/web/src/features/projects/footer/ViewportMenu.tsx` — hardcoded device/viewport list — fine to keep static (these are just preset breakpoints, not "your data"), but confirm with product owner.
4. `apps/web/src/features/projects/panel/IntegrationsTab.tsx:5-11` — `AVAILABLE_INTEGRATIONS` (Slack/Jira/Asana/Trello/ClickUp) rendered as live-looking toggle switches that only mutate local `useState` — nothing persists, no real connection state. Either wire to the real workspace Integrations settings backend or clearly label as "Preview" / remove the interactive toggle affordance so it doesn't look functional when it isn't.
5. `apps/web/src/features/projects/panel/McpTab.tsx:3-8` — `CONNECTORS` array (Claude/Cursor/Codex/Antigravity) — "Connect" buttons only fire a toast, no real OAuth. Same treatment as #4.
6. `apps/web/src/features/workspaces/McpServerPage.tsx:5-22` — `AGENTS` array, same pattern as #5.

Ruled out as NOT static/fake (verified real, backend-backed): `ActivityPage.tsx` `FILTERS` (maps to real backend filtering in `backend/app/modules/dashboard/repository.py:259-260`), AI/email-digest preferences in `AccountModal.tsx` (backed by `backend/app/modules/notifications/digest.py`).

---

## 6. Browser selection — already exists, don't rebuild; close the persistence gap

**Correction to any earlier assumption:** the browser-selection dropdown from the reference `Backline-Final Draft.html` (the `pop-anchor`/`brBtn`/`brPop` pattern with Chrome/Safari/Firefox/Edge) is **already implemented** at `apps/web/src/features/projects/footer/BrowserMenu.tsx`, and the selection is currently stored in the URL search param `?browser=Chrome`. **Do not recreate this component.**

What's actually missing (verify against current backend code first, it may partially exist):
1. Persist the selected browser with each comment when it's created — check `backend/app/modules/` for the comments module and confirm whether a `browser_selected` (or similar) column/field exists on the comment model/schema already. If not: add it (migration + schema + service layer), and update the frontend comment-submission call in `apps/web/src/features/board/CommentThreadPanel.tsx` to send the current `BrowserMenu` selection along with the comment payload.
2. Return the stored browser value in comment API responses so it displays on existing comments (not just the currently-selected dropdown state).
3. Confirm the CSS/HTML class names in your own `BrowserMenu.tsx` match the design/positioning intent from the reference file (it should sit at the bottom near the comment composer, per the user's reference markup) — verify visually, don't blindly restyle.

---

## 7. Session management & logout (user issue #3)

1. Locate the actual logout endpoint(s) in `backend/app/modules/auth/router.py` and `service.py`. Confirm whether a "logout everywhere" / "revoke all sessions" endpoint exists at all — if not, add one (invalidate every session/token row for the user, not just the current one).
2. In `apps/web/src/features/auth/AccountModal.tsx` (has the Security & Sessions section listing active sessions with OS/browser/IP/last-active and per-session or bulk revoke) — trace what the "revoke all" button actually calls, confirm it hits the correct endpoint, and confirm the UI shows success/error state and forces a real logout+redirect to `/login` afterward (not just a local state update that leaves the user "logged in" in the current tab while other sessions are dead).
3. Reproduce the reported bug directly: log in on two sessions/browsers, click "logout everywhere" on session A, confirm session B is actually invalidated (refresh should force it to `/login`), and confirm that logging back in does NOT show stale cached data from before logout (check React Query cache isn't persisted across the logout boundary — likely needs `queryClient.clear()` on logout).
4. Nice-to-have per user request: restructure the profile popover to a clean 3-option menu — Logout, Settings (with Privacy sub-section), Change Profile Photo — if it isn't already close to this shape.

---

## 8. Responsive gap — ticket board has no mobile layout

`.bl-board` (`backline.css:84`, used by `apps/web/src/features/tickets/components/TicketBoard.tsx:24`) is `grid-template-columns:repeat(6,minmax(220px,1fr))` with only `overflow-x:auto` — confirmed via full grep there is **no** `@media(max-width:...)` override for `.bl-board` anywhere in the stylesheet, unlike every other major layout region (rail, topbar, wrap, project grid, forms all have breakpoint overrides down to 430-460px). On any viewport under ~1320px the board is a permanently wide horizontal-scroll strip. Add a responsive treatment: stack-and-scroll-per-column, or a mobile list/accordion view of the same statuses, matching the pattern already used by `.bl-tickets.list thead{display:none}` for the ticket table's own mobile fallback.

---

## 9. Toast / "red box that flashes and vanishes"

Found the toast system at `apps/web/src/components/Toast.tsx`. Auto-dismiss timings (`Toast.tsx:25-30`): success 4000ms, warning 6000ms, **error 8000ms**, progress = manual only. No toast fires unconditionally on page mount anywhere in the codebase (verified — every `toast(..., "error")` call is inside a `useMutation` `onError`, meaning it only fires from an actual user-triggered action that failed, e.g. `ClientsPage.tsx:50`, `ProjectMenu.tsx:72`, `ShareLinksPage.tsx:59,71`, `SettingsPage.tsx:28`, `IntegrationsPage.tsx:51,72`).

Given 8 seconds is not actually "blink of an eye," reproduce the user's report directly: watch the Network tab while navigating normally and see which specific action triggers it (likely candidates: a background React Query refetch failing silently and surfacing via one of the mutation `onError` handlers above, or a WebSocket reconnect blip via `useConnectionStore/useWSEvent`). Fix the root cause (the failing request/silent race), don't just hide the toast.

---

## 10. Feature gaps vs. reference file (beyond browser selection) — plan only, do not fake

Confirmed genuinely incomplete (currently honest "Coming soon" placeholders, not fake data — keep them honest, just plan the real build):
- **Billing/plans**: `apps/web/src/features/workspaces/BillingPage.tsx:16-52` shows only the stored plan label + "coming soon" note. Reference file has a full 4-tier (Free/Solo/Team/Enterprise) comparison grid. Plan: pricing table component + backend plan-limits enforcement + checkout integration (Stripe or similar) — this is a separate scoped project, write a short spec, don't implement checkout now.
- **AI credits/usage**: `apps/web/src/features/ai/api.ts`, `apps/web/src/features/projects/panel/AiTab.tsx`, `apps/web/src/features/workspaces/UsagePage.tsx` have no credit-tracking concept vs. the reference's live credit counter + gating. Plan: `ai_usage`/`ai_credits` table, per-workspace monthly counter, gate AI actions when exhausted.
- **MCP/agent connectors**: `McpServerPage.tsx`, `McpTab.tsx` are UI-only, no real OAuth. Plan real OAuth flow per connector (Claude/Cursor/Codex/Antigravity) as a follow-up scoped project — see Part 11 for the AI/MCP integration plan.
- Missing `Cmd/Ctrl+Z` undo shortcut present in the reference file (`backline-Final Draft.html:4210`) with no current equivalent — low priority, note for backlog.

Everything else in the reference file (notification bell, global search popover, workspace switcher popover, ticket board, ticket calendar, activity feed, settings page) already exists and is functionally wired — no gap there.

---

## 11. Backend completion plan (write the plan + stub endpoints; full build is a separate pass)

Produce (as markdown, in `backend/docs/` or similar) a concrete endpoint + schema plan covering:
1. **Sessions module** — `POST /auth/logout`, `POST /auth/logout-all`, `GET /auth/sessions` (confirm which of these already exist vs. need building per Part 7).
2. **Comments browser field** — migration to add `browser_selected` (or confirm existing) to the comments table/schema per Part 6.
3. **Integrations backend** — real persistence layer for Slack/Jira/Asana/Trello/ClickUp connection state (replacing the fake toggles in Part 5 item 4) — OAuth handshake, token storage (encrypted), connection status endpoint.
4. **AI credits** — schema for `ai_usage`/`ai_credits` per Part 10.
5. For every endpoint: require auth, proper HTTP status codes, input validation, OpenAPI docs, and at least one test (happy path + one failure path).

Do NOT implement all of this in one pass — produce the plan and stub the highest-priority pieces (sessions + comments browser field), since those unblock frontend fixes already in progress above.

---

## 12. Slack + AI/MCP integration architecture (plan document, not full build)

Write an architecture doc covering:
- **Slack**: outbound alerts only for now (comment created, ticket status changed, project updated) — OAuth authorize flow, workspace/channel storage, webhook delivery with retry, per-project/per-user notification opt-out settings.
- **AI MCP tool**: pick a provider (default recommendation: Claude via the Claude API/Agent SDK, since this is an Anthropic-tooled codebase already — do NOT default to OpenAI/Gemini without the user confirming) for: generating a detailed implementation prompt from a QA comment/ticket description, and returning a structured implementation plan. Define the request/response schema and where in the UI it surfaces (e.g. a "Generate Prompt" action on a comment/ticket).
- **General webhook event system**: event log table + delivery table with retry/backoff, user-configurable custom webhook URLs.

Database schema sketch for all three (table names, key columns) belongs in this doc. Actual implementation is a later, separately-scoped pass.

---

## Execution order

1. Part 0 (verify the useRef fix) — 2 min
2. Part 2 (critical dark-mode/CSS bugs) — highest visible impact
3. Part 4 (layout: remove hatch, remove breadcrumb, widen content) — quick wins
4. Part 3 (typography/color audit) — do alongside Part 2 since you're already in the CSS
5. Part 5 (static data) — cross-reference against Part 6/7 before "fixing" BrowserMenu/IntegrationsTab, since some of it needs backend work first, not just frontend deletion
6. Part 7 (session/logout) — reproduce the bug first, then fix root cause
7. Part 6 (browser-selection persistence) — small, scoped backend addition
8. Part 8 (ticket board responsive) — CSS only
9. Part 9 (toast root cause) — investigate live, don't just adjust timing
10. Parts 10-12 (plans/architecture docs) — do last, lowest urgency for the "few days" frontend deadline

## Definition of done for this pass

- [ ] No console errors from the app itself (extension noise from gator.volces.com is expected/ignorable)
- [ ] Every project card, badge, icon, and menu item legible in both light and dark mode (spot-check with a screenshot of each)
- [ ] `.bl-hatch` gone, breadcrumb gone, content width visibly wider on a 1440px+ screen
- [ ] Zero duplicate/dead CSS rules for `.bl-workspace`, `.bl-mark`, `.bl-count`
- [ ] Logout-everywhere verified end-to-end across two real sessions
- [ ] Ticket board usable (not just horizontally scrollable) under 480px width
- [ ] Static-data list from Part 5 either wired to real data or explicitly, visibly marked "Preview" — nothing pretends to be live when it isn't
- [ ] Backend plan doc + Slack/AI architecture doc exist even if not yet built
