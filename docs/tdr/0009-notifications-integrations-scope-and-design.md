# TDR-0009: Notifications & Integrations (M10) - collection shape and scope decisions

Date: 2026-07-12
Status: Accepted

## Decision: `notifications` collection shape (11-Database.md never defined one)

§17.8 names the collection ("Backed by a `notifications` collection") but, unlike every
other collection in `11-Database.md`, never gives it a schema. Implemented shape:

```
{
  _id, workspace_id, user_id,     // recipient
  type: "comment_assigned" | "integration_disconnected",
  payload_json: { ... },           // comment_id, integration_id/integration_type, etc.
  read_at: datetime | null,
  created_at: datetime
}
```
Index: `{ workspace_id: 1, user_id: 1, created_at: -1 }` (the paginated `GET /notifications`
query shape). Two trigger types are wired this milestone - "comment assigned to you"
(§17.8's own example) and "integration disconnected unexpectedly" (fired from the
webhook retry engine's dead-letter path, closing the loop §17.8 describes). "Mentioned
in a reply" is not implemented: it needs an `@mention` parser in the composer and
backend, a genuinely separate feature with no existing scaffolding (no composer
mention-autocomplete UI, no mention-extraction logic anywhere) - deferred, not
half-built.

> **Superseded (audit batch 03, then batch 07):** the deferral above no longer applies.
> `MentionsInput.tsx` (composer parser/autocomplete) and `create_reply()` (backend -
> dedupes via `dict.fromkeys`, validates each id against workspace membership before
> calling `notification_service.notify_comment_mention`, `backend/app/modules/
> comments/service.py`) shipped a third trigger type, "mentioned in a reply," per
> `audit-batch-03-report.md`. Flagged stale (not yet amended) in
> `audit-batch-00-report.md` and `09-m00-baseline-report.md` per audit rule M-21; this
> note closes that gap.

## Decision: `notification.new` has no per-recipient WS channel

`12-API-WebSocket.md` §12.6 only defines two channel shapes: `workspace:{id}:all`
(members) and `project:{id}:client` (guests) - neither is scoped to one specific member.
Rather than invent a new `member:{id}` channel (real protocol surface, more moving parts
for the realtime layer to manage), `notification.new` is broadcast workspace-wide with a
`recipient_user_id` field in the payload; the dashboard's `NotificationBell` only acts on
events where `recipient_user_id` matches the signed-in user. Same pattern already used
for `comment.recovery_updated`'s cross-project ambiguity (docs/tdr/0006/0008) - broadcast
wide, filter narrow, rather than build new infrastructure per event type.

## Decision: Trello connects via a pasted API key + token, not an app-level OAuth flow

`.env.example`'s original Milestone-0 scaffolding included a single app-level
`TRELLO_API_KEY`, suggesting a Trello "Power-Up" authorize flow (one shared key, each
user generates their own token via a redirect that returns it in a URL fragment). §17.4
itself only says "Same Integration interface, same manual trigger" - it doesn't mandate
a connection UX the way §17.3 explicitly does for ClickUp ("OAuth2 connect flow").
Implemented instead: the agency pastes their own personal API key + token (both
generated from Trello's own token page), mirroring §17.2's explicit Slack rationale
("simplest possible connection - no OAuth app review needed for MVP"). This avoids
registering a Backline Trello Power-Up app entirely. The now-unused `TRELLO_API_KEY`
setting was removed from `config.py`/`.env.example` rather than left as dead scaffolding.

## Decision: only Slack gets automatic dispatch; ClickUp/Trello are manual-only

`AUTOMATIC_DISPATCH_TYPES = ("slack",)` in `modules/integrations/service.py` - a new
comment or status change only enqueues a job for Slack integrations. ClickUp's and
Trello's `on_comment_created`/`on_status_changed` hooks are no-ops by design (§17.3/
§17.4: both are explicitly manual, member-triggered actions, never automatic sync).
Enqueuing a job that's guaranteed to no-op for every ClickUp/Trello connection on every
comment event would be pure queue churn.

## Decision: only the daily digest is implemented; instant mode is deferred

§17.6: "Instant or daily digest (member-configurable per workspace, default: daily)."
Only the default (daily) ships this milestone - `modules/notifications/digest.py`'s
`run_daily_digests`, a real Arq cron job (`app/workers/main.py`, 09:00 daily) that groups
new comments by project and emails every workspace member since a `last_digest_sent_at`
checkpoint stored on the workspace document. A genuine per-member instant/daily
*preference* needs its own schema field (on `memberships`) and settings UI - a real,
separate piece of scope, deliberately deferred rather than half-built alongside
everything else in this milestone. Every member currently gets the same daily digest;
there is no per-member override yet.

## Decision: ClickUp task / Trello card backlinks point at the Board, not a pin

§17.3 asks for "a deep link back to the comment's pin in Backline." No per-comment
deep-link view exists (the page-detail thread view in `05-Frontend-Architecture.md`
§5.2 has never been built by any milestone, per docs/tdr/0006). The backlink instead
points at `/w/:slug/p/:projectId/board` - the real, existing surface closest to what
§17.3 asks for, not a link to a page that doesn't exist.

## Verification

Real, not mocked, in two ways: (1) `tests/test_integrations.py`/`test_webhook_retry.py`/
`test_notifications.py`/`test_email_digest.py` (158 backend tests total, all green) mock
only the third-party HTTP boundary (`httpx.AsyncClient` itself, replaced per-module -
never `AsyncClient.get`/`.post`, which would also intercept the test suite's own
ASGI-backed client, as `test_proxy.py` already established the hard way in M9); the
webhook retry engine, dead-letter path, and notification wiring all run against real
Redis/Mongo. (2) End-to-end scripts against the actual running stack: a local
always-fails-once HTTP server standing in for a Slack webhook, driven through the *real*
`app.workers.main.WorkerSettings` worker process and the *real* Redis queue - proving the
worker genuinely retries a genuinely failed delivery after ~5s and succeeds on the second
attempt (not a direct function call, per docs/tdr/0007/0008's established pattern) - and
a real Playwright session connecting Slack through the actual UI, then watching a second
member's `NotificationBell` receive a live unread badge and dropdown entry over the
WebSocket connection after an out-of-band comment assignment, zero manual refresh.
ClickUp's OAuth connect flow itself needs real ClickUp app credentials to exercise live
(same category of gap as Google OAuth, `README.md`'s existing note) - the exchange code
and API calls are implemented and unit-tested against mocks, not live-verified end to end
here.
