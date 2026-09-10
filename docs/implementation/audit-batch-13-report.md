# Audit Batch 13 — UI/UX/Brand Consistency Sweep

**Date:** 2026-09-10. Follow-on to batch 10/11/12 and the same-session dark-mode contrast
fix (see `docs/spec/15-Design-System.md` §15.3/§15.5, `apps/web/src/styles/backline.css`'s
`:root.dark` block). That fix made the *mechanism* correct (one `.dark`-class trigger, one
token system); this batch is a broader UI/UX/brand-consistency pass across popups, buttons,
secondary pages, forms, and boards. Scope was "everything, especially the light theme, every
popup and button, any small UI" per the user's request. Four parallel audits were run
(dialogs, buttons/badges, secondary pages, forms/boards); this doc consolidates all findings.
**Session ended on explicit "push now" from the user before the fixes below were applied** —
this file is the resume point.

## Fixed this session (already committed)

- `apps/web/src/components/ConfirmDialog.tsx` — destructive variant now uses `.bl-button.danger`
  (was hardcoded `bg-red-600`); Cancel button now also disabled while `pending`.
- `apps/web/src/features/auth/AccountModal.tsx` — "Save changes" now `.bl-button.mint` (was bare
  `.bl-button`, didn't match every other primary CTA); added a "Try again" retry on session-list
  load failure; "Sign out this session" now has a pending/disabled guard + label.
- `apps/web/src/features/workspaces/NewProjectModal.tsx` — full rewrite onto the shared `Dialog`
  component + `.bl-project-form`/`.bl-form-section`/`.bl-input`/`.bl-dialog-actions`/`.bl-error`
  (was a hand-rolled overlay with hardcoded `dark:bg-[#151515]`, no focus trap, no Cancel button,
  no submit-guard against closing mid-request).
- `apps/web/src/features/workspaces/NewProjectMenu.tsx` — popover now uses `.bl-dropdown-pop`/
  `.bl-dropdown-item` (was hardcoded hex/opacity colors); added Escape-to-close, click-outside,
  and `role="menu"`/`role="menuitem"` (hover-to-open behavior preserved, per the file's own
  comment about matching a reference design).

## NOT yet fixed — prioritized findings for next session

### P0 — confirmed regressions / high-visibility breaks

1. **`.bl-button:hover` and `.bl-button.mint:hover` go text-on-same-color in dark mode.**
   `backline.css`'s `.bl-button{background:var(--bl-ink);color:var(--bl-invert-fg)}` is correct
   at rest, but `:hover{background:#30342F}` (and `.mint:hover{background:#57D3A4}`) are
   hardcoded hex that only override `background`, never `color` — so in dark mode (where
   `--bl-ink`/`--mint` flip light-ish), hovering the button flips its background back toward a
   fixed dark/bright tone while the text stays paired for the *base* state. Computed contrast
   ~1.5-1.7:1 (needs 4.5:1). Hits every primary button app-wide, including the just-rewritten
   `NewProjectModal.tsx`'s "Create project" button. **Fix approach:** give both hover rules an
   explicit `.dark` counterpart (e.g. `.dark .bl-button:hover{background:#DADBD7}`, `.dark
   .bl-button.mint:hover{background:#0F8058}`) rather than a color-mix — this codebase's
   convention is explicit per-theme values, not computed ones.
2. **`ClientsPage.tsx`'s `.bl-chip` text is hardcoded `#3A3D3A`, no dark override** — against the
   correctly-flipped `--bl-paper` dark background this is ~1.8:1. Every project-association chip
   in the Clients table becomes nearly illegible in dark mode. Highest end-user-visible bug found.
3. **`DatePicker.tsx:164`'s inline `background:'transparent'` on the grid-cell button defeats the
   very theming rules this file was just rewritten to add** (`backline.css`'s
   `.bl-datepicker-grid [role=gridcell][aria-selected="true"]`/`:hover` rules never fire because
   inline style wins). Selected-day highlight and hover are currently invisible in both themes.
   Fix: drop the inline `background`/`border` from that button now that the CSS rule exists.
4. **Danger/error/status "variant" rules recur ~5x as hardcoded-hex-with-no-dark-override**, while
   sibling rules in the same file correctly use tokens: `.bl-toast.success/error/warning/progress`,
   `.bl-dropdown-item.danger`, `.bl-icon-button.danger`, `.bl-due-chip.is-late` (vs. its sibling
   `.is-soon` which does it right), `.bl-required` (vs. sibling `.bl-optional` which does it
   right), `.lg-f.bad`/`.bl-custom-viewport[aria-invalid]` (already fixed this session — good
   reference for the pattern: keep bg fixed-light, add an explicit fixed dark `color`, don't
   inherit theme-reactive ink). `--bl-error`'s dark value (`#FF8866`) already exists and is
   unused by any of these.
5. **`.bl-ticket-title:hover{color:#0A6B4B}`** (hardcoded, not `var(--mint-deep)`) — ~2.8:1 against
   dark-mode `--bl-surface`. Affects `TicketRow`/`TicketTable`/`GuestBoard` too (not individually
   audited but same class).

### P1 — systemic: the Tailwind `{DEFAULT, dark}` token pattern is inert

`tailwind.config.js`'s custom colors (`bg-surface`, `bg-canvas`, `text-primary`, `text-muted`,
`accent-primary`) are defined as `{DEFAULT, dark}` pairs, but Tailwind only turns that into two
*static* utilities (`bg-accent-primary`, `bg-accent-primary-dark`) — it does **not** wire
`bg-accent-primary` to respond to the `.dark` class. That needs an explicit `dark:bg-accent-primary-dark`
on every usage, and a repo-wide grep found **zero** such usages anywhere. Concretely dead/frozen
in light-mode colors regardless of theme:
- `packages/ui/src/Button.tsx`, `Badge.tsx`, `Avatar.tsx` — the whole shared UI kit.
- `apps/web/src/features/board/components/KanbanBoard.tsx`, `BoardHeader.tsx`, `ListTable.tsx` —
  entirely Tailwind-styled, no `.bl-*` class anywhere; this makes the Board feature look like a
  visually different sub-app next to `TicketBoard.tsx`/`.bl-board` (different radius,
  `border-black/10`/`white/10` hairlines instead of `--line`, no `.bl-select`/`.bl-segment`
  reuse — the same `&lt;select&gt;` className is copy-pasted 5x in `BoardHeader.tsx` alone, no
  `.bl-table` row-hover in `ListTable.tsx`, no `StatusBadge` color-coding in `KanbanBoard.tsx`
  despite `ListTable.tsx` correctly using it for the same data).
