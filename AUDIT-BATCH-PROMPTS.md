# Backline Audit — Batch Prompts (0–12)

Reference files (already in repo root): `backline-Final Draft.html`,
`BACKLINE-MASTER-HTML-INTEGRATION-AUDIT.md`.

How to run: one batch per chat, strictly in order (0 → 12). Attach both
reference files to each new chat. Paste that batch's prompt below as the
first message. Save the chat's final report to the exact
`docs/implementation/audit-batch-NN-report.md` path named in the prompt —
every later batch reads prior reports from there instead of needing them
re-pasted.

No test-suite writing in any batch — implementation + architecture
correctness + "does not crash" verification (lint/typecheck/build +
manual exercise of the changed flow) only, unless a batch says otherwise.

Status: Batches 00–03 already run and merged (see
`docs/implementation/audit-batch-00-report.md` through
`audit-batch-03-report.md`, plus PR for batch 03). A triage pass is
needed before Batch 5 for uncommitted work already touching pages/
projects/snapshot/revision/recovery engines and a failing CI commit —
run "Batch 4 triage" below first.

---

## Batch 0 — Baseline & TDR conflict list *(already run)*

```
Attached: backline-Final Draft.html and BACKLINE-MASTER-HTML-INTEGRATION-AUDIT.md.

Scope for THIS chat only: M-00 (section 5) and the final execution
checklist in section 9, steps 1-2.

Do:
1. Run git status --short, git branch -vv, git rev-parse HEAD. Note:
   core.autocrlf may inflate git status with CRLF/LF noise — use
   git diff --ignore-space-at-eol --ignore-cr-at-eol to find real content
   changes, and classify only those files by workstream (M-01..M-22).
2. Recompute SHA-256 of docs/reference/backline-final-draft.html and
   compare against the hash in section 1 of the audit
   (27455b8ef30395a1724016da3ad70575c74b816da32037e3ce87e981e95afba4,
   571,683 bytes, 6,720 lines). Report match/mismatch.
3. Read every file in docs/tdr/** and docs/spec/** relevant to review
   auth, board URL state, realtime, recovery, proxy scope, notifications,
   launch readiness. Also read docs/implementation/00-index.md — per
   TDR-0012 it is a spec-level amendment for Final Draft scope, treat it
   as tier-2 precedence alongside docs/spec/**. Produce a conflict list:
   any place the audit's "Correct method" text contradicts an accepted
   TDR/spec decision.
4. Do NOT change any code. This is verification-only.

Report: real-diff file->workstream table, hash verification result, and
the TDR/spec conflict list. Save this report as
docs/implementation/audit-batch-00-report.md.
```

---

## Batch 1 — Backend authz core (M-01, M-02, M-05) *(already run)*

```
Attached: backline-Final Draft.html and BACKLINE-MASTER-HTML-INTEGRATION-AUDIT.md.

Scope for THIS chat only: M-01, M-02, M-05 (section 5), and traceability
ledger IDs FD-AUD-007/008/009/010/011/039/040/041/042/047,
UX-AUD-019/065-070 (section 10).

First: read docs/implementation/audit-batch-00-report.md for the
verified file/workstream routing and TDR conflict list before doing
anything else.

Do:
1. Re-verify current working tree yourself for these items — do not
   trust any prior report's status without checking the actual code.
2. Read docs/tdr/** and docs/spec/13-Authentication.md,
   docs/spec/06-Backend-Architecture.md, docs/implementation/00-index.md
   before changing anything.
3. Fix per the audit's "Correct method"/"Acceptance" text:
   - Workspace/tenant/session authorization holes (integrations router,
     page routes, session-family revoke, project ACL decision).
   - Share-link/project/guest policy enforcement (ask_reviewer_name,
     domain_restrictions, comment_export_permission, reviewer_can_resolve,
     show_board_to_client) — centralize checks, enforce server-side
     everywhere, never trust client-provided origin.
     Note: TDR-0006 records that the widget has no WS event for a
     comment leaving the guest-visible layer (client -> team) and never
     renders existing comments as pins. If your visibility enforcement
     assumes the widget already reacts live to layer changes, it
     doesn't — flag this as a follow-up dependency for the comments
     batch (M-15) rather than assuming it's solved here.
   - Auth/session model: OTP ergonomics, session list/revoke ownership,
     preference date typing. Preserve OTP+Google only — do NOT add
     password sign-in/reset even though the HTML has it.
4. Preserve architecture rules in section 2 and cross-cutting rules in
   section 6 (router->service->repository, Pydantic-first, no parallel
   subsystems).
5. Do not write test suites — implement, then verify manually and via
   lint/typecheck/build that nothing crashes.
6. Do not touch other workstreams. Do not commit or push.

Report: verified-only vs changed, remaining risks/divergences, build/lint
result. Save as docs/implementation/audit-batch-01-report.md.
```

