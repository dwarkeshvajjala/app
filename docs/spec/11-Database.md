# 11 - Database (MongoDB)

All collections are workspace-scoped except `users` and `workspaces` themselves (`03-System-Architecture.md` §3.5). Every collection below lists: fields, indexes, and any TTL.

## 11.1 `workspaces`

```
{
  _id, name, slug (unique),
  plan: "free" | "pro" | "agency",     // exists from day one; unenforced pre-billing
  branding_json: { logo_url?, primary_color? },   // v-next white-label hook, unused in MVP
  created_at, updated_at
}
```
Indexes: `{ slug: 1 }` unique.

## 11.2 `users`

Agency members only - guests are never in this collection.
```
{
  _id, email (unique), name, avatar_url?,
  auth_providers: ["google", "email_otp"],
  created_at, last_login_at
}
```
Indexes: `{ email: 1 }` unique.

## 11.3 `memberships`

```
{
  _id, user_id, workspace_id,
  role: "owner" | "admin" | "member",
  invited_by?, created_at
}
```
Indexes: `{ workspace_id: 1, user_id: 1 }` unique compound; `{ user_id: 1 }`.

## 11.4 `projects`

```
{
  _id, workspace_id, name,
  target_origin,                 // the reviewed site's base URL
  settings_json: { proxy_mode: bool, snippet_installed: bool },
  archived_at?,                   // soft-archive (12-API-WebSocket.md §12.3's DELETE /projects/{id});
                                  // never a hard delete, so archived projects stay auditable
  created_at, updated_at
}
```
Indexes: `{ workspace_id: 1 }`. `archived_at` was implied by §12.3's "archive" semantics for
`DELETE /projects/{id}` but missing from the original field list - added per the
"no silent drift" rule (`00-README.md`). Archived projects are excluded from the default
project list but remain individually fetchable.

## 11.5 `share_links`

```
{
  _id, project_id, workspace_id, token (unique),
  mode: "snippet" | "proxy",
  passcode_hash?, expires_at?, revoked_at?,
  created_by, created_at
}
```
Indexes: `{ token: 1 }` unique; `{ project_id: 1 }`. TTL: none (expiry is application-enforced via `expires_at` check, not a Mongo TTL delete - expired links must remain queryable for audit history).

## 11.6 `guest_sessions`

