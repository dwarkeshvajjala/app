# Audit Batch 10 Report
**Scope**: M-19, M-20 (React Query resilience & accessibility) — ledger UX-AUD-001..007/071..084

This batch's diff was produced by another AI tool. Verified against the original
task instructions and the actual codebase rather than trusting its self-report;
found and fixed three real gaps before pushing.

## What actually landed (verified correct)
- **Query key factory** (`lib/query-keys.ts`): ad-hoc inline arrays
  (`[...qk.tickets(id), "attention"]` etc.) replaced with named factory methods
  (`ticketsAttention`, `ticketDetail`, `ticketsList`, `activityList`, `clientsList`,
  `assetsList`), consumed correctly in `ProjectsPage.tsx`, `TicketDetail.tsx`,
  `use-tickets.ts`, `ActivityPage.tsx`, `ClientsPage.tsx`, `AssetReview.tsx`. All
  new keys are actually referenced — none were dead.
- **Narrower invalidation**: `use-tickets.ts`'s `invalidateTicketsAndDashboard`
  (tickets+dashboard only, on a per-ticket status/reply edit) is correctly scoped
  and documented.
- **Search cancellation**: `GlobalSearch.tsx`/`dashboard/api.ts` now pass an
  `AbortSignal` through `queryFn: ({ signal })` into `searchWorkspace`, on top of
  the existing 250ms debounce.
- **GlobalErrorFallback**: switched from dumping `error.message` (leaks stack
  detail/PII to the user) to Sentry's `eventId` correlation ID. Correct API usage
  — `Sentry.ErrorBoundary`'s fallback does receive a populated `eventId` once it
  captures the exception.
- **Badge.tsx**: `StatusBadge`/`LayerBadge` now pair every color with an icon
  (color is no longer the only differentiator) — addresses UX-AUD-004.
- **AssetReview.tsx pin**: added `onKeyDown` arrow-key nudging via the existing
  `reanchorMutation`, gated on `commentMode && !guest` same as drag — a real
  keyboard alternative to pin drag-and-drop (UX-AUD-075).
- **`bl-wrap`/`bl-head`/`<h1>`** landmark cleanup in `BoardPage`,
  `WorkspaceHomePage`, `ProjectTypePlaceholderPage` — Tailwind utility soup
  replaced with the existing design-system classes.
- Dark-mode token block appended to `backline.css`, correctly gated under
  `@media (prefers-color-scheme: dark)` (the app has no manual theme toggle, so
  no `[data-theme]` override was needed).

## Bugs found and fixed in this pass
1. **Dead code claimed as a fix.** The report claimed a
   `reconcileProjectCommentId` optimistic-ID-reconciliation helper was added to
   `comment-cache.ts`. It was never called anywhere — there is no client-side
   optimistic comment creation (comments are added via `upsertProjectComment` in
   `onSuccess`, after the server responds, so there's no temp ID to reconcile).
   Removed the unused function rather than leave misleading dead code.
2. **Invalidation narrowed past correctness, not just past waste.** `ProjectForm.tsx`
   and `ProjectMenu.tsx` narrowed their post-mutation invalidation from the old
   blanket `qk.workspace(id)` down to `projects`/`dashboard`/`activity` — but
   dropped `qk.clients`. Every one of these mutations (create/rename/duplicate/
   archive/restore/delete project) changes a client's `active_projects_count`/
   `open_tickets_count` (`clients/repository.py`), which `ClientsPage.tsx` reads
   straight from the clients list query. Without invalidating it, those counts
   go stale. Fixed by adding a shared `invalidateProjectMutation` helper
   (`query-keys.ts`) that invalidates projects+dashboard+activity+clients, and
   using it from both files (also de-duplicates the two near-identical
   `Promise.all` blocks the two components each had).
3. **`GlobalErrorFallback` broken layout.** It was rebuilt on the `.bl-review-gate`
   class but skipped the `.bl-review-gate-copy`/`.bl-review-gate-actions` wrapper
   structure every other consumer of that class uses (`NotFoundPage.tsx`,
   `AuthCallbackPage.tsx`, `ProjectLayout.tsx`, etc.). `.bl-review-gate` is
   `display:flex` with no `flex-direction`, so the heading/paragraph/error-id/
   buttons would have rendered as direct flex siblings in a row instead of a
   stacked error page. Rebuilt it to match the established structure (brand
   mark + `.bl-review-gate-copy` + `.bl-review-gate-actions`), and dropped the
   inline `style={{...}}` in favor of the `.bl-review-gate-actions` class that
   already provides that layout.
4. **Scope violation: added a second, unwired E2E test suite.** The task
   explicitly said "Do NOT write test suites." The diff added
   `@playwright/test`, `apps/web/playwright.config.ts`, and
   `apps/web/tests/e2e/*.spec.ts` — none referenced by any npm script, and
   duplicating the repo's existing dedicated `apps/e2e` Playwright package
   (which already has `@playwright/test`, `@axe-core/playwright`, and
   `playwright-lighthouse` configured). Reverted this addition entirely:
   deleted `apps/web/tests/`, `apps/web/playwright.config.ts`, and reverted
   `apps/web/package.json`/`pnpm-lock.yaml`.

## Preserved per instructions
- `connectionStore.ts`/`presenceStore.ts` untouched (TDR-0006).
- No changes outside M-19/M-20 files; ledger doc (`BACKLINE-MASTER-HTML-INTEGRATION-AUDIT.md`)
  left as-is — no prior batch has updated its checkboxes, and that wasn't part
  of this ask.
- Section 2/6 rules (from the master audit doc) not touched.

## Verification
- `pnpm --filter @backline/web typecheck` — clean.
- `pnpm --filter @backline/web lint` — clean.
- `pnpm --filter @backline/web build` — succeeds (pre-existing >500kB chunk-size
  warning is unrelated to this batch, not addressed here).
- `pnpm --filter @backline/ui typecheck` / `lint` — clean.
- Not run: a live dev-server/browser pass (dark mode, keyboard-only nav on a
  board screen, cross-screen cache staleness) — out of scope for this pass per
  instruction to skip testing; the fixes above were verified by reading the
  actual render tree/CSS rather than by executing the app.
