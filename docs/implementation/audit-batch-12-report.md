# Audit batch 12 report — M-21/M-22 final verification

Date: 2026-09-09
Scope: M-21, M-22; ledger IDs FD-AUD-043/044/054. No test suites were added or run.

This requested batch number collides with the committed M-19/M-20 follow-up report at
`74d7f7d`; that earlier evidence remains available in Git history. This report uses the
requested filename and reflects the current M-21/M-22 pass.

## Findings corrected in the inherited Batch 12 draft

- It claimed frontend E2E/axe, backend pytest, migration/index tests, and every Section
  10 ledger row had passed. No evidence supported those claims, and this task explicitly
  excluded test-suite execution. Those claims are removed.
- CI ran workspace-scoping lint at the correct path, but had no generated-contract drift
  gates. CI now regenerates and diffs OpenAPI JSON in the backend job and generated
  TypeScript declarations in the frontend job.
- `reanchor_on_deploy` and `client_digest_enabled` were not excluded from the domain
  model: they remain typed/stored compatibility fields with no runtime consumer. The
  first-party project form no longer writes them and labels their real behavior.
- AI/billing were not fully honest placeholders. AI opened a simulated Pro/pricing path,
  Usage showed fabricated zero metrics, and Billing displayed unconfigured benefits,
  prices and totals. Those simulations were removed.

## M-21 evidence

- Read and cross-checked every available `audit-batch-00-report.md` through
  `audit-batch-11-report.md`, the current CI workflow, amendment index, architecture
  index, master audit, and affected TDRs/specifications.
- Regenerated `packages/types/openapi.json` with
  `backend/.venv/Scripts/python.exe backend/scripts/export_openapi.py` and regenerated
  `packages/types/src/openapi.ts` with
  `pnpm --filter @backline/types generate:local`. A second run left both SHA-256 values
  unchanged (`7E37C76F...7645` and `587DBB92...D0F`). The only generated diff against
  HEAD is the exporter-owned final newline in `openapi.json`; `openapi.ts` has no
  semantic drift.
- `backend/scripts/check_workspace_scoping.py` exists at the exact path used by CI and
  `backend/tests/test_workspace_scoping_lint.py`. Running it from `backend/` passed for
  17 repository files. No path fix was needed.
- Reconciled stale source prose in `docs/spec/07-Review-SDK.md`,
  `14-State-Management.md`, `16-Dashboard.md`, and `10-Revision-Recovery.md`.
  `18-Storage-Deployment.md` already used UUID upload keys. TDR-0009 already contains
  the Batch 03/07 mentions-superseded amendment.

## M-22 evidence

- TDR-0020 records the responsive-dashboard decision: no hard signed-in desktop gate
  below 1024px. This is separate from Web App/Mobile App project types, which remain
  unavailable without invented dates or notification capture.
- The legacy `/image-pdf` placeholder route redirects into the real image/PDF-capable
  project list instead of telling users that a delivered project type is coming soon.
- Project settings now describe unconditional revision recovery and unavailable client
  digest delivery without offering switches that save values no runtime path reads.
- AI and billing now state that providers, jobs, usage accounting, prices, entitlements,
  checkout and charging do not exist. No fake credits, zero-usage dashboard, pricing
  calculator or checkout-success behavior remains in a reachable production path.

## Definition of Done (master audit Section 8)

- [ ] **Every P0/P1 workstream is fixed or accepted as wont-do.** Not proven by this
  scope. Prior reports retain explicit gaps, including M-15 re-anchor concurrency and
  environment-dependent/browser verification.
- [ ] **Every Section 10 source ID has a final evidence status.** Not true. The master
  ledger still contains Pending, Partial and Backlog rows. The three IDs assigned to
  this batch have final statuses below; this report does not relabel the other 144.
- [ ] **No cross-workspace or guest/team leakage in raw API/WebSocket tests.** Not
  re-verified here because test suites were excluded. Batch 11 performed a static
  security read; it explicitly did not run backend pytest.
- [ ] **No stored policy flag is presentation-only.** Partially met. Active security
  settings are server-enforced, but the two legacy compatibility fields remain in the
  API without runtime consumers. TDR-0020 records this and the first-party UI no longer
  edits them.
- [x] **Destructive delete retention/R2 cleanup/audit semantics.** Previously delivered
  with focused evidence in Batch 02; no regression was found in the current scoped diff.
- [ ] **No duplicate/stale query-key, invalidation or realtime behavior.** Prior Batch
  10 and the committed M-19/M-20 follow-up provide static evidence, but this pass did not
  run behavioral tests, so the integrated criterion is not newly proven.
- [ ] **Core route loading/empty/error/retry/success and keyboard behavior.** Multiple
  prior batches improved these states, but the master ledger still records partial/open
  UX rows; a repo-wide browser claim would be inaccurate.
- [x] **OpenAPI generation has no unexplained drift.** Deterministic two-run generation
  passed and CI now fails future JSON/TypeScript drift.
- [ ] **All lint/typecheck/build and test/axe/migration gates pass on this tree.** Static
  portion passed: Turbo lint/typecheck/build 9/9; Ruff lint/format; strict mypy; and
  workspace-scoping lint. Test, E2E, axe and migration/index suites were not run.
- [~] **Documentation and accepted TDRs match shipped behavior.** The M-21/M-22 stale
  prose and scoped ledger items are reconciled. The root master ledger still contains
  non-final statuses, so the integrated documentation criterion is not fully closed.

## New TDR filed

- `docs/tdr/0020-audit-batch-12-reconciliations.md` — responsive dashboard decision,
  legacy re-anchor/client-digest compatibility status, implemented mentions, and the
  hard boundary against simulated AI/billing.

## Section 10 ledger status

| ID | Final status for this batch | Evidence |
|---|---|---|
| FD-AUD-043 | Intentional divergence / resolved for current scope | AI remains unavailable; reachable UI is an explicit placeholder with no provider, fake result, credit, paywall or fabricated usage. |
| FD-AUD-044 | Intentional divergence / resolved for current scope | Billing remains unavailable; no simulated prices, benefits, entitlement, checkout, charge or success state. |
| FD-AUD-054 | Resolved for the four named stale-doc candidates and Batch 12 records | Specs, flow matrix, delivery ledger, TDR-0020 and this report now match the current architecture/status. |

All three ledger IDs assigned to Batch 12 have a final status. The complete 147-row
Section 10 ledger does **not** yet have final resolved evidence for every ID; claiming
otherwise would violate M-21's rule against calling unwired or unverified work delivered.

## Verification actually run

- `pnpm turbo run lint typecheck build` — passed, 9/9 tasks. Web build processed 591
  modules; the existing large-chunk warning remains.
- `backend/.venv/Scripts/python.exe -m ruff check .` — passed.
- `backend/.venv/Scripts/python.exe -m ruff format --check .` — passed, 189 files.
- `backend/.venv/Scripts/python.exe -m mypy app/ scripts/` — passed, 153 files.
- `backend/.venv/Scripts/python.exe scripts/check_workspace_scoping.py` — passed, 17
  repository files.
- `git diff --check` — passed before commit.
