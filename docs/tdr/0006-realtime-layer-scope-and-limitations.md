# TDR-0006: Realtime Layer (M7) - event scope, presence model, and known gaps

Date: 2026-07-12
Status: Accepted

## Context

`12-API-WebSocket.md` §12.6 specifies seven WS event types (`comment.created`,
`comment.updated`, `comment.recovery_updated`, `presence.updated`, `typing.started`/
`typing.stopped`, `revision.created`, `notification.new`) and a channel-scoping rule
(member connections subscribe to `workspace:{id}:all`, guest connections to
`project:{id}:client`). Milestone 7's job is to build the transport (WS gateway + Redis
pub/sub fan-out) and wire it to whatever state changes already exist in the codebase -
not to invent new features those events would otherwise have nothing to report on.

## Decision: which events actually ship in M7

| Event | Status | Why |
|---|---|---|
| `comment.created` | Shipped | Wired into `comments/service.py`'s `create_comment`/`create_reply`. |
| `comment.updated` | Shipped | Wired into `update_comment`, `toggle_layer`, `reanchor`. |
| `revision.created` | Shipped | Wired into `snapshot_engine/service.py`'s `submit_snapshot`, only on the genuinely-new-revision path. |
| `presence.updated` | Shipped, narrowed scope | See below. |
| `comment.recovery_updated` | Deferred | Recovery pipeline is Milestone 8 by design (`20-Build-Plan.md`'s explicit M5/M8 split) - nothing in the codebase produces this fact yet. |
| `typing.started`/`typing.stopped` | Deferred | Requires composer focus/blur wiring that doesn't exist in either the widget's or dashboard's composer UI. Nothing to hook this milestone into. |
| `notification.new` | Deferred | Notification system is Milestone 10 (`20-Build-Plan.md`). |

## Decision: presence is guest-facing-in, staff-facing-out only

Presence is announced by connecting to `/ws` with a `page_id` - in practice, only the
widget does this (the dashboard has no page-scoped view to join presence from; the
`/w/:workspaceSlug/p/:projectId/pages/:pageId` route in `05-Frontend-Architecture.md`
§5.2 has never been built by any milestone). `presence.updated` is published only to
`workspace:{id}:all` (staff), never to the guest's own `project:{id}:client` channel -
a guest reviewer never learns who else is reviewing the same page. This is a deliberate
privacy-by-default choice, not an oversight: nothing in the product spec asks a guest to
see other guests, and there was no existing UI surface that would have consumed it
either way. `BoardPage` shows a live "N reviewing" count next to each page in its page
filter, derived from `presence.updated` payloads matched to `page_id`s it already knows
about from loaded comments.

## Known gap: the widget still has no local comment list

`07-Review-SDK.md` §7.5 describes reconnection requesting a delta sync via
`GET /pages/{page_id}/comments?since=<event_id>`. That presupposes the widget already
renders a list of existing comments as pins, which no milestone has built - the widget
(`apps/widget/src/index.ts`) has only ever supported *creating* a comment, never listing
ones already on the page. Building that is a real, standalone feature (rendering
existing comments as pins/threads in the injected overlay), not something to slip in
unannounced as a side effect of wiring up transport. Until it exists, the widget's only
reactive behavior on this WS connection is: track ids of comments *this guest created*
this page load, and toast when one of them receives `comment.updated` (e.g., a staff
member changed its status). Delta-sync-on-reconnect is deferred until the comment-list
feature lands.

## Known gap: no WS event for a comment leaving the guest-visible layer

A `team -> client` layer toggle correctly starts publishing that comment to the guest
channel going forward (the widget/dashboard's upsert-by-id handling treats an unknown
id in `comment.updated` as insertable). The reverse, `client -> team`, has no
corresponding event - the spec's event table has no `comment.deleted`/`comment.hidden`
type. A guest who already has such a comment (once the widget keeps a local list, per
the gap above) would only stop seeing it on their next full refetch, not live. Not
solved here: inventing new protocol surface wasn't asked for by this milestone, and the
impact is currently zero since the widget doesn't keep a local list to begin with.

## Consequences

- The dashboard's Board (`BoardPage.tsx`) merges `comment.created`/`comment.updated`
  into its React Query cache via targeted `setQueryData`, guarded by a `project_id` the
  WS payload carries specifically for this purpose (not part of `CommentOut`'s REST
  shape) - without it, a workspace-wide event stream would need extra round trips to
  tell which project's board query to update.
- `apps/web/src/stores/` gets its first Zustand store (`connectionStore.ts`), the exact
  cross-component need `docs/tdr/0005` deferred: WS connection status, read by
  `BoardPage`'s header pill. A second store, `presenceStore.ts`, holds page-scoped
  reviewer counts.
- Real end-to-end proof (two live connections, one acting as "dashboard", one as "guest
  reviewer," seeing each other's actions without a manual refresh) was done against the
  actual running dev server with a standalone script, not pytest - `httpx`'s
  `ASGITransport` (used by every other backend test) doesn't speak the WebSocket
  protocol. Pytest coverage (`tests/test_realtime.py`) instead proves: the connection
  manager's local fan-out/cleanup, the publish/subscribe envelope contract against real
  Redis, presence bookkeeping, member-vs-guest token disambiguation, and - the part most
  likely to silently rot - that the comment/snapshot services actually publish the right
  event to the right channel(s) on every state change this milestone cares about.