---

## Batch 2 — Data safety & indexes (M-03, M-07) *(already run)*

```
Attached: backline-Final Draft.html and BACKLINE-MASTER-HTML-INTEGRATION-AUDIT.md.

Scope for THIS chat only: M-03, M-07 (section 5), and traceability ledger
IDs FD-AUD-022/048/051 (section 10).

First: read docs/implementation/audit-batch-00-report.md and
audit-batch-01-report.md before doing anything else.

Do:
1. Re-verify current working tree yourself — do not trust any prior
   report's status without checking the actual code.
2. Read docs/tdr/** and docs/spec/11-Database.md,
   docs/spec/18-Storage-Deployment.md, docs/implementation/00-index.md
   before changing anything. Note: the accepted screenshot-upload-key
   decision uses a UUID key under workspace/project (NOT {comment_id} —
   older 18-Storage-Deployment.md text is stale).
3. Fix per "Correct method"/"Acceptance":
   - Destructive delete: dry-run-first cascade (enumerate -> report counts
     -> confirm -> R2 cleanup -> Mongo delete in dependency order -> one
     auditable summary event). Page deletion must not silently orphan
     comments/revisions. Add R2 tombstone/GC strategy.
   - DB indexes: add additively (never drop first) for notifications
     unread path, share links, pages by URL, revisions, recovery logs,
     refresh-token family lookup, events feed, OTP lookup, guest
     last_seen_at TTL. Capture explain() evidence before/after.
4. Preserve section 2 architecture rules and section 6 cross-cutting rules.
5. Do not write test suites — implement, then verify manually (e.g. run
   a real dry-run + delete against a seeded project) and via lint/
   typecheck/build that nothing crashes.
6. Do not touch other workstreams. Do not commit or push.

Report: verified-only vs changed, remaining risks, build/lint result.
Save as docs/implementation/audit-batch-02-report.md.
```

---

## Batch 3 — Settings/notifications/contracts (M-04, M-06, M-08) *(already run)*

```
Attached: backline-Final Draft.html and BACKLINE-MASTER-HTML-INTEGRATION-AUDIT.md.

Scope: M-04, M-06, M-08 (section 5), ledger IDs FD-AUD-006/018/020/022/
038/045/049/050/053 (section 10).

First read: docs/implementation/audit-batch-00-report.md,
audit-batch-01-report.md. Verify M-01/M-02 policy helpers actually exist
before building on them.

Do NOT write test suites. Implementation + verification only:
1. Re-verify current tree yourself for these items — don't trust prior
   reports blindly.
2. Read docs/tdr/**, docs/spec/16-Dashboard.md,
   docs/spec/17-Notifications-Integrations.md, docs/implementation/00-index.md.
3. Fix:
   - Persisted project review settings as typed Pydantic submodel
     (capture browser/device, reviewer self-resolve, show board to
     client), enforced server-side, not just UI.
   - Notification digest: TDR-0009 defers per-member preference by
     design — do NOT build preference filtering. Only fix real privacy
     leakage (team-only content reaching wrong recipients).
   - "Email digest to client" setting: no TDR covers this — flag as
     undecided, don't implement blind.
   - "Re-anchor after deployment" setting: TDR-0007 has no per-project
     toggle concept — flag as needing a decision, don't wire as literal
     on/off switch.
   - Wire reply/mention/assignment/status notifications to real call
     sites with correct deep-link route metadata, canonical event-type
     constants. Mentions build-out is fine (MentionsInput.tsx exists).
   - Remove raw db.* calls from services; replace untyped `changes: dict`
     mass-assignment on page update with typed models; fix CSV export
     (real data, formula-injection escaping, permission checks); add
     idempotency for retry-prone POSTs; standardize pagination.
4. Preserve section 2/6 architecture rules exactly.
5. Verify the app doesn't crash: run relevant lint/typecheck/build for
   touched packages and manually exercise the changed flows (settings
   save, notification firing, CSV export) before reporting done.
6. Do not touch other workstreams. Do not commit/push.

Report: what changed, what's flagged as undecided, build/lint result.
Save as docs/implementation/audit-batch-03-report.md.
```