```
{
  _id, share_link_id, workspace_id,
  display_name, email?,
  ua_fingerprint, created_at, last_seen_at
}
```
Indexes: `{ share_link_id: 1 }`; TTL on `last_seen_at` at 180 days (guest identity is lightweight and doesn't need indefinite retention; comments themselves are retained regardless - only the *session* record expires).

## 11.7 `pages`

```
{
  _id, project_id, workspace_id,
  url_normalized (unique per project), title,
  first_seen_at, latest_revision_id
}
```
Indexes: `{ project_id: 1, url_normalized: 1 }` unique compound.

## 11.8 `revisions`

```
{
  _id, page_id, workspace_id,
  snapshot_key,          // R2 pointer to full snapshot JSON (09-Snapshot-Engine.md §9.5)
  full_page_hash,
  captured_at, is_current: bool
}
```
Indexes: `{ page_id: 1, captured_at: -1 }`; `{ page_id: 1, is_current: 1 }`.

## 11.9 `revision_diffs`

```
{
  _id, page_id, workspace_id,
  from_revision_id, to_revision_id,
  moved_node_ids: [...], modified_node_ids: [...],
  removed_node_ids: [...], added_node_ids: [...],
  created_at
}
```
Indexes: `{ page_id: 1, to_revision_id: 1 }`.

## 11.10 `comments`

The central document. Anchor and context are embedded (read together far more often than separately).
```
{
  _id, page_id, workspace_id, parent_id?,           // parent_id for threaded replies
  author_type: "member" | "guest",
  author_member_id?, author_guest_id?,
  layer: "client" | "team",
  body, status: "todo" | "in_progress" | "resolved" | "wont_fix",
  assignee_id?, due_at?,
  anchor: { ... },                 // shape in 08-Anchor-Engine.md §8.1
  recovery_status: "ok" | "low_confidence" | "orphaned" | "permanently_orphaned",
  context_json: { browser, os, viewport, device_type, url },
  screenshot_key?, capture_status: "ok" | "failed",
  created_at, edited_at?
}
```
Indexes: `{ page_id: 1, status: 1 }`; `{ workspace_id: 1, assignee_id: 1 }`; `{ parent_id: 1 }`; `{ workspace_id: 1, layer: 1 }` (supports the server-side visibility filter - never a client-side hide, per F3's acceptance criterion in the vision doc).

**Server-side enforcement note:** the repository's `list_for_guest_session()` method has `layer: "client"` hard-coded into the query filter - there is no parameter that lets a caller ask for `team` layer comments on behalf of a guest session. This is the concrete implementation of "a client session can never render, fetch, or receive team-only content," not a UI-level hide.

## 11.11 `recovery_logs`

```
{
  _id, comment_id, workspace_id,
  from_revision_id, to_revision_id,
  strategy_used, confidence, candidates_considered, outcome,
  created_at
}
```
Indexes: `{ comment_id: 1, created_at: -1 }`.

## 11.12 `integrations`

```
{
  _id, workspace_id, type: "slack" | "clickup" | "trello" | "asana",
  config_json: { webhook_url? , oauth_token_encrypted?, list_id? },
  project_scope?,      // null = workspace-wide
  connected_by, created_at
}
```
Indexes: `{ workspace_id: 1, type: 1 }`.

## 11.13 `events`

Append-only audit log (`06-Backend-Architecture.md` §6.6).
```
{
  _id, workspace_id, type,          // e.g. "comment.created", "member.role_changed"
  actor_type: "member" | "guest" | "system",
  actor_id?, payload_json, created_at
}
```
Indexes: `{ workspace_id: 1, created_at: -1 }`; `{ type: 1, created_at: -1 }`. TTL: none - this is the audit trail, retained indefinitely (or per a future data-retention policy TDR).

## 11.14 `refresh_tokens`

Referenced by `13-Authentication.md` §13.1/§13.6 but not enumerated in the original collection list - added here per the "no silent drift" rule (`00-README.md`). Not `users`/`workspaces`-scoped by tenant (a refresh token belongs to a `user`, not a workspace - a member switches workspace context via a new access JWT, `13-Authentication.md` §13.3, without re-authenticating).

```
{
  _id, user_id, token_hash,          // sha256 of the opaque refresh token; raw token never stored
  family_id,                          // shared across all tokens descended from one login, for theft detection
  issued_at, expires_at, revoked_at?,
  replaced_by_token_hash?            // set when rotated, so reuse-of-a-rotated-token is detectable
}
```
Indexes: `{ token_hash: 1 }` unique; `{ user_id: 1 }`; TTL on `expires_at` (Mongo TTL index - once expired, both the row and its ability to authenticate are gone).

**Rotation/theft-detection note:** `POST /auth/refresh` looks up by `token_hash`. If the row is `revoked_at`-set (already rotated once), every other non-revoked token sharing that `family_id` is revoked immediately (`13-Authentication.md` §13.6's "reuse of an already-rotated token immediately revokes the whole session family").

## 11.15 `otp_codes`

Referenced by `13-Authentication.md` §13.2, not enumerated in the original collection list - same amendment basis as §11.14.

```
{
  _id, email, code_hash,             // sha256 of the 6-digit code; raw code never stored
  attempts: int,                      // incremented per failed verify; capped at 5 (13-Authentication.md §13.2)
  expires_at, consumed_at?,
  created_at
}
```
Indexes: `{ email: 1, created_at: -1 }`; TTL on `expires_at`.

## 11.16 Key Aggregations

**Kanban board counts per project** (drives the board header without a separate count query per column):
```python
await db.comments.aggregate([
    {"$match": {"workspace_id": ws_id, "page_id": {"$in": page_ids}}},
    {"$group": {"_id": "$status", "count": {"$sum": 1}}}
])
```

**Agency triage throughput check** (used to validate the "50 comments in 10 minutes" success metric during testing, `01-Product-Vision.md` §1.10): time-delta between `comment.created` and `comment.status_changed` events for a given actor, from `events`.

**Recovery health dashboard** (v-next, but schema already supports it): success-rate of recoveries over time from `recovery_logs`, grouped by `strategy_used`.
