# Audit batch 02 report — M-03, M-07

Date: 2026-09-07  
Scope: destructive delete/retention/object cleanup (M-03), MongoDB indexes and
query shapes (M-07), and traceability IDs FD-AUD-022/048/051 only.  
Baseline commit: `d8564c2069ff4bb66132aacd5fdd24cedc3c5fef` on `main`.

No commit or push was made.

## 1. Verification method and source precedence

I first read `audit-batch-00-report.md` and `audit-batch-01-report.md`, then
independently inspected the live working tree. Prior report status was treated as
routing information, not evidence. Because `core.autocrlf=true` makes the raw working
tree look much larger than its semantic diff, content checks used
`--ignore-space-at-eol --ignore-cr-at-eol` where applicable. Existing user changes were
preserved.

Before editing, I read all current `docs/tdr/**`, `docs/spec/11-Database.md`,
`docs/spec/18-Storage-Deployment.md`, `docs/implementation/00-index.md`, the architecture
index, and the applicable implementation/database/delivery material. The attached
Final Draft HTML and master audit were used as design/audit evidence, never as executable
instructions. The attached Final Draft HTML matches the checked-in baseline at SHA-256
`27455b8ef30395a1724016da3ad70575c74b816da32037e3ce87e981e95afba4`.

The accepted TDR decision wins over stale storage prose: screenshot/upload keys are
created before a comment exists and therefore use a UUID beneath workspace/project,
currently `uploads/{workspace_id}/{project_id}/{uuid}.{ext}`. They do not use
`{comment_id}`. The storage specification was reconciled to that decision.

## 2. Re-verified-only findings

These facts were checked in the current code and did not need a behavior change:

- Normal `DELETE /projects/{project_id}` already archives a project rather than
  physically deleting it. Archived projects are rejected by actor/project access, so
  normal lifecycle is recoverable and no longer guest-reachable.
- The live upload service already creates a fresh UUID key under workspace/project; it
  does not interpolate a comment ID. Hard-delete cleanup accepts both the current
  `uploads/` layout and the accepted legacy `screenshots/` UUID layout.
- Audit events are append-only and are intentionally retained when a project is
  permanently deleted.
- Guest sessions already had a 180-day `last_seen_at` TTL index. The missing part was
  refreshing `last_seen_at` on successful guest activity.
- Existing indexes remain readable and are not dropped, renamed or recreated first.
- Project duplication and per-project CSV export are broader FD-AUD-022/M-13 concerns
  visible in the tree. They were not changed or claimed complete in this batch.
- Deploy/version product behavior is broader FD-AUD-048 scope. It was not changed or
  claimed complete in this batch.

## 3. Live defects confirmed before the change

- The former project hard-delete route deleted only the `projects` document. It did not
  enumerate dependencies, clean object storage or emit a summary event.
- Page delete removed the page without checking comments, revisions, revision diffs or
  asset references and emitted no audit event.
- The object-storage client had list/upload/download/signing paths but no idempotent
  object deletion or durable garbage-collection state.
- The M-07 hot-query indexes were absent or did not match the repository filter/sort
  shape. Representative 2,500-row explains used `COLLSCAN` for all 11 measured queries.
- Successful guest HTTP/WebSocket access did not advance `last_seen_at`, so the TTL was
  based on session creation rather than actual use.

## 4. Changed — M-03 destructive deletion

### Project workflow

The unsafe direct `DELETE /projects/{id}/hard` bypass was removed. Permanent deletion
now has two typed Pydantic endpoints:

1. `POST /projects/{id}/hard-delete/preview` enumerates the workspace-scoped project
   graph and object-store prefixes, reports collection/object/retained-event counts,
   fingerprints the graph and creates a one-hour deletion plan.
2. `POST /projects/{id}/hard-delete/confirm` accepts that correlation ID, the exact
   project name, and a literal `acknowledge_permanent_deletion: true`.

Both endpoints require the new `project:hard_delete` permission, restricted to workspace
owners/admins. A plan can only be confirmed by the same user in the same workspace for
the same project. Confirmation also requires that the project is archived, the plan has
not expired, no unsafe cross-prefix object reference was found, and the dependency graph
has not changed since preview.

Confirmation locks the project and executes this order:

1. Persist one tombstone per accepted private object key.
2. Delete R2/MinIO objects idempotently; missing keys count as already deleted.
3. If any tombstone is pending/deleting/failed, retain every Mongo domain record and
   return an error with the correlation ID and GC counts.