---

## Batch 4 triage — Resolve uncommitted work + failing CI *(run before Batch 5)*

```
Attached: backline-Final Draft.html and BACKLINE-MASTER-HTML-INTEGRATION-AUDIT.md.

There are uncommitted changes in the working tree right now touching:
apps/web/src/features/projects/ProjectPagesModal.tsx, api.ts,
footer/ProjectFooter.tsx, footer/VersionMenu.tsx, apps/web/src/lib/api-client.ts,
backend/app/modules/pages/* (events.py, repository.py, router.py, schemas.py,
service.py), backend/app/modules/projects/{schemas,service}.py,
backend/app/modules/recovery_engine/repository.py,
backend/app/modules/revision_engine/repository.py,
backend/app/modules/snapshot_engine/{repository,router,schemas,service}.py.

Also: commit afb2297 "feat: reconcile audit implementation work" shows
2/3 CI checks failing on GitHub; commit 9fe5400 on top of it shows 3/3
passing. Do not assume the failing checks were fixed by 9fe5400 — verify.

Do:
1. Inspect this uncommitted diff yourself (git diff --ignore-space-at-eol
   --ignore-cr-at-eol) and identify which master workstream(s) it
   belongs to (looks like M-13/M-14 page/version/canvas work, and
   possibly M-07 index work touching recovery/revision/snapshot
   repositories).
2. Determine why afb2297's checks failed — run the same lint/typecheck/
   build/pytest commands CI runs, locally, against the current tree
   (including these uncommitted changes) and report exact failures.
3. Fix whatever is broken so the tree is in a known-good, buildable
   state. Do not write new tests — just make it correct.
4. Do not commit/push yet — first give me a clean report of what this
   uncommitted diff actually is and whether it's finished or half-done,
   so we can decide whether it becomes its own committed batch before
   continuing with Batch 5 onward.

Report: workstream classification of the uncommitted diff, CI failure
root cause, current buildable/broken status, and a recommendation for
whether to commit this as-is, finish it, or revert it before starting
Batch 5. Save as docs/implementation/audit-batch-04-triage-report.md.
```

---

## Batch 5 — Shell/nav/dashboard/wizard (M-11, M-12)

```
Attached: backline-Final Draft.html and BACKLINE-MASTER-HTML-INTEGRATION-AUDIT.md.

Scope: M-11, M-12 (section 5), ledger IDs FD-AUD-002..017,
UX-AUD-011..018/032..040 (section 10).

First read: docs/implementation/audit-batch-00-report.md,
audit-batch-01-report.md, audit-batch-02-report.md,
audit-batch-03-report.md, audit-batch-04-triage-report.md. Confirm the
tree is currently buildable before starting. If shared Modal/Popover/
Toast/SearchInput/date-format primitives (M-10) don't exist yet, build
only the minimal version you need inline rather than blocking — do not
duplicate them later.

Do NOT write test suites. Implementation + verification only:
1. Re-verify current tree (WorkspaceSwitcherPopover, AccountModal — are
   they wired into DashboardSidebar?).
2. Read docs/tdr/0005-*, docs/tdr/0013-bounded-workspace-search.md,
   docs/spec/16-Dashboard.md, docs/implementation/00-index.md.
3. Fix:
   - Workspace switcher: real switch-token flow, keyboard/outside-click/
     return-focus, create-workspace slug preview.
   - Account entry wired to real profile/preferences/security.
   - Global search: TDR-0013 caps this at <=50 bounded regex results,
     no ranking/pagination, no client contacts, no guest exposure — do
     NOT add ranking/pagination. Only verify permission-filtering and
     / and Cmd/Ctrl+K discoverability.
   - Notifications route to exact target with fallback.
   - Route loading skeletons, not-found recovery, focus restoration,
     breadcrumbs.
   - Dashboard waiting-on-you block, project type tabs, filters, card
     preview states, new-project wizard as a real state machine
     (validation, upload progress/retry, client selection, consistent
     SVG handling per section 2.6).
4. Preserve section 2/6 rules — project lists stay React Query state,
   URL-owned filters, wizard state component-local.
5. Verify no crash: lint/typecheck/build for touched packages; manually
   walk the wizard start-to-finish and the workspace switcher/search/
   notifications.
6. Do not touch other workstreams. Do not commit/push.

Report: what changed, build/lint result. Save as
docs/implementation/audit-batch-05-report.md.
```

