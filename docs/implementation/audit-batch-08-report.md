# Audit batch 08 report — M-16 (Tickets, board, calendar, drag/drop, deep links)

Date: 2026-09-09
Scope: M-16 (Section 5), ledger IDs FD-AUD-032..035, UX-AUD-056..060

## 0. Note on process

This batch was first implemented by another pass (uncommitted `TicketsPage.tsx` split,
`use-tickets.ts`, `DatePicker.tsx` rewrite, `TicketRow.tsx` clickable-row change, plus a
draft of this report and an unauthorized `apps/e2e/tests/tickets-page.spec.ts`) before
this session started. This report **verifies that draft against the actual code, the
ledger, and TDR-0005/TDR-0012** rather than repeating its claims — one real keyboard bug
it introduced is fixed below (§3), a scope violation is corrected (§4), and the ledger
ID mapping in its own summary was wrong (§1) even though the underlying work was mostly
sound.

## 1. Ledger ID correction

The prior draft's report body mapped FD-AUD-032/033/035 and UX-AUD-056/058/060 to
whichever item it fixed, not to what those IDs actually name in
`BACKLINE-MASTER-HTML-INTEGRATION-AUDIT.md` (section 10). Actual mapping:

| ID | Actual name | Addressed by this diff? |
|---|---|---|
| FD-AUD-032 | Ticket view modes | Yes (list/board/table/calendar, pre-existing) |
| FD-AUD-033 | Ticket filters and sorting | Yes (pre-existing, preserved through the split) |
| FD-AUD-034 | Ticket drag and drop | Yes (`TicketBoard.tsx`/`TicketCalendar.tsx`, pre-existing) |
| FD-AUD-035 | Due date picker and standalone ticket form | Yes (`DatePicker.tsx` rewrite) |
| UX-AUD-056 | Ticket view controls and consistent counts | Yes (tab counts wired to `dashboard` query) |
| UX-AUD-057 | Ticket filters, chips, and clear-all flow | Yes (pre-existing `activeFilters` chips + Clear filters) |
| UX-AUD-058 | Board drag/drop and keyboard alternative | Yes (`StatusSelect` in board cards is the keyboard equivalent) |
| UX-AUD-059 | Calendar semantics and due-date workflow | Yes (`TicketCalendar.tsx`, pre-existing) |
| UX-AUD-060 | Ticket detail deep links and not-found behavior | Yes (`?comment=<id>`, `TicketDetail`'s "not found" state) |

The M-16 section's own "Fixes" list (single status source of truth, component/hook
split, URL-owned `?comment=`, drag/drop optimistic+rollback, accessible date picker,
clickable rows) is the operative checklist — all six items are present in the diff and
verified below.

## 2. Verified correct as-is

- **Single workflow-status source of truth**: `apps/web/src/lib/workflow.ts` re-exports
  `WORKFLOW_STATUSES`/`STATUS_LABELS`/`STATUS_COLORS` from `@backline/ui`, and every
  ticket component (`TicketRow`, `TicketTable`, `TicketBoard`, `StatusSelect`,
  `TicketDetail`) imports from this one module. No separate `"To do"`/`"Not started"`
  label map remains.
- **Components/data-hook split**: `use-tickets.ts` holds all React Query fetchers
  (tickets/projects/members/dashboard), the update mutation, CSV export, URL `set()`
  helper, and grouping logic; `TicketsPage.tsx` is left as presentation only.
- **`?comment=<id>` is bidirectional**: `selected = params.get("comment")` is read fresh
  from `useSearchParams()` on every render (not seeded once into local state), so
  browser back/forward and direct navigation both open/close `TicketDetail` correctly.
  All `onOpen` call sites (`TicketBoard`, `TicketCalendar`, `TicketTable`, `TicketRow`)
  consistently call `set("comment", id)`; no stray `?ticket=` references remain (grep
  confirmed).
- **Drag/drop optimistic update + rollback + audit event**: `use-tickets.ts`'s `update`
  mutation implements `onMutate` (cancel in-flight queries, patch the cached list
  optimistically) and `onError` (restore the pre-mutation snapshot). The "audit event"
  requirement doesn't need new frontend code — `backend/app/modules/comments/service.py`
  already calls `append_event(..., type=comment_events.COMMENT_UPDATED, ...)`
  unconditionally on every `update_comment` call, which is what the drag handler's
  `update.mutate({ id, patch: { status } })` invokes. Verified directly against the
  service source, not assumed.
- **Keyboard equivalent for drag/drop**: `TicketBoard.tsx`'s cards render a native
  `<select>` (`StatusSelect`) alongside the draggable `<article>`, so status changes are
  fully reachable via keyboard/Tab without ever touching the pointer-only drag path.