- `NewProjectMenu.tsx`'s remaining `Button`/chevron (the popover itself was fixed this session,
  the trigger button wasn't in scope for that fix).
- `ProjectCard.tsx`'s literal `dark:bg-[#151515]`-style arbitrary values sidestep this same
  problem a different way (already reconciled to the canonical hex this session, but still not
  routed through the token system).

**Fix approaches to weigh:** (a) wire an actual `dark:` variant everywhere these tokens are used
(mechanical but a lot of call sites), or (b) migrate these components onto the `--bl-*`
CSS-variable system like the rest of the app (more consistent, larger diff), or (c) add a
Tailwind plugin that maps `bg-accent-primary` through a CSS variable so both class systems read
from one source of truth (least call-site churn, most architecture change). Needs a decision,
not just a patch.

### P2 — palette drift (two different "shipped truths")

`packages/ui/src/workflow.ts`'s `STATUS_COLORS` (used for ticket/comment status dots/selects
across `TicketBoard.tsx`, `TicketCalendar.tsx`, `ProjectsPage.tsx`, `GuestBoard.tsx`,
`AssetReview.tsx`, `DashboardSidebar.tsx`) diverges from `tailwind.config.js`'s spec-matching
`status-*` tokens (used by `Badge.tsx`'s `StatusBadge`) on 3 of 4 documented statuses (todo,
in_progress, resolved all differ; only wont_fix agrees). **Concrete visible collision:**
`AssetReview.tsx` uses both for the same comment in the same view — pin markers via
`STATUS_COLORS` (resolved → brand mint `#69DEB2`), badge via `StatusBadge` (resolved → spec green
`#22C55E`) — two different greens on screen for one status. Needs reconciling to one source
(recommend: point `STATUS_COLORS` at the spec-matching values, since those are already
WCAG-audited per `tailwind.config.js`'s own comments).

### P3 — smaller, real, lower-traffic

- `Avatar.tsx`'s amber seed color: white text on `#F59E0B` ≈ 2.15:1, theme-independent (~1 in 4
  avatars by name hash render illegibly in both themes).
- `ProjectTypePlaceholderPage.tsx` repurposes the compact `.bl-new-card` tile as a full-width
  hero (wrong component for the job — sibling empty states use `.bl-empty`), and that card's
  dashed border is two slightly different hardcoded hex values (`#B7BDB1` / `#B6BCB3`) with no
  dark override.
- `AiTab.tsx`'s "not built" placeholder reinvents layout with raw Tailwind instead of the
  `.bl-state-panel` convention its sibling `CommentsList.tsx` uses for identical content.
- `ProjectCard.tsx` hand-rolls its own project-overflow menu (raw `hover:bg-bg-canvas` items)
  duplicating `ProjectMenu.tsx`'s proper `.bl-dropdown-item` implementation — two different
  "project overflow menu" components exist.
- `TicketBoard.tsx`'s drag-and-drop wires `data-dragover`/`.bl-dragging` state but **zero** CSS
  exists for either selector — no visual drop feedback at all.
- `MembersPage.tsx` reinvents small/muted table text inline (`ClientsPage.tsx` gets the
  equivalent for free from `.bl-table td small`) — cosmetic only, not a theme bug.
- **`WorkspaceHomePage.tsx` is dead code** — `router.tsx` mounts `ProjectsPage` for the workspace
  index route, not this file. Zero live consumers found. Candidate for deletion (like
  `WorkspaceSidebar.tsx`, deleted earlier this session) once someone confirms it's truly unused
  product-wide, not just unrouted today.
- `docs/spec/15-Design-System.md:44` still lists `recovery-orphaned` as `#EF4444`, but
  `tailwind.config.js` ships the WCAG-upgraded `#B91C1C` with a comment explaining why — the doc
  row for this one token wasn't updated when the others were.

## Verification status

Typecheck (`tsc -b --noEmit`) and `vite build` were clean as of the last full run this session
(before the four audits above were read back). The fixes listed under "Fixed this session" were
typechecked but not re-built or visually verified live (backend still needs MongoDB Atlas
credentials not available in this environment — same blocker as
[[audit-batch-03-verification]] and the earlier theming-fix session, see
[[theming-dark-mode-fix]]). Re-run both before/after the next round of fixes.

## References
- [[theming-dark-mode-fix]] — the dark-mode mechanism fix this batch built on
- `docs/spec/15-Design-System.md` — token/palette source of truth (needs the `recovery-orphaned` row fixed)
- `apps/web/src/styles/backline.css` — where most of the P0/P1 CSS fixes land