---

## Batch 6 — Project lifecycle + canvas/assets (M-13, M-14)

```
Attached: backline-Final Draft.html and BACKLINE-MASTER-HTML-INTEGRATION-AUDIT.md.

Scope: M-13, M-14 (section 5), ledger IDs FD-AUD-018..026,
UX-AUD-041..046 (section 10).

First read: docs/implementation/audit-batch-00-report.md,
audit-batch-02-report.md (delete/retention safety),
audit-batch-04-triage-report.md (this is likely where the pending
page/version/canvas work from that triage ends up finished, so read it
closely — do not redo work already completed there, only finish/fix
what's incomplete or broken). If M-03's cascade delete isn't actually
production-safe, keep the delete action blocked/hidden and report it.

Do NOT write test suites. Implementation + verification only:
1. Re-verify current tree for page management, deploy/version history,
   duplicate, export, delete, website preview, image/PDF canvas.
2. Read docs/tdr/0004-*, docs/spec/09-Snapshot-Engine.md,
   docs/spec/10-Revision-Recovery.md, docs/implementation/00-index.md.
3. Fix:
   - Page management: add/rename/reorder/remove with authorization,
     typed updates, audit events, deep-link URL behavior.
   - Deploy/version history: confirm the data model matches existing
     revision/recovery data — don't duplicate revision truth.
   - Duplicate: default to copying metadata/settings/pages only, not
     comments/history, unless already decided otherwise.
   - Export: typed/permission-checked per M-08.
   - Delete: gated on M-03 safety — verify, don't assume.
   - Website preview: loading/timeout/retry/failed-frame diagnostics.
   - Image/PDF canvas: zoom/rotation/page nav/download, region-comment
     coordinate transforms across zoom/rotation, keyboard equivalents,
     resource cleanup (revoke object URLs, abort stale fetches).
4. Preserve section 2/6 rules.
5. Verify no crash: lint/typecheck/build; manually exercise page
   add/rename/reorder, duplicate, version menu, and canvas zoom/rotate/nav.
6. Do not touch other workstreams. Do not commit/push.

Report: what changed, build/lint result. Save as
docs/implementation/audit-batch-06-report.md.
```

---

## Batch 7 — Comments/threads (M-15)

```
Attached: backline-Final Draft.html and BACKLINE-MASTER-HTML-INTEGRATION-AUDIT.md.

Scope: M-15 (section 5), ledger IDs FD-AUD-027..031, UX-AUD-047..055
(section 10).

First read: docs/implementation/audit-batch-00-report.md,
audit-batch-01-report.md (M-02), audit-batch-05-report.md,
audit-batch-06-report.md.

Do NOT write test suites. Implementation + verification only:
1. Re-verify current tree for CommentsTab.tsx structure, attachment
   lifecycle, mention handling, move/resize, undo.
2. Read docs/tdr/0004, 0006, 0007, docs/implementation/00-index.md.
   Note: TDR-0006 — widget doesn't render existing comments as pins and
   has no WS event for layer changes (client<->team). Don't assume
   these are solved.
3. Fix:
   - Split oversized CommentsTab.tsx into components/hooks; reuse
     canonical workflow-status/layer components (no label drift).
   - Filters/thread detail URL-owned; thread deep link survives reload.
   - Attachments: upload progress/retry/preview/delete/signed reads;
     screenshot failure never blocks comment posting.
   - Mentions: real tokenization, stable member IDs, dedup, permission
     checks, notification emission (verify Batch 3 landed — it did).
   - Move/resize/reanchor: dedicated typed endpoint, clamp geometry,
     detect stale/concurrent edits, audit + realtime cache update.
   - Undo/redo: only if a safe server-side inverse exists; otherwise
     skip — don't fake local-only history.
4. Preserve section 2/6 rules — dedupe optimistic creation vs
   comment.created events.
5. Verify no crash: lint/typecheck/build; manually post a comment,
   attach a file, mention someone, move a pin, check for duplicates.
6. Do not touch other workstreams. Do not commit/push.

Report: what changed, build/lint result. Save as
docs/implementation/audit-batch-07-report.md.
```