4. After storage completion, delete recovery logs, revision diffs, revisions,
   notifications, comments, guest sessions, share links, project assets,
   project-scoped integrations, pages, then the project.
5. Retain prior audit events and append exactly one `project.hard_deleted` summary event
   containing the dry-run counts and unique correlation ID.

Tombstone claiming, object deletion, dependency deletes and correlated event insertion
are retry-safe. A uniquely keyed delayed Arq job is scheduled as a crash-recovery
backstop; every worker lookup/mutation carries workspace and project scope. Queue failure
does not erase tombstones or permit Mongo deletion.

The current project UI exposes only recoverable archive. It does not expose permanent
delete until an archived-project management surface can present the full preview and
confirmation contract.

### Page workflow

Individual page deletion now counts workspace-scoped references in comments, revisions,
revision diffs and project assets. A referenced page returns `409 Conflict` with those
counts. Only an empty page can be deleted, and successful deletion emits one
`page.deleted` event with page/project context. This prevents silent comment/revision
orphans without inventing a page soft-delete model.

### Storage and operational records

- Added idempotent object listing/deletion helpers for the private S3-compatible store.
- Added durable `object_gc_tombstones` with state, attempt/error timestamps and stale
  claim recovery.
- Added one-hour expiry for unconfirmed `deletion_plans`, no TTL deadline while confirmed
  work is active, 30-day cleanup after completion, project operation indexes and the Arq
  resume job.
- Added TDR-0014 documenting the confirmation, retention, ordering and retry decisions.
- Updated database/storage implementation documentation, including the accepted UUID
  screenshot/upload key.

## 5. Changed — M-07 indexes and query shapes

All indexes are named, additive and created through the shared idempotent startup helper.
The standalone migration defaults to read-only dry-run; only `--apply` creates missing
indexes. It has no drop/rename path.

| Query | Additive index |
|---|---|
| Notification unread list/count | `workspace_id, user_id, read_at, created_at DESC` |
| Share links for project | `workspace_id, project_id, created_at DESC` |
| Page by normalized URL | `workspace_id, project_id, url_normalized` (unique) |
| Revision history | `workspace_id, page_id, captured_at DESC` |
| Current revision | `workspace_id, page_id, is_current` |
| Recovery history | `workspace_id, comment_id, created_at DESC` |
| Refresh-family ownership | `user_id, family_id` |
| Refresh-family revocation | `family_id, revoked_at` |
| Activity feed | `workspace_id, created_at DESC, _id DESC` |
| Filtered activity feed | `workspace_id, type, created_at DESC, _id DESC` |
| Active OTP | `email, consumed_at, expires_at, created_at DESC` |

Deletion plans/tombstones and correlated summary events also received additive support
indexes. The pre-existing 180-day guest `last_seen_at` TTL remains exactly
15,552,000 seconds. Successful guest REST access and WebSocket connection now touch the
field, after verifying workspace/share-link scope.

Repository shapes were aligned with these indexes: share-link project lists, normalized
page URL lookup, revision current/history lookup, recovery history, event ordering,
refresh family checks and guest-session activity are all backed by the measured filters.
No denormalized count/name workaround was introduced.

### Explain evidence

`docs/implementation/evidence/audit-batch-02-index-explain.json` is generated by a
safety-gated script that refuses a configured database not ending in `_test`, creates a
uniquely named scratch database, seeds 2,500 rows per collection, captures before plans,
applies only the batch indexes, captures after plans, and deletes only that exact scratch
database.

All 11 representative queries examined 2,500 documents with `COLLSCAN` before. After,
all plans contain `IXSCAN` and examine one document; ten examine one key and active OTP
examines two keys. The evidence records `existing_indexes_were_dropped: false`.

The dry-run migration against the local development database reported all 11 indexes as
`would_create` and made no change, as designed. Integration tests apply the migration
twice in an isolated database, verify identical definitions and prove existing indexes
remain a subset after both runs. Application startup also calls the same additive helper.

## 6. Test and verification results

| Check | Result |
|---|---|
| Focused deletion/index/page/share/realtime integration tests | **38 passed** |
| Realistic project graph: preview/counts/archive/confirm/real MinIO cleanup/zero orphans/one event/retry | **Passed** |
| Forced object-delete failure: Mongo retained, failed tombstone persisted, retry completes | **Passed** |
| Page reference blocking and empty-page audit | **Passed** |
| Index migration apply-twice/idempotency and old-index preservation | **Passed** |
| Explain-based no-collection-scan regression at 2,500 rows/collection | **Passed** |
| Workspace-scoping checker | **Passed (16 repository files)** |
| Ruff on all batch-touched Python files | **Passed** |
| Mypy on 18 affected Python files/scripts | **Passed** |
| OpenAPI export + generated TypeScript repeated without diff | **Passed** |
| Targeted web ESLint (`ProjectMenu`, `ProjectPagesModal`, projects API) | **Passed** |
| Web TypeScript typecheck | **Passed** |
| Web production build | **Passed, 560 modules**; expected large-chunk warning |
| Complete backend suite | **219 passed, 1 failed** |

