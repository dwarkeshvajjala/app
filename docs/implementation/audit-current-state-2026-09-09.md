# Current implementation audit — 2026-09-09

## Outcome

**Not release-complete.** The repository is buildable and its configured static
quality gates pass, but the master audit is intentionally not closed: 3 of its
147 ledger rows are complete, 88 are partial, 47 are pending, and 9 are backlog.
The Batch 00–12 reports exist, but their existence is evidence of review work,
not evidence that every requirement is delivered.

## Evidence gathered in this pass

| Check | Result | Notes |
| --- | --- | --- |
| Batch audit reports `00`–`12` | PASS | Every expected report file exists. Batch 12 itself explicitly says the overall Definition of Done is not proven. |
| Frontend lint | PASS | `pnpm lint` completed successfully. |
| TypeScript typecheck | PASS | `pnpm typecheck` completed successfully. |
| Production build | PASS with warning | `pnpm build` completed; the web application still has a >500 kB output-chunk warning. |
| Backend lint and types | PASS | `backend/.venv/Scripts/python.exe -m ruff check app` and `-m mypy app` passed. |
| Workspace scoping static check | PASS | `backend/scripts/check_workspace_scoping.py` passed for all 17 repositories. |
| MongoDB connectivity | PASS | A read-only `ping` succeeded. No data was read, written, migrated, or deleted. |
| Redis connectivity | PASS | A read-only `PING` succeeded. No keys were read or modified. |
| Existing Playwright/pytest/axe suites | NOT RUN | Project guidance for this Codex task limits verification to lint/typecheck/build rather than running or adding test suites. |

## Highest-priority implementation gaps

These are current, checked-in master-audit states, not speculative defects. They
must be resolved or consciously accepted before a release-complete claim is valid.

1. **P0 security/product work remains incomplete:** account preferences/security
   (FD-AUD-010/011), persisted review settings (018), team/guest visibility
   boundaries (042), core document/schema evidence (045–048), and browser/security
   journeys (052/053) are still marked pending.
2. **Comment and review interactions remain incomplete:** moving/resizing placed
   website comments, a safe undo/redo contract, keyboard/touch canvas behavior,
   and several guest resilience states are pending. The asset-review surface has a
   re-anchor endpoint, but that is not proof of full website-canvas concurrency and
   conflict handling.
3. **Ticket workflow is incomplete:** ticket drag-and-drop and its keyboard equivalent
   are pending (FD-AUD-034 / UX-AUD-058). The calendar view also lacks the `Today`
   control expected by the newly added journey test; `Today` exists only inside the
   ticket-detail date picker.
4. **Accessibility/resilience is incomplete:** reduced-motion and a skip link are
   present, but the master audit still lists asynchronous announcements, keyboard
   completion, large-workspace behavior, skeleton stability, and privacy-safe
   diagnostics as incomplete.
5. **Intentional non-features must remain honest:** AI, billing, web-app/mobile-app
   project types, client digest delivery, and the legacy per-project re-anchor switch
   are not functional. The current UI correctly labels these limits; do not add fake
   prices, credits, results, or checkout behavior.

## Current unstaged changes: review findings

The small accessibility/contrast edits are type-safe, but `git diff --check` fails
because `apps/e2e/tests/accessibility.spec.ts` has trailing whitespace on line 23.

The latest changes corrected the route and modal assumptions in the three newly
unstaged Playwright journeys. They still need execution against an isolated stack
before becoming release evidence. The shared project-creation helper remains a
code-review concern: the wizard's `Continue` button is disabled until the test first
selects a project type, and the ticket list journey looks for a table even though the
current list view renders ticket rows in `.bl-table-wrap`.

| File | Current review finding |
| --- | --- | --- |
| `journey-5-tickets-board.spec.ts` | Uses the right workspace tickets route and calendar controls, but list-mode selector must target `.bl-table-wrap`, not require a table. |
| Shared `createProject` helper | Must select `Website` before clicking `Continue`; the production wizard correctly requires an explicit type choice. |
| `journey-6-integrations-billing.spec.ts` | Routes now match the router; only isolated execution remains outstanding. |
| `journey-7-project-delete.spec.ts` | Route/menu/archive flow now matches the source; exact destructive-dialog control behavior still needs isolated execution. |

The modified shared `createProject` helper otherwise follows the real native-dialog
wizard structure, but no E2E TypeScript/lint script currently includes the new files;
the root static gate cannot catch these behavioural selector/route errors.

## Recommended completion order

1. Correct or remove the unstaged journey tests, then run them only against an
   isolated local MongoDB/Redis/S3 stack—not the shared cloud database.
2. Close the P0 security and guest/team visibility items with negative API and browser
   evidence.
3. Finish comment geometry/concurrency and ticket keyboard drag/drop flows.
4. Close the remaining accessibility/resilience rows, including browser, responsive,
   offline, and long-list checks.
5. Update the master ledger and delivery matrix only after each item has fresh,
   reproducible evidence.

## Confidence

- **Build/code health:** high confidence for the static gates listed above.
- **Cloud service reachability:** high confidence for connectivity only.
- **End-to-end behavior, data integrity, and release readiness:** low confidence until
  the incomplete master-audit rows and the isolated test/browser evidence are closed.