---

## Batch 8 — Tickets/board/calendar (M-16)

```
Attached: backline-Final Draft.html and BACKLINE-MASTER-HTML-INTEGRATION-AUDIT.md.

Scope: M-16 (section 5), ledger IDs FD-AUD-032..035, UX-AUD-056..060
(section 10).

First read: docs/implementation/audit-batch-00-report.md,
audit-batch-05-report.md.

Binding constraint: TDR-0012 requires tickets to extend comments, not a
separate collection. Verify this is still true before editing.

Do NOT write test suites. Implementation + verification only:
1. Re-verify current tree for TicketsPage.tsx, list/board/table/
   calendar views, drag/drop, `?comment=<id>` deep-link state.
2. Read docs/tdr/0005, 0012, docs/implementation/00-index.md — TDR-0005
   (URL-owned filters) is binding, not optional.
3. Fix:
   - Single workflow-status source of truth across comments/board/
     tickets/widget.
   - Split TicketsPage.tsx into components/data hooks.
   - `?comment=<id>` bidirectional URL<->UI state, not seeded once.
   - Drag/drop: optimistic update + rollback + audit event, plus a
     keyboard/menu equivalent (never pointer-only).
   - Accessible date picker: Today/Clear/nav, locale-aware, timezone-safe.
   - Clickable rows/cells, exact ticket-detail route/not-found behavior.
4. Preserve section 2/6 rules.
5. Verify no crash: lint/typecheck/build; manually drag a card, use the
   keyboard equivalent, open a ticket via deep link and via UI click.
6. Do not touch other workstreams. Do not commit/push.

Report: what changed, build/lint result. Save as
docs/implementation/audit-batch-08-report.md.
```

---

## Batch 9 — Clients/activity/members/integrations (M-17)

```
Attached: backline-Final Draft.html and BACKLINE-MASTER-HTML-INTEGRATION-AUDIT.md.

Scope: M-17 (section 5), ledger IDs FD-AUD-036..038, UX-AUD-061..064
(section 10).

First read: docs/implementation/audit-batch-00-report.md,
audit-batch-01-report.md. Re-verify the integrations
require_workspace_match fix yourself.

Do NOT write test suites. Implementation + verification only:
1. Re-verify current tree for client summary table, action menu,
   activity filters/grouping, member invite/role/removal, integrations.
2. Read docs/spec/17-Notifications-Integrations.md,
   docs/spec/11-Database.md, docs/implementation/00-index.md.
3. Fix:
   - Client stats as repository aggregations, not duplicated columns;
     archive/recovery confirmation; export only when permission-safe.
   - Activity: Everything/Mine/Clients/Deploys filters, Today/Yesterday/
     Earlier grouping, exact destinations — rendering of append-only
     events, not a parallel store.
   - Members/integrations: honest provider states, secret masking,
     test-connection/error/retry, disconnect audit.
4. Preserve section 2/6 rules.
5. Verify no crash: lint/typecheck/build; manually check client list,
   activity feed filters, and an integration connect/disconnect flow.
6. Do not touch other workstreams. Do not commit/push.

Report: what changed, build/lint result. Save as
docs/implementation/audit-batch-09-report.md.
```

---

## Batch 10 — Accessibility + React Query resilience (M-19, M-20)

```
Attached: backline-Final Draft.html and BACKLINE-MASTER-HTML-INTEGRATION-AUDIT.md.

Scope: M-19, M-20 (section 5), ledger IDs UX-AUD-001..007/071..084
(section 10).

First read: docs/implementation/audit-batch-00-report.md through
audit-batch-09-report.md (whichever exist). Cross-cutting pass —
re-verify what actually landed, don't trust prior self-reports blindly.

Do NOT write test suites. Implementation + verification only:
1. Run: rg -n "queryKey:\s*\[|invalidateQueries|setQueryData|refetchInterval" apps/web/src
   Find ad-hoc query keys, duplicate comment-upsert logic, whole-
   workspace invalidation for narrow mutations, unneeded polling.
2. Read docs/spec/14-State-Management.md, docs/spec/15-Design-System.md,
   docs/tdr/0005, docs/tdr/0006, docs/implementation/00-index.md.
3. Fix:
   - Expand central query-key factory; remove ad-hoc keys; shared
     cache merge/upsert helpers for comment events with optimistic-ID
     reconciliation.
   - Narrow mutation invalidation; per-surface loading/error/skeleton
     states; debounced+cancellable search; safe error boundaries
     (correlation ID only, never PII/secrets).
   - connectionStore.ts/presenceStore.ts are accepted (TDR-0006) — do
     NOT flatten/delete them.
   - Accessibility: one component API (reduce backline.css bl-* toward
     tokens), one icon library, StatusBadge/LayerBadge with label+icon+
     color, decided dark-mode contract, skip link, landmarks, one H1 per
     page, focus-visible, reduced-motion, keyboard completion, board/pin
     drag keyboard alternative.
4. Preserve section 2/6 rules.
5. Verify no crash: lint/typecheck/build; manually check dark mode,
   keyboard-only navigation on one board screen, and that switching
   screens doesn't leave stale/duplicated data.
6. Do not touch other workstreams. Do not commit/push.

Report: what changed, build/lint result. Save as
docs/implementation/audit-batch-10-report.md.
```

