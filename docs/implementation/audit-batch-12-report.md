# Audit batch 12 report — Verification pass on a second M-19/M-20 round

Date: 2026-09-09
Scope: M-19, M-20 (section 5), ledger IDs UX-AUD-001..007/071..084 (section 10) —
verification pass on a follow-up diff, after audit-batch-10 had already been reviewed
and committed (`f5e0b0d`).

This diff (touching `WorkspaceLayout.tsx`, `AssetReview.tsx`, `WorkspaceHomePage.tsx`)
was produced by another AI tool in a later, uncommitted round on the same M-19/M-20
scope. Verified against the actual codebase (query-key factory, WS event wiring,
backend comment/ticket data model) rather than trusting it at face value; found and
fixed two real regressions before pushing.

## What actually landed (verified correct)

- **`WorkspaceHomePage.tsx`**: the ad-hoc `["workspace", workspace.id, "projects"]`
  array replaced with the central `qk.projects(workspace.id)` factory call — identical
  key shape, `qk` was already imported, no other call site constructs this key
  ad-hoc anymore.
- **`AssetReview.tsx` — `StatusBadge`/`LayerBadge`**: raw `STATUS_LABELS[...]` text and
  a hand-rolled `{c.layer === 'team' ? 'Team only' : 'Client visible'}` span replaced
  with the shared `StatusBadge`/`LayerBadge` components from `@backline/ui`
  (`packages/ui/src/Badge.tsx`), which pair color with an icon and a label — consistent
  with the same components already in use in `BoardPage`/`TicketDetail` per batch-10.
  Confirmed the props (`status`, `layer`) match the component signatures and
  `STATUS_LABELS` has no remaining reference in the file after the import was trimmed
  (no dead/unused import).
- **`AssetReview.tsx` — narrower comment-refresh invalidation**: `refresh()` no longer
  invalidates `qk.workspaceAll()` after posting/replying to an asset comment. Verified
  this is safe *given* the fix below is also applied — `_broadcast_comment_event`
  (`backend/app/modules/comments/service.py`) fans out `comment.created` to the
  `workspace:{id}:all` channel with no sender-exclusion (`realtime/manager.py`
  broadcasts to every connected socket on the channel, including the actor's own), so
  the acting member's own tickets/dashboard/activity views are still kept current by
  `WorkspaceLayout`'s workspace-wide listener, not by this component.

## Bugs found and fixed in this pass

1. **`WorkspaceLayout.tsx` deleted the only live-update path for Tickets/Dashboard/
   Activity, workspace-wide.** The diff removed the `useWSEvent("comment.created"
   /"comment.updated"/"comment.deleted", ...)` listener that invalidated
   `qk.tickets`/`qk.dashboard`/`qk.activity` on every comment event. This looked like
   a legitimate "duplicate comment-upsert logic" cleanup (BoardPage/ProjectOverviewPage
   have their own `comment.*` listeners), but it is not a duplicate: those two only
   merge comment content into their own page-local `qk.projectComments` cache, while
   this listener refreshes a different, workspace-wide set of surfaces. Confirmed via
   `dashboard/repository.py`'s `root_pipeline` (no `is_standalone` filter) that *every*
   top-level comment — an asset review comment, a project comment, or an explicitly
   created ticket — counts toward the Tickets list and Dashboard summary counts, and
   there is no dedicated `ticket.*` WS event (tickets are standalone comments; ticket
   creation itself broadcasts `comment.created`, see `dashboard/service.py:244-257`).
   With the listener removed, a team member sitting on the Tickets, Dashboard, or
   Activity page would stop seeing live updates for any comment/ticket created
   anywhere else in the workspace, working only after a manual navigation/refetch.
   **Fixed**: restored the listener in `WorkspaceLayout.tsx`, refactored to call the
   existing `invalidateTicketsAndDashboard` helper (`lib/query-keys.ts`) plus a
   `qk.activity` invalidation, instead of three raw `invalidateQueries` calls — net
   less duplication than the original version while preserving the exact behavior.
2. **`AssetReview.tsx` polling removed with no WS replacement, breaking guest
   review entirely.** The diff dropped `refetchInterval: 30000` (assets list) and
   `refetchInterval: 10000` (asset comments), in the direction of
   `14-State-Management.md`'s "no polling for comments (WebSocket-driven)" rule — but
   this screen has no `comment.*` WS listener of its own (unlike BoardPage/
   ProjectOverviewPage), and there is no `asset.*`/upload WS event at all. Worse: this
   component is also rendered for unauthenticated guests via a share-link token, and
   `WSProvider` only opens a connection when an authenticated session has a
   `workspace_id` (`AuthContext.tsx`) — a guest session never gets one, so
   `client.disconnect()` runs and the guest has no WS connection under any
   circumstance. Removing the polling would have left guest reviewers (the core
   client-review use case) with no way to see new team comments/replies, and team
   members with no way to see a client's new comments/uploads, without either side
   manually reloading. **Fixed**: restored both `refetchInterval` values, with a
   comment explaining why this screen is the deliberate exception to the "no
   polling for comments" default (documented in `14-State-Management.md`).

## Preserved per instructions

- `connectionStore.ts`/`presenceStore.ts` untouched (TDR-0006).
- No changes outside the three files in this diff; ledger doc
  (`BACKLINE-MASTER-HTML-INTEGRATION-AUDIT.md`) left as-is.
- Section 2/6 rules (master audit doc) not touched.
- No test suites added or modified.

## Verification

- `pnpm --filter @backline/web typecheck` — clean.
- `pnpm --filter @backline/web lint` — clean.
- `pnpm --filter @backline/web build` — succeeds (same pre-existing >500kB chunk-size
  warning noted in batch-10, unrelated to this diff).
- Not run: a live dev-server/browser pass — out of scope for this pass; the two fixes
  above were verified by tracing the actual WS broadcast/consume paths and the
  backend comment/ticket data model rather than by executing the app.
