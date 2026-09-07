# TDR-0014: Dry-run project deletion and durable object garbage collection

Date: 2026-09-07
Status: Accepted

## Context

The Final Draft audit found that direct project hard-delete removed only the
`projects` document, while page deletion could remove a page still referenced by
comments, revisions, recovery history, assets, notifications, guest sessions and
private objects. Normal lifecycle already uses reversible project archiving.

## Decision

- Archiving remains the normal deletion action and the only destructive action shown
  in the current project UI.
- Permanent deletion is owner/admin-only and requires a server-generated dry-run made
  by the same user within the previous hour. Confirmation requires the exact project
  name, explicit acknowledgement, an archived project and an unchanged dependency graph.
- Confirmation locks the project, creates durable `object_gc_tombstones`, deletes all
  object keys under accepted project prefixes, and only then deletes Mongo records in
  dependency order. Storage failure leaves Mongo intact and tombstones retryable by Arq.
- Project audit history is retained. Completion emits one `project.hard_deleted` event
  with dry-run counts and a unique correlation ID; retries cannot duplicate it.
- Individual page deletion is allowed only with no comments, revisions, revision diffs
  or project-asset reference. Otherwise it reports a conflict with reference counts.

Accepted object prefixes include the UUID screenshot layout
`screenshots/{workspace_id}/{project_id}/{uuid}` and the current generalized upload
layout `uploads/{workspace_id}/{project_id}/{uuid}`. Snapshot keys remain
`snapshots/{project_id}/{revision_id}/snapshot.json.gz`; project IDs are globally
unique. A document pointing outside these prefixes blocks hard deletion rather than
risk deleting another tenant's object.

## Consequences

Unconfirmed `deletion_plans` expire after one hour. Confirmation removes the plan's TTL
deadline while work is active so a prolonged storage outage cannot erase resume state;
completed plans are purged after 30 days. `object_gc_tombstones` is retained as auditable
cleanup state and indexed uniquely by bucket/key. The operation is
retry-safe across object deletion, dependency deletion and summary-event insertion.
Mongo deployments without multi-document transactions can still expose a short
partially-deleted interval after storage cleanup if the process crashes; the persisted
plan and idempotent worker resume from that state rather than treating it as complete.
