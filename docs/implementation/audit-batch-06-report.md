# Audit batch 06 report — M-13, M-14

Date: 2026-09-08
Scope: M-13 (Project lifecycle) and M-14 (Asset review canvas), ledger IDs
FD-AUD-018..026, UX-AUD-041..046.

## 0. Note on process

This batch was first drafted by another pass (uncommitted working-tree state, plus a
`docs/implementation/audit-batch-06-report.md` draft) before this session started. This
report **verifies that draft against the actual code** rather than repeating its claims.
Two of its claims did not hold up under direct verification (see §3) and have been
corrected here. Everything below reflects the tree as it stands now, after fixes.

## 1. Baseline: M-13 project lifecycle (already committed, not part of this diff)

Confirmed via `git log` that page management, deploy/version history, duplicate, export,
and hard-delete all landed on `main` in commit `4d2f00a` ("fix: reconcile project
lifecycle audit and CI"), an ancestor of current `HEAD`. This matches
`audit-batch-04-triage-report.md`'s account of that work. Re-verified directly against
the current source (not assumed from the prior reports):

- **Page management** (`backend/app/modules/pages/service.py`): `create_page`,
  `update_page`, `reorder_pages`, `delete_page` all exist, each emits an audit event
  (`PAGE_CREATED`/`PAGE_UPDATED`/`PAGES_REORDERED`/`PAGE_DELETED`), and each route is
  gated on `project:manage` (`backend/app/modules/pages/router.py`). `delete_page` calls
  `PageRepository.reference_counts` (comments/revisions/revision_diffs/project_assets)
  and raises `ConflictError` if any are non-zero — this is the same reference guard
  described in `audit-batch-02-report.md`'s M-03 page-safety section. Frontend
  (`ProjectOverviewPage.tsx`) reads `?page=` on mount and writes it via
  `setSearchParams` on every page change — deep-link behavior works both ways. API calls
  are fully typed against `@backline/types` (no `any`).
- **Deploy/version history** (`backend/app/modules/snapshot_engine/service.py`):
  `list_project_revisions` reads from `db.revisions`, `db.revision_diffs`, and
  `db.recovery_logs` — the same collections the revision/diff/recovery pipeline in specs
  09/10 writes to. No parallel "deploy log" collection exists anywhere in the tree.
  `VersionMenu.tsx` calls the real `GET /projects/{id}/revisions` endpoint (not a stub).
- **Duplicate** (`backend/app/modules/projects/service.py::duplicate_project`): copies
  project metadata, 5 of 7 settings fields (`proxy_mode`/`snippet_installed` excluded by
  design — the copy gets its own fresh share link), and website page metadata only.
  Comments/revisions/assets are never touched by the copy path; the emitted
  `project.duplicated` event hard-codes `copied_comments/revisions/assets: 0`.
- **Export** (`backend/app/modules/projects/service.py::export_project_comments`):
  permission-checked at the router (`project:manage`), re-validates workspace ownership
  inside the service via `get_project(...)`, and applies OWASP CSV-formula
  neutralization. **This neutralization had a real gap — see §3.1.**
- **Delete**: hard-delete preview/confirm (`deletion_service.py`) still implements every
  M-03 safety invariant from `audit-batch-02-report.md`: two-step preview/confirm, typed
  `project:hard_delete` permission (owner/admin only), archived-project gate, exact
  project-name + `acknowledge_permanent_deletion` confirmation, 1-hour plan expiry,
  graph-signature drift check, unsafe-object-reference block, ordered cascade delete,
  idempotent object GC with crash-recovery retry, and a retained audit trail. Verified
  the actual current file contents (not just a diff) against that list — **no
  regression. The delete flow is production-safe today.** The one real gap found was a
  UX completeness issue in the frontend preview dialog, not a backend safety hole — see
  §3.3.
- **Website preview** (`ProjectOverviewPage.tsx`): a 30s `setTimeout` flips status to
  `error` only if still `loading` (guards against a stale timer firing after success);
  the timer is cleared on every dependency change and on unmount. `reloadPreview()`
  bumps a `retryCount` that's folded into the iframe's `key`, forcing a real remount
  rather than trusting the browser to re-fetch. Failure state shows a real message plus
  three actions (Try again / Open live page / Check URL). Caveat: the message is generic
  guidance, not a true root-cause diagnosis (the browser gives no signal for a framed
  4xx/5xx or CORS block), so the 30s timeout is doing most of the actual failure
  detection — this is a platform limitation, not a bug, and was left as-is.

## 2. M-14 canvas: what changed in this diff

`apps/web/src/features/assets/AssetReview.tsx`:

- **Coordinate transforms**: replaced the old `point()` helper (plain
  `getBoundingClientRect()` division, which breaks once `transform: scale() rotate()` is
  applied) with `getPoint()`, which projects the pointer through the center of the
  element, inverse-rotates by `-rotation`, then divides by `zoomScale` before converting
  to a 0–1 fraction using `offsetWidth`/`offsetHeight` (unaffected by the CSS transform,
  unlike `getBoundingClientRect()`'s post-transform box). Verified the math against the
  actual `transform: scale(${zoomScale}) rotate(${rotation}deg)` / `transformOrigin:
  center center` used in the render: since `zoomScale` is a single uniform scalar,
  dividing by it commutes with the rotation-matrix inverse, so the order used here
  (rotate back, then unscale) is mathematically equivalent to unscale-then-rotate. Used
  consistently for the draft-region drag, and the existing pin move/resize drag handles.
- **Keyboard equivalents**: `=`/`+` zoom in, `-` zoom out, `[`/`]` rotate left/right,
  `ArrowLeft`/`ArrowRight` for PDF page nav — mirrors the existing toolbar buttons'
  bounds (0.25–4x zoom, ±90° rotation) exactly, ignored while an `INPUT`/`TEXTAREA` has
  focus so it doesn't hijack typing in the comment form.
- **Resource cleanup**: `PdfCanvas`'s render effect already called `render?.cancel()` and
  `task.destroy()` on cleanup/unmount (pre-existing, confirmed still correct). Guest
  drag/resize on comment pins is already disabled client-side (`if (!commentMode ||
  guest) return`) per the earlier `AssetReview.tsx` reanchor fix — confirmed still intact
  and unaffected by this diff.

## 3. Bugs found during verification and fixed

**3.1 — Real: two dead-code TypeScript errors the original pass's report missed.**
The `getPoint()` refactor left two leftover `const rect = container.getBoundingClientRect();`
declarations (in the pin move-handle and resize-handle `onPointerDown` handlers) that
became unused once `getPoint()` started computing its own rect internally. With
`noUnusedLocals: true` in `tsconfig.app.json`, this is a hard `tsc -b --noEmit` failure
(`TS6133`), not a warning. The original report's "Typecheck completes cleanly with 0
errors" claim was checked and found false — running `pnpm --filter @backline/web run
typecheck` reproduced the two errors. **Fixed**: removed both dead declarations.
Re-verified clean.

**3.2 — Real: CSV-injection gap in comment export, not part of the M-14 diff but found
while verifying the M-13 export claim.** `export_project_comments`
(`backend/app/modules/projects/service.py`) has a `_csv_safe_cell()` helper that
neutralizes OWASP CSV formula injection (a cell starting with `=`, `+`, `-`, or `@` gets
a leading `'`) and applies it to `author_name` and `body` — but the `assignees` column
(`"; ".join(assignee_names)`) was written unsanitized. Assignee display names are
free-text and attacker-controlled (any workspace member can rename themselves to
`=1+1(...)` and be assigned to a comment), so this was a real, exploitable gap in a
column the code's own threat model should have covered. **Fixed**: wrapped the
assignees column in `_csv_safe_cell()` too; updated the function's docstring to name all
three columns instead of two.

**3.3 — Real, but UX-only: hard-delete preview dialog under-disclosed what would be
deleted.** `ProjectDeletionCounts` has 13 fields; the frontend preview dialog
(`ProjectMenu.tsx`'s `HardDeleteDialog`) only rendered 6 of them, silently omitting
`revision_diffs`, `recovery_logs`, `notifications`, `project_integrations`,
`object_keys` (i.e. the reviewer never saw how many stored files would be permanently
deleted), and `retained_audit_events`. Worse, `unsafe_object_references` — the exact
signal that makes the *server* refuse to confirm — was never shown before the user typed
the full project name and hit delete; they'd only find out via an inline error after
attempting it. Not a backend safety hole (the server still blocks it either way), but it
undercut the "see exactly what will happen" goal M-03 was designed around. **Fixed**:
the dialog now renders all 13 count fields, and shows an explicit blocking panel (with a
re-check button) instead of the name-confirmation form whenever
`unsafe_object_references > 0`, rather than letting the user reach a dead-end after
typing the full project name.

**3.4 — Minor cleanup.** Removed a permanently-disabled, no-op "Deploy history" menu
item from `ProjectMenu.tsx` (`onClick: () => undefined`, `note: "Coming soon"`) — the
real, working version-history UI is `VersionMenu.tsx` in the project footer; the stub
was dead code sitting next to a working feature that does the same job, which is
confusing, not helpful. Removed the now-unused `"clock"` icon variant it was the only
caller of. Also cleaned up an indecisive leftover comment in `duplicate_project`
(`# ... excluding proxy_mode and snippet_installed maybe, or copy all`) to state
plainly what the code does and why.

## 4. Verification

Run directly (not assumed from the prior draft):

- `pnpm --filter @backline/web run typecheck` (`tsc -b --noEmit`): **0 errors** (after
  the §3.1 fix; failed with 2 errors before it).
- `pnpm --filter @backline/web run lint` (eslint): **0 errors**, 3 pre-existing warnings
  unrelated to this diff (`ActivityPage.tsx` exhaustive-deps, `ViewportMenu.tsx`
  fast-refresh) — same warnings present on baseline `main`.
- `pnpm --filter @backline/web run build` (`tsc -b && vite build`): succeeds, same
  pre-existing large-chunk warning (PDF worker + main bundle) as prior batches, not
  introduced here.
- Backend `ruff check app/`: **all checks passed**.
- Backend `mypy app/`: **no issues found (144 source files)**.
- No test suites were run or added, per the batch instructions.

## 5. Scope discipline

No other workstreams were touched. Files changed: `apps/web/src/features/assets/AssetReview.tsx`
(M-14 canvas), `apps/web/src/features/projects/ProjectMenu.tsx` (M-13 delete-preview
disclosure + dead menu cleanup), `backend/app/modules/projects/service.py` (M-13 export
CSV-injection fix + comment cleanup). Nothing under other modules (auth, comments,
tickets, notifications, etc.) was modified.
