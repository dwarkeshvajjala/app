# 12 - API & WebSocket Specification

Base path: `/api/v1`. All responses JSON. All mutating endpoints require either a member JWT (`Authorization: Bearer ...`) or a guest session token (`X-Guest-Session: ...`), depending on the endpoint - noted per row below.

## 12.1 Auth

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/google/callback` | none | Exchange Google OAuth code for a member JWT |
| POST | `/auth/otp/request` | none | Send email OTP |
| POST | `/auth/otp/verify` | none | Verify OTP -> member JWT |
| POST | `/auth/refresh` | refresh token | Rotate access token |
| POST | `/auth/logout` | member JWT | Invalidate refresh token |

## 12.2 Workspaces & Members

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/workspaces` | member | List workspaces the member belongs to |
| POST | `/workspaces` | member | Create workspace (creator becomes `owner`) |
| GET | `/workspaces/{id}` | member (any role) | Workspace detail |
| PATCH | `/workspaces/{id}` | member (`admin`+) | Update settings |
| GET | `/workspaces/{id}/members` | member | List members |
| POST | `/workspaces/{id}/members/invite` | member (`admin`+) | Invite by email |
| PATCH | `/workspaces/{id}/members/{member_id}` | member (`admin`+) | Change role |
| DELETE | `/workspaces/{id}/members/{member_id}` | member (`admin`+) | Remove member |

## 12.3 Projects, Share Links, Pages

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET/POST | `/workspaces/{id}/projects` | member | List/create projects |
| GET/PATCH/DELETE | `/projects/{id}` | member | Project detail/update/archive |
| GET/POST | `/projects/{id}/share-links` | member | List/create share links |
| PATCH | `/share-links/{id}/revoke` | member | Revoke a link |
| GET | `/review/{share_token}` | none (public, rate-limited) | Resolve a share link -> project/page bootstrap data |
| POST | `/guest-sessions` | share token | Create guest session (display name only) |
| GET | `/projects/{id}/pages` | member | List registered pages |
| POST | `/pages` | guest session or member | Register a page (idempotent on `url_normalized`) |
| POST | `/pages/{page_id}/snapshots` | guest session or member | Submit a captured Normalized DOM Snapshot (`09-Snapshot-Engine.md`) - creates a new `revision` only if `full_page_hash` differs from the page's current one, otherwise a no-op that returns the existing revision. Not enumerated in the original endpoint table - added per the no-silent-drift rule (`00-README.md`); `09-Snapshot-Engine.md` describes the snapshot shape and storage strategy but never named the submission endpoint. |
| POST | `/uploads` | member or guest | Get a pre-signed R2 PUT URL for a screenshot. Body: `{ project_id, content_type }` - the caller's access to `project_id` is checked (workspace match for members, share-link's project match for guests) before a key is issued. Key shape: see `docs/tdr/0002-snippet-mode-shares-the-share-link-model.md` (does not contain a `comment_id` - the upload happens before the comment exists). |

## 12.4 Comments

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/pages/{page_id}/comments` | member or guest (guest sees `layer=client` only, enforced server-side per `11-Database.md` §11.10) | List comments, supports `?since=<event_id>` delta sync |
| POST | `/pages/{page_id}/comments` | member or guest | Create a comment (guest-authored defaults `layer=client`, cannot be overridden by guest) |
| POST | `/comments/{id}/replies` | member or guest | Threaded reply |
| PATCH | `/comments/{id}` | member | Edit body, status, assignee, due date |
| PATCH | `/comments/{id}/layer` | member (`member`+), requires explicit `confirm: true` in body | Toggle client/team visibility |
| PATCH | `/comments/{id}/reanchor` | member | Manually reassign an orphaned comment's anchor |

**Standard error shape** (all 4xx/5xx, per `06-Backend-Architecture.md` §6.7):
```json
{ "error": { "code": "PERMISSION_DENIED", "message": "...", "details": {} } }
```

## 12.5 Integrations

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET/POST | `/workspaces/{id}/integrations` | member (`admin`+) | List/connect integrations |
| DELETE | `/integrations/{id}` | member (`admin`+) | Disconnect |
| POST | `/comments/{id}/integrations/clickup/create-task` | member | Create linked ClickUp task from a comment |

## 12.6 WebSocket Protocol

Single connection per active dashboard session, scoped to a workspace: `wss://api.backline.app/ws?token=<jwt or guest-session-token>&workspace_id=...`.

**Event envelope:**
```json
{ "type": "comment.created", "workspace_id": "...", "payload": { ... }, "ts": "..." }
```

| Event type | Payload | Emitted when |
|---|---|---|
| `comment.created` | Comment object | New comment posted |
| `comment.updated` | Comment object (partial) | Status/assignee/body edited |
| `comment.recovery_updated` | `{ comment_id, recovery_status, confidence }` | Recovery pipeline resolves/updates a comment's anchor |
| `presence.updated` | `{ page_id, active_sessions: [...] }` | A reviewer/member joins or leaves a page |
| `typing.started` / `typing.stopped` | `{ comment_id or page_id, actor }` | Composer focus/blur |
| `revision.created` | `{ page_id, revision_id }` | New revision confirmed |
| `notification.new` | Notification object | In-app notification for a member |

**Auth on connect:** the same permission matrix as REST (`13-Authentication.md` §13.5) applies - a guest-token connection only ever receives `layer=client` comment events for its own share link's project; this is enforced at the Redis pub/sub subscription level (guest connections subscribe to a `project:{id}:client` channel, member connections to `workspace:{id}:all`), not filtered client-side after receipt.

**Reconnection:** client-side exponential backoff (`07-Review-SDK.md` §7.5 for the widget; identical pattern in the dashboard's `ws-client.ts`, `05-Frontend-Architecture.md`). On reconnect, dashboard triggers a targeted React Query invalidation for the currently-viewed page/board rather than a full app reload.

## 12.7 Rate Limiting

Per Rule 6 (Security Is a Feature): `GET /review/{share_token}` and `POST /guest-sessions` are rate-limited per IP (sliding window log via Redis sorted sets, `core/rate_limit.py`) to prevent share-link brute-forcing of passcodes. Passcode verification itself happens at `POST /guest-sessions`, not at `GET /review/{share_token}` (which only reports whether a passcode is required, alongside project name/mode) - a passcode is a secret and never belongs in a GET query string that could be logged. Member-authenticated endpoints are rate-limited per workspace to prevent one tenant's runaway script from degrading others - see `18-Storage-Deployment.md` for limits by environment.
