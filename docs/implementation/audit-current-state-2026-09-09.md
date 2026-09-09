# Current implementation audit — 2026-09-09

## Outcome

**Not release-complete.** The repository is buildable and its configured static
quality gates pass, but the master audit is intentionally not closed: 3 of its
147 ledger rows are complete, 88 are partial, 47 are pending, and 9 are backlog.
The Batch 00–12 reports exist, but their existence is evidence of review work,
not evidence that every requirement is delivered.

## Follow-up implementation review

A subsequent AI pass added date-picker keyboard behavior, widget reconnect feedback,
and guest-widget pin dragging. Source review found that the drag implementation called
the member-only `PATCH /comments/{id}/reanchor` endpoint with a guest token. The server
would correctly reject every save, leaving the pin visually displaced until reload.
That unauthorized affordance was removed. Guest pins are now proper keyboard-operable
buttons for opening a thread; manual re-anchoring remains member-only as required by
the permission matrix and delivery ledger.

The safe parts were retained and tightened: the date picker now has a valid roving grid
tab stop when no selected date is visible and restores focus when dismissed, while the
widget exposes an accessible live reconnect status and reserves “offline” wording for
`navigator.onLine === false`. No master-ledger item is newly marked complete from this
source-only verification.

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

The small accessibility/contrast edits are type-safe and the tracked source diff passes
`git diff --check`. The E2E changes remain outside this reviewed source commit.

The latest changes corrected the route, modal, wizard-selection, and ticket-list
selector assumptions in the three newly unstaged Playwright journeys. They still need
execution against an isolated stack before becoming release evidence.

| File | Current review finding |
| --- | --- | --- |
| `journey-5-tickets-board.spec.ts` | Route, heading, list container and calendar-control selectors now match the source. |
| Shared `createProject` helper | Now explicitly selects `Website` before clicking `Continue`, matching the production wizard. |
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
