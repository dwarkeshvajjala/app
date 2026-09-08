# M-17 Verification Report (Clients, Activity, Members, Integrations)

This supersedes the prior draft of this file, which was written by another AI
tool before this pass. That draft's backend changes were functionally mostly
correct but had real gaps; this report documents what was verified, what was
wrong, and what was fixed.

## Scope
FD-AUD-036..038, UX-AUD-061..064 (M-17): client summary table, client action
menu, activity filters/grouping, members/integrations honesty.

## What the prior draft got right
- `ClientRepository.list` computing open/resolved/reviewer/last-activity/total
  as a Mongo aggregation (`$lookup`/`$facet`-style `$addFields`) instead of
  duplicated stored columns — field names (`client_id`, `project_id`,
  `page_id`, `parent_id`, `author_guest_id`, `status` values `resolved`/
  `wont_fix`) all match the real schemas/indexes used elsewhere
  (`dashboard/repository.py`).
- Activity backend filters (`mine` → `actor_id`, `clients` → `type` regex,
  `deploys` → `type` regex) and frontend Today/Yesterday/Earlier grouping.
- Integration disconnect now appends a `integration.disconnected` audit event.
- No regressions in unrelated call sites (`dashboard.activity` signature
  change was threaded through router/service correctly).

## Bugs found and fixed in this pass

1. **Client CSV export was non-functional.** The prior draft wired the
   "Export" menu item to `window.location.assign(...)`. This app authenticates
   with a bearer token held in memory (`apps/web/src/lib/api-client.ts`), not
   a readable cookie — a raw navigation sends no `Authorization` header, so
   the request would 401. The codebase already has the correct pattern
   (`apiFetchBlob` + blob-URL anchor download, used by
   `features/projects/ProjectMenu.tsx` for project export). Added
   `exportClients()` to `features/clients/api.ts` and switched the button to
   a mutation using that pattern.

2. **"Archive recovery" (UX-AUD-062, explicitly named in the audit) was
   unreachable.** A `POST .../clients/{id}/restore` endpoint existed, but
   nothing in the UI could see an archived client or call it — the client
   list only ever fetched non-archived clients, so the restore feature was
   dead code. Fixed:
   - `ClientRepository.list` now takes `include_archived`; added
     `find_archived` / `restore` repository methods (the old `restore_client`
     service function bypassed the repository layer with an inline
     `from app.core.mongo_utils import to_object_id` import and raw
     `db.clients.find_one`/`update_one` calls — moved that logic into the
     repository, consistent with the rest of the module).
   - `GET /workspaces/{id}/clients` accepts `include_archived` (default
     `false`, so existing behavior is unchanged by default).
   - `ClientsPage.tsx` adds a "Show archived" toggle, an archived-clients
     section, and a restore confirmation dialog — mirrors the existing
     archive/restore pattern already used for projects
     (`ProjectMenu.tsx`'s `restoreProject` + confirm dialog).

3. **The new aggregated `stats` were computed but never rendered.** The
   summary table still only showed a client-side project count; open/
   resolved/reviewer/last-activity data from the new aggregation wasn't
   surfaced anywhere in the UI, so FD-AUD-036 ("client summary table") was
   still incomplete in practice. Added a "Summary" column (active projects /
   open tickets / reviewers) and a "Last activity" column
   (`lib/time.ts`'s `timeAgo`, same helper `ProjectsPage.tsx` already uses
   for identical open/resolved/last-activity data).

4. **Lint failures in the prior draft's backend diff.** `ruff check` on the
   changed modules found 12 errors (line-length violations in the new
   aggregation pipeline and CSV writer, one unsorted-import block) — this
   contradicts the prior draft's claim that "syntax was verified manually."
   Fixed with `ruff format`/`ruff check --fix` (mechanical, no behavior
   change).

5. Regenerated `packages/types/openapi.json` / `openapi.ts` (were stale —
   missing `ClientStatsOut`, the `stats` field, and the restore/export
   endpoints), by loading `app.openapi()` directly from the FastAPI app
   object. This does not require a database connection (Mongo/Redis are only
   touched by the app's lifespan, not by schema introspection), so it also
   doubles as an import/syntax check across the whole backend module tree.

## Verification performed
- **Backend:** `ruff check app` → all checks passed. `mypy app` (strict) →
  no issues in 144 source files. `python -c "from app.main import app;
  app.openapi()"` → imports cleanly, 72 routes registered (no DB connection
  needed for this).
- **Frontend:** `tsc -b --noEmit` → clean. `eslint .` → clean. `vite build`
  → succeeds (pre-existing >500kB chunk-size warning, unrelated to this
  change).
- Manual code read-through of: client list/archive/restore/export flow,
  activity filter/grouping logic against `docs/spec/17-Notifications-Integrations.md`
  field names, integration disconnect audit event, and the
  `require_workspace_match` usage on every clients/integrations endpoint
  (re-verified — no gaps found this batch).
- No live app run / DB connection was used per the reviewer's instruction;
  all verification is static (typecheck/lint/build/import + manual review).

## Not done (explicitly out of scope for this pass)
- Full responsive/mobile-card redesign of the client table ("responsive
  summary behavior" in the audit wording) — the table now carries more
  columns but a dedicated mobile layout pass wasn't attempted.
- `total_tickets_count` is computed and returned by the API but not
  separately surfaced in the CSV export or the table (open/resolved/
  reviewers/last-activity are); low value to add and left as-is.
- No test suites were written or run, per instructions.