---

## Batch 11 — Security/regression manual verification (M-09, lightweight)

```
Attached: backline-Final Draft.html and BACKLINE-MASTER-HTML-INTEGRATION-AUDIT.md.

Scope: M-09 (section 5), ledger IDs FD-AUD-052/053 (section 10) —
verification pass only, no new automated test suites.

First read: docs/implementation/audit-batch-00-report.md through
audit-batch-10-report.md (whichever exist). Re-verify the P0 backend
fixes (batches 1, 2, 3) are actually present in the current code.

Do:
1. Manually verify (by reading code and exercising the app, not by
   writing test files):
   - Cross-workspace token cannot access another workspace's routes.
   - Guest cannot see team-only data (counts, presence, assignee/due,
     internal notifications, export).
   - Revoked/expired/passcode/domain-restricted share links are rejected.
   - Empty guest name is rejected under ask-name policy.
   - Guest cannot PATCH/DELETE pages.
   - Session-family revoke only works for the owning user.
   - CSV export doesn't produce live formula cells.
   - Hard-delete leaves no orphaned data (spot-check one real delete).
2. Run the full existing tooling gate (no new tests, just run what
   exists): lint, typecheck, build for frontend and backend, ruff/mypy/
   pytest for backend using whatever suites already exist.
3. If anything fails or a gap is found, fix the code directly — do not
   write a new regression test for it, just make it correct and note it
   in the report.
4. Do not commit/push.

Report: pass/fail per item above, any code fixes made, and whether
lint/typecheck/build/existing pytest are green. Save as
docs/implementation/audit-batch-11-report.md.
```

---

## Batch 12 — CI/OpenAPI/docs reconciliation + P2 polish (M-21, M-22)

```
Attached: backline-Final Draft.html and BACKLINE-MASTER-HTML-INTEGRATION-AUDIT.md.

Scope: M-21, M-22 (section 5), ledger IDs FD-AUD-043/044/054
(section 10). Runs last, after Batch 11.

First read: docs/implementation/audit-batch-00-report.md through
audit-batch-11-report.md (whichever exist).

Do NOT write new test suites. Implementation + verification only:
1. Re-verify current tree and CI config.
2. Regenerate OpenAPI types and confirm no uncommitted drift; fix any
   workspace-scoping lint script path drift so it actually runs.
3. Update docs/implementation/02-flow-matrix.md and 06-delivery.md with
   real status/evidence per section — never mark unwired scaffolding
   "delivered".
4. Reconcile stale docs: Review SDK projectToken vs share-link auth TDR,
   R2 screenshot {comment_id} vs UUID-key decision, board-Zustand wording
   vs URL-params TDR, recovery orchestration prose vs diff/anchor TDR
   separation. File a dated TDR note for any real divergence found across
   all prior batches (client digest setting, re-anchor toggle setting,
   mentions superseding TDR-0009).
5. P2 polish: desktop gate decision recorded, coming-soon copy honesty,
   AI/billing remain explicit non-functional placeholders — do NOT
   implement fake credits/checkout, this is a hard rule, not optional.
6. Verify no crash: run lint/typecheck/build across the whole repo one
   final time.
7. Do not commit/push.

Report: final Definition-of-Done checklist (section 8) item by item with
evidence, list of new TDRs filed, confirmation every ledger ID in
section 10 has a final status. Save as
docs/implementation/audit-batch-12-report.md.
```