- **Ticket data model still extends `comments`**: `backend/app/modules/dashboard/repository.py`'s
  `DashboardRepository.tickets` aggregates against `self.db.comments`, not a parallel
  collection — confirmed directly against source. TDR-0012's binding constraint holds.
- **Date picker timezone handling**: `DatePicker.tsx` consistently reads/writes dates via
  UTC parts (`getUTCFullYear`/`getUTCMonth`/`getUTCDate` in, `T00:00:00Z` strings out) and
  only ever uses the locally-constructed `month` state's plain `getFullYear()`/`getMonth()`
  for calendar-grid math (never for the emitted value), so there's no local-timezone
  shift in the emitted due date. Locale-aware weekday headers use
  `Intl.DateTimeFormat(navigator.language, { weekday: "narrow" })` against a known-Sunday
  anchor date (2023-01-01 is a Sunday) instead of a hardcoded `S/M/T/W/T/F/S` array.
- **Clickable rows/cells**: `TicketTable.tsx` already used plain `<button>`s per cell
  (title, project, assignees) — no row-wrapper needed there. `TicketRow.tsx` (the
  list/group view) wraps the whole row as `role="button" tabIndex={0}`, with
  `stopPropagation()` on the nested `StatusSelect`/priority `<select>`/tag chips/
  "Unassigned" button's `onClick` so those retain independent click behavior.

## 3. Bug found and fixed

**Nested interactive controls in `TicketRow.tsx` fired the row's Enter/Space handler**
(`apps/web/src/features/tickets/components/TicketRow.tsx`). The row's `onKeyDown` had no
guard on `e.target`:

```tsx
onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(ticket.id); } }}
```

`onClick` was correctly stopped from propagating on the nested `StatusSelect`, priority
`<select>`, tag chips, and "Unassigned" button — but keydown events still bubble from
those children up to the row div regardless of the click guard. Pressing Space to open
the status/priority `<select>` (or Enter/Space to activate a tag chip) while focused on
any of those controls would bubble to the row, call `e.preventDefault()` (blocking the
control's own native keyboard behavior), and open the ticket detail modal instead. This
directly broke keyboard access to the "existing StatusSelect and priority quick-edit"
inline editing the row's own comment says it was written to preserve, and regressed the
exact class of keyboard-equivalence this batch's scope required (UX-AUD-058).

**Fix**: guard the handler with `if (e.target !== e.currentTarget) return;` so Enter/Space
only opens the ticket when the row itself (not a descendant control) has focus.

## 4. Scope violation corrected

`apps/e2e/tests/tickets-page.spec.ts` (untracked, ~65 lines, Playwright) was added by the
prior pass. The batch's own binding instruction was **"Do NOT write test suites.
Implementation + verification only."** This file exercises exactly this batch's surface
(ticket creation, status select, `?comment=` URL state, date picker "Today" flow) and was
clearly written for this task, not pre-existing. Removed per the explicit scope
constraint; not committed or pushed.

## 5. Minor doc regression restored

`use-tickets.ts` dropped an explanatory comment that existed on the equivalent line in
the pre-split `TicketsPage.tsx`, explaining why only `assignees[0]` is sent to the
backend (`TicketFilters.assignee` is a single value, not a list — a pre-existing backend
constraint, not a bug introduced here). Restored the comment so a future reader doesn't
mistake the truncation for an oversight.

## 6. Verification evidence

- `npm run typecheck` (`apps/web`): clean, 0 errors.
- `npm run lint` (`apps/web`): 0 errors, 0 warnings.
- `npm run build` (`apps/web`): succeeds; only the pre-existing chunk-size warning
  (`pdf.worker` + main bundle), unrelated to this diff — same warning noted in
  `audit-batch-05-report.md`.
- No test suites run or added, per batch instructions (and see §4 — one was removed).
- No manual browser click-through performed in this pass, per this session's explicit
  instruction (code-level verification only).

## 7. Files changed in this pass

- `apps/web/src/features/tickets/components/TicketRow.tsx` (fix — see §3)
- `apps/web/src/features/tickets/use-tickets.ts` (comment restored — see §5)
- `apps/e2e/tests/tickets-page.spec.ts` (removed — see §4)
- `docs/implementation/audit-batch-08-report.md` (this file, rewritten to reflect
  verified state)

Unchanged from the prior pass (reviewed, no defects found): `TicketsPage.tsx`,
`TicketBoard.tsx`, `TicketCalendar.tsx`, `TicketTable.tsx`, `TicketDetail.tsx`,
`StatusSelect.tsx`, `DatePicker.tsx`, `apps/web/src/features/activity/ActivityPage.tsx`
(type-only fix), `apps/web/src/features/projects/footer/ViewportMenu.tsx`
(eslint-disable relocation).

## 8. Next steps

None open from this batch's checklist. Await next batch assignment.
