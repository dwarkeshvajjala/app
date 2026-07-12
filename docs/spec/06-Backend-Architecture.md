# 06 - Backend Architecture

## 6.1 Folder Structure

```
backend/app/
  main.py                    # FastAPI() app, middleware registration, router mounting
  core/
    config.py                # Pydantic Settings (env vars)
    errors.py                 # Typed exception hierarchy + exception handlers
    security.py                # JWT encode/decode, password/OTP hashing
    permissions.py              # Permission matrix + require_permission() dependency
    db.py                        # Motor client lifecycle
  modules/
    auth/                  # routers, services, schemas for login/OTP/OAuth
    workspaces/
    projects/
    share_links/
    pages/
    comments/
    anchor_engine/           # 08-Anchor-Engine.md logic lives here
    snapshot_engine/          # 09-Snapshot-Engine.md
    revision_engine/           # 10-Revision-Recovery.md
    recovery_engine/
    realtime/                   # WebSocket connection manager (12-API-WebSocket.md)
    integrations/                # Slack/ClickUp/Trello adapters (17-...)
    notifications/                # Email + digest jobs
    storage/                       # R2 client, signed URL issuance
  workers/                    # Arq worker entrypoints (background jobs)
  tests/
```

Each `modules/<name>/` follows the same internal shape:
```
modules/comments/
  router.py       # FastAPI APIRouter - HTTP only, no business logic
  service.py       # Business logic, orchestrates repository + other services
  repository.py     # Mongo queries only, always workspace-scoped (Rule 6)
  schemas.py          # Pydantic request/response models (Rule 3, source of truth)
  events.py            # Domain events this module emits (e.g. CommentCreated)
```

## 6.2 Layering Rule

`router.py` -> `service.py` -> `repository.py` -> MongoDB. A router never imports a repository directly, and a repository never contains business logic (status transitions, permission checks, notification triggering) - that's the service's job. This is what makes Rule 5 (Modular by Default) real: swap Mongo for something else later by rewriting only `repository.py` files.

```python
# modules/comments/router.py
@router.post("/pages/{page_id}/comments", response_model=CommentOut)
async def create_comment(
    page_id: str,
    body: CommentCreate,
    session=Depends(get_current_session),   # member OR guest
):
    return await comment_service.create(page_id, body, session)
```

## 6.3 Dependency Injection

FastAPI's `Depends()` is used for: current session resolution (`get_current_session` - resolves either a member JWT or a guest share-link token into a unified `Session` object), workspace scoping (`get_workspace_context`), and permission checks (`require_permission("comment:create")`). Services receive a `db: AsyncIOMotorDatabase` and a `session: Session` - never the raw request.

## 6.4 Workspace Scoping Enforcement (Rule 6 in code)

Every repository method takes `workspace_id` as an explicit, non-optional first argument - there is no method signature that allows a query to be constructed without it:

```python
class CommentRepository:
    async def list_for_page(self, workspace_id: str, page_id: str) -> list[Comment]:
        cursor = self.db.comments.find({"workspace_id": workspace_id, "page_id": page_id})
        return [Comment(**doc) async for doc in cursor]
```
A lint rule (custom `ruff` plugin or a simple AST test in CI) fails the build if any `db.<collection>.find`/`update`/`delete` call in `modules/**/repository.py` is found without a `workspace_id` key in the same dict literal.

## 6.5 Background Jobs (Arq)

Queued, not inline, whenever the work is (a) slow, (b) can fail independently of the user-visible action, or (c) is a fan-out:

| Job | Trigger | Why async |
|---|---|---|
| `send_slack_notification` | `comment.created`, `comment.status_changed` | Slack webhook latency/failures shouldn't block the API response |
| `sync_clickup_task` | Comment linked to ClickUp | External API call, retryable |
| `send_email_digest` | Scheduled (cron via Arq) | Batches many comments into one email |
| `run_recovery_pipeline` | New revision detected | Potentially expensive (multi-anchor matching across a whole page diff) |
| `generate_snapshot_diff` | New snapshot uploaded | CPU-bound diffing, off the request path |

## 6.6 Event Sourcing for Audit History

The `events` collection (`11-Database.md`) is an append-only log of every meaningful state change: `comment.created`, `comment.status_changed`, `share_link.revoked`, `member.role_changed`, etc. It serves two purposes:
1. **Audit trail** - "who changed this and when" is always answerable from `events`, never reconstructed from mutable state.
2. **Future AI/analytics substrate** - v-next features (duplicate detection, analytics dashboards) read `events`, they don't require new instrumentation retrofitted into every service later (`03-System-Architecture.md` §3.6).

Every service method that changes state writes exactly one `events` document, in the same logical transaction as the state change it describes (MongoDB multi-document transaction within a session, since both are in the same replica set).

## 6.7 Error Handling

A typed exception hierarchy in `core/errors.py`:
```
BacklineError
  NotFoundError            -> 404
  AuthenticationError       -> 401 (missing/invalid/expired/revoked credentials)
  PermissionDeniedError      -> 403 (valid session, not authorized for this action/resource)
  ValidationError             -> 422 (mirrors Pydantic's, but for business-rule validation)
  ConflictError                -> 409 (e.g., share link already revoked)
  ExternalServiceError           -> 502 (Slack/ClickUp/etc. failures)
```
The 401/403 split is load-bearing, not cosmetic: the frontend's API client (`14-State-Management.md`) treats a 401 as worth a silent refresh-and-retry (`13-Authentication.md` §13.6), and a 403 as a permission error to surface as-is - collapsing both into one status code would make silent token refresh indistinguishable from "you don't have access," so `get_current_session` and refresh-token validation raise `AuthenticationError`, while role/workspace-scope checks (`core/permissions.py`, `require_workspace_match`) raise `PermissionDeniedError`.

One global exception handler in `main.py` maps each to a consistent JSON error shape (`12-API-WebSocket.md` §12.4). No router ever constructs an `HTTPException` directly - always raise the typed error and let the handler translate it, so the response shape can't drift between endpoints.
