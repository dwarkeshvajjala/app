# Audit Batch 04 — uncommitted diff triage

Date: 2026-09-08

## Baseline and scope

`origin/main` and the local `main` both resolve to `9fe5400b395c4a6a95e77b1e2065241994e48fd6`.
That commit only adds `gcm-diagnose.log` on top of `afb2297`; it does not change application
code. Therefore the passing status reported for `9fe5400` did not repair the code in `afb2297`.

The original uncommitted application diff is principally M-13 (Project lifecycle):

- Page management: typed page create/update/reorder/remove contracts, member authorization,
  workspace/project-scoped persistence, audit events, page comment counts, and URL deep-link
  selection.
- Version history: a canonical read model over existing snapshot/revision/diff/recovery
  collections; no second deploy/revision source of truth was introduced.
- Duplicate: metadata/settings and website-page metadata are copied with a lineage reference;
  comments, assets, and review/revision history are not copied.
- Export: the member route is typed and permission-checked, and the browser uses an authenticated
  blob request with immediate object-URL cleanup.
- Shared API plumbing: refresh-aware blob fetching and regenerated OpenAPI/type declarations.

The recovery, revision, and snapshot repository changes support that M-13 version-history view.
They are not M-07 index work: no migration or index definition was added. They do introduce
bounded historical reads (200 revisions) that should be reviewed with the eventual M-07 query
budget/index pass.

There is no uncommitted M-14 canvas implementation. Image/PDF canvas behavior is therefore not
part of this diff. The existing hard-delete UI and safety service are baseline code, not newly
introduced by this diff; the existing deletion safety tests pass.

## Why `afb2297` failed locally

The same locked-toolchain checks were run against a clean detached worktree at `9fe5400`:

- `ruff check .`: passed.
- `ruff format --check .`: failed because 33 baseline files were not formatted for the locked
  Ruff version. `9fe5400` did not change any of those files.
- `mypy app/ scripts/`: passed.
- Backend tests: the baseline had 235 passed and two contract failures. The project test still
  expected only the original two settings fields even though the committed M-04 settings contract
  returns all seven fields; the empty-search endpoint did not enforce its documented non-empty
  query contract.
- The in-progress frontend diff initially produced six TypeScript failures because generated
  OpenAPI types and several new component props/callers had not yet been wired together.

`9fe5400` could not have fixed these failures because it contains no corresponding source changes.

## Fixes applied

- Completed the typed frontend/backend wiring and regenerated `packages/types` from the backend
  OpenAPI document.
- Enforced `q` with a one-character minimum and reconciled the stale project-settings assertion
  with the current seven-field API contract.
- Ran the locked Ruff formatter across the pre-existing baseline files so the CI formatter check
  is deterministic; these edits are mechanical only.
- Added workspace-level patched transitive dependency overrides and refreshed the lockfile. The
  high-severity `pnpm audit --audit-level=high` gate now passes; two moderate advisories remain.

## Verification

Passed on the current tree:

- `uv run ruff check .`
- `uv run ruff format --check .` (189 files already formatted)
- `uv run mypy app/ scripts/`
- `uv run python scripts/check_workspace_scoping.py`
- `uv run pytest -q`: **237 passed** (1,479 deprecation warnings from dependencies)
- `pnpm turbo run lint`: passed; one pre-existing React Hook dependency warning in
  `ActivityPage.tsx`.
- `pnpm turbo run typecheck`: passed.
- `pnpm turbo run build`: passed; widget bundle 11.72 KB gzipped (40 KB budget).
- `pip-audit`: no known vulnerabilities.
- `pnpm audit --audit-level=high`: passed; two moderate advisories remain.
- `git diff --check`: passed.

The GitHub Playwright/e2e job was not rerun locally in this triage pass. No new test suite was
added.

## Recommendation

Keep this as its own M-13 reconciliation commit and do not fold it into M-07 or M-14. It is
buildable and safe to push, with the explicit caveat that M-14 canvas work remains outstanding and
the historical query/index review should happen in the appropriate M-07 batch. The original diff
was coherent implementation work, not a revert candidate; it needed contract/type completion and
baseline formatter cleanup before landing.
