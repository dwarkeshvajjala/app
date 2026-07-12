# TDR-0005: Board filter state lives in URL search params, not a Zustand store

Date: 2026-07-12
Status: Accepted

## Context

`20-Build-Plan.md`'s Milestone 6 line item and `14-State-Management.md` describe board
filter/view state as a Zustand store kept in sync with the URL, on the theory that a
dedicated client-state store is the right tool once multiple components need to read
and write shared UI state (view mode, filters, selection).

Milestone 6's actual filter surface is five independent scalar values (status, layer,
assignee, device, page) read and written by exactly one component, `BoardPage`. A
Zustand store synced to the URL means two sources of truth kept deliberately in lockstep
(store -> URL on write, URL -> store on read/hydrate) purely to satisfy an architectural
default that isn't yet load-bearing - no other component needs this state, and
`useSearchParams` already gives shareable, back-button-correct, bookmarkable filter state
on its own.

## Decision

`BoardPage` reads/writes filters directly via `useSearchParams`, and keeps `view`
("kanban" | "list") and row-selection as local `useState` (view mode isn't meaningfully
shareable via URL yet at this scale; selection is inherently ephemeral, per-session
state). No Zustand store was introduced in this milestone.

## Consequences

- If a later milestone needs this state read from *outside* `BoardPage` (e.g. Milestone
  7's realtime layer wanting to know "what's currently filtered" to scope a live-update
  toast, or a future global command palette), introduce the Zustand store then, synced
  to the URL the same way `14-State-Management.md` describes - this TDR is a scope
  deferral, not a rejection of the pattern.
- `20-Build-Plan.md`'s Milestone 6 line and `14-State-Management.md` should be read with
  this amendment in mind: the Zustand-store-synced-to-URL description is the intended
  shape once cross-component sharing is needed, not a requirement for the first version.

## Note on the Milestone 6 Definition of Done

The DoD's acceptance criterion - "50 comments across 3 pages triaged in under 10 minutes
without leaving the board, measured in a usability pass, not just 'the feature exists'"
- calls for a human usability session with a real PM tester, the same way Milestone 9's
DoD calls for "an unaided usability test with a real (non-teammate) participant." Neither
can be satisfied by automated or agent-driven testing by construction. What *was* done
for M6: a real end-to-end Playwright run against a live backend + dashboard (login,
workspace, project, 5 seeded comments across 2 pages/2 layers/4 statuses, both Kanban and
List views, status filtering, bulk multi-select status change, and individual card status
change), confirming the mechanics work and are fast to operate - not a timed session with
an actual person. The human usability pass remains outstanding and should happen before
this milestone is considered fully closed in the product sense, not just the engineering
sense.
