# Database evolution and optimization

MongoDB remains the system of record. Keep private files in object storage, not BSON/base64. Keep existing TTLs for sessions/OTP/refresh tokens. No collection drops, blanket rewrites or production-data resets.

## Additive schema

| Collection | Changes | Existing document behavior |
|---|---|---|
| projects | `project_type` (website/image/pdf), `environment` (live/staging), nullable `client_id` | website/live/no client defaults |
| clients | workspace_id, name, contact_name, email, created_by, created_at, updated_at, archived_at | new collection |
| comments | in_review/blocked statuses, priority, tags, assignee_ids, waiting_on_ids, waiting_on_client, project_id, standalone marker | defaults; derive assignee_ids from legacy assignee_id; old pages remain valid |
| events | keep append-only format | dashboard projects safe fields only |
| project assets (subsequent slice) | object key, verified MIME/size, project/version/page identity | no data URI or public bucket |

Root comments and standalone tickets share one source of truth; replies are never independent tickets. Asset regions must use normalized geometry plus immutable asset version, separate from website DOM fingerprint semantics. Legacy `wont_fix` remains closed. `assignee_id` mirrors the first assignee for older consumers; new consumers read arrays.

## Query-driven indexes

- Projects: workspace_id, archived_at, created_at/_id for listing; workspace_id/client_id for client association.
- Clients: workspace_id, archived_at, name/_id.
- Root tickets: workspace_id, deleted_at, parent_id, created_at/_id; additional status/due index and assignee_ids multikey index (one array per compound index).
- Project comment joins: workspace_id, page_id, deleted_at, parent_id.
- Activity: existing workspace_id/created_at plus deterministic _id pagination ordering.

Index creation stays idempotent at startup. Add indexes; do not drop existing ones without an explain-plan comparison. Counts use aggregation before object-storage URL signing; list projections should avoid large anchor/snapshot blobs. Pagination applies before enriching author/page/project metadata. Never claim a speedup without measurements.

## Migration and rollback

Read defaults make additive deployment safe. Provide an explicit idempotent dry-run-first backfill for new fields if needed; retain old fields and status values. Rollout: backup → staging index creation/backfill → API with old-compatible fields → regenerated frontend/widget → targeted tenant/privacy checks. Rollback frontend first; retained old fields let prior API readers continue working. Do not execute a backfill against production automatically. Test databases must be explicitly local/isolated; inspect settings without exposing secrets before any destructive test fixture runs.