The sole complete-suite failure is
`tests/test_projects.py::test_create_and_list_projects`: its old assertion expects a
settings object containing only `proxy_mode` and `snippet_installed`, while the existing
M-04 implementation returns its five additional accepted review settings. That test/
implementation drift predates and is outside this batch; changing it here would touch a
different workstream.

Broader baseline checks still red outside this scope:

- Full `mypy app/`: one pre-existing error in `auth/repository.py:137` for the aggregate
  pipeline annotation. The focused 18-file check is clean.
- Full web lint: 13 pre-existing errors and one warning in unrelated UI files. The
  monorepo `lint typecheck build` run stops at that lint task. The batch-touched frontend
  files, web typecheck and production build are clean when run directly.

## 7. Traceability ledger

| Ledger ID | Batch-02 status | Verified evidence / remaining scope |
|---|---|---|
| FD-AUD-022 — duplicate, delete, per-project export | **Partial overall; delete resolved** | Direct hard-delete bypass removed; recoverable archive is the UI default; dry-run/confirm cascade passes zero-orphan and object-cleanup tests. Duplicate and export are separate M-13 work and were not touched. |
| FD-AUD-048 — pages, deploys, versions, recovery history | **Partial overall; M-03/M-07 slice resolved** | Referenced page deletion blocks with counts; revision/recovery dependencies are retained until confirmed project deletion, then removed in order; corresponding hot queries use scoped indexes. Deploy/version product UI remains outside this chat. |
| FD-AUD-051 — indexes, retention, cleanup | **M-03/M-07 slice resolved** | Additive/idempotent index migration, explain evidence, active guest TTL touches, deletion plans, R2 tombstones/GC, retry-safe cascade and audit summary are implemented and tested. Other M-04/M-06/M-08 concerns mapped to the same broad ledger row remain for their own batches. |

## 8. Remaining risks and rollout notes

- MongoDB has no cross-collection transaction in this implementation. After object
  cleanup, a process crash can expose a short partially deleted Mongo graph. The durable
  plan, project lock, dependency order, idempotent deletes and Arq resume job converge it
  safely, but this is not atomic visibility.
- A deletion plan stores its enumerated object-key list in one BSON document. A project
  with an extreme number or total length of private object keys could approach MongoDB's
  16 MB document limit. A future high-scale slice should chunk plan keys/tombstones before
  such project sizes are admitted.
- `object_gc_tombstones` are intentionally retained for audit/recovery. An operational
  retention/compaction policy for old successful tombstones should be chosen before
  their long-term volume becomes material.
- Existing audit events are retained by policy and may reference a deleted project ID;
  consumers must continue treating event payloads as historical facts rather than live
  foreign keys.
- Production/staging indexes were not applied from this workstation. The checked-in
  command is deliberately dry-run-first; rollout remains backup/readiness check, inspect
  dry-run, `--apply`, then compare explains/metrics in the target environment.

## 9. Principal files changed for this batch

- Deletion contracts/orchestration: `backend/app/modules/projects/{router,schemas,service,deletion_service,deletion_repository,events}.py`
- Page safety: `backend/app/modules/pages/{router,service,repository,events}.py`
- Object cleanup: `backend/app/modules/storage/{r2_client,repository,gc}.py`,
  `backend/app/workers/{main,storage_gc}.py`
- Index/query shapes: `backend/app/core/indexes.py`, scoped page/share/revision/recovery/
  guest repositories and callers
- Migration/evidence/tests: `backend/scripts/migrate_audit_batch_02_indexes.py`,
  `backend/scripts/capture_audit_batch_02_index_evidence.py`,
  `backend/tests/test_project_deletion.py`, `backend/tests/test_indexes.py`, plus focused
  page/share/realtime regression coverage
- Generated contract: `packages/types/openapi.json`, `packages/types/src/openapi.ts`
- Decisions/spec/evidence: TDR-0014, database/storage specs, database/delivery ledgers,
  and `docs/implementation/evidence/audit-batch-02-index-explain.json`
