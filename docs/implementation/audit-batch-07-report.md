# Audit batch 07 report — M-15 (Comments & Mentions)

Date: 2026-09-09
Scope: M-15 (Section 5), ledger IDs FD-AUD-027..031, UX-AUD-047..055

## 0. Note on process

This batch was first drafted by another pass (uncommitted `CommentsTab.tsx` split plus
a draft of this report) before this session started. This report **verifies that draft
against the actual code and TDR docs** rather than repeating its claims — three real
bugs it missed are fixed below (§3), and a documentation contradiction it left behind
is resolved (§4). Everything below reflects the tree as it stands now, after fixes.

## 1. What the diff actually contains

- Extracted `CommentsTab.tsx`'s dozen filter/display `useState` hooks into a new
  `comments/useCommentFilters.ts` hook, backed by `react-router-dom`'s
  `useSearchParams` instead of component state — filters
  (`status`/`hideResolved`/`layer`/`sort`/`currentPageOnly`/`tags`/`deviceTypes`/
  `browsers`/`assignees`/`display`/`groupBy`) and the open-thread id (`thread`) are now
  URL-owned, matching the pattern `BoardPage.tsx` already uses for its own filters and
  `?comment=`.
- `CommentsList.tsx`, `FilterSortBar.tsx`, `StatusChips.tsx`, `ViewOptionsBar.tsx`,
  `comments/types.ts` were **not** touched by this diff — they already existed
  (TDR-0019, committed earlier the same day) and needed no changes for this hook
  extraction; `CommentsTab.tsx`'s props into them are unchanged.

## 2. Verified correct as-is (no changes needed)

- **Attachment lifecycle** (`CommentThreadPanel.tsx`'s `handleFileChange`): per-file
  `createUpload` → signed `PUT` → accumulate into `attachments` state; a failed upload
  is caught (`try`/`catch`) and never reaches the reply mutation — it just doesn't get
  added, posting the comment itself is unaffected.
- **Dedup of optimistic creation vs `comment.created` broadcast**: `comment-cache.ts`'s
  `upsertProjectComment` is `findIndex` by id, replace-or-append — both
  `CommentThreadPanel`'s own `onSuccess` upsert and `BoardPage`/`ProjectOverviewPage`'s
  `useWSEvent("comment.created")` handler call the same helper, so whichever arrives
  second is a no-op replace, not a duplicate append.
- **Mentions backend**: `create_reply()`
  (`backend/app/modules/comments/service.py:451-464`) dedupes `mentioned_user_ids` via
  `dict.fromkeys` (order-preserving) and validates each id against workspace
  membership before calling `notify_comment_mention`; `notifications/service.py`
  re-checks membership independently as defense-in-depth. Matches
  `audit-batch-03-report.md`'s account — confirmed directly against source, not
  assumed.
- **Move/resize/reanchor clamping** (`AssetReview.tsx`'s `getPoint`/
  `handleContainerMove`): explicit `Math.max(0, Math.min(1, ...))` on every coordinate
  and `Math.min(1 - x, ...)` on width/height — cannot produce an out-of-`[0,1]` region.
  `PATCH /comments/{id}/reanchor`
  (`backend/app/modules/comments/service.py:1056-1097`) receives this region and does
  broadcast `comment.updated` on success (`service.py:1091-1096`).
- **No fake undo/redo**: none exists in the frontend for comments or anchors —
  correctly skipped per the batch instructions' "only if a safe server-side inverse
  exists" rule.

## 3. Bugs found and fixed

1. **Thread deep link didn't survive reload** (`ProjectSidePanel.tsx`).
   `useCommentFilters.ts` correctly reads `?thread=` on mount, but the drawer that
   renders `CommentsTab` at all is gated by `ProjectSidePanel`'s own `activeTab` state,
   which was plain `useState<TabId | null>(null)` — always closed on a fresh load,
   regardless of the URL. A link like `.../projects/:id?thread=<comment-id>` kept the
   id in the URL but never opened the Comments tab to read it, so nothing happened on
   load. Fixed by lazily initializing `activeTab` from `?thread=` on mount.
2. **Stale-closure risk in `setActiveStatus`** (`useCommentFilters.ts`). Its
   updater-function branch resolved against the `activeStatus` closed over at render
   time, not the URL's live value inside `setSearchParams`'s own callback — unlike
   every other setter in the same file (`setActiveTags`, etc.), which already resolve
   against `prev`. Two calls in the same tick would both have resolved off the same
   stale value. Rewritten to match the rest of the file's pattern.
3. **Mentioned ids were never pruned on edit** (`MentionsInput.tsx`). `insertMention`
   added a member's id to a `Set` that nothing ever removed from — deleting `"@Bob "`
   from the draft (backspace, retyping, cutting a line) left Bob's id in
   `mentionedUserIds`, so submitting still notified him even though his name no longer
   appeared anywhere in the sent text. This is a real "notifies someone not actually
   mentioned" bug, not a style nit. Fixed by tracking each id's exact inserted text and
   re-scanning the draft on every change — an id is dropped the moment its text is no
   longer present.

## 4. Documentation debt closed

- **TDR-0019 decision 5** ("filters stay local state, not URL params") was reversed by
  this diff without a note — both this repo's own audit rule ("any
  architecture/product divergence gets a dated TDR") and established practice (see
  `audit-batch-01-report.md` item 9's precedent) require one. Added a dated amendment
  marking decision 5 superseded, with the M-15 ledger IDs as the reason.
- **TDR-0009**'s "mentioned in a reply... deferred" note has been stale since batch 03
  shipped it (already flagged in `audit-batch-00-report.md` and
  `09-m00-baseline-report.md` as needing this per audit rule M-21) — added the
  superseding note.

## 5. Known gap — not fixed in this pass

`PATCH /comments/{id}/reanchor` has no stale/concurrent-edit detection at all: no
version field, no `updated_at` comparison, no ETag/If-Match
(`backend/app/modules/comments/service.py:1065-1076` unconditionally overwrites after
an unconditional `find_by_id`). None of TDR-0004/0006/0007/0019 discuss this as an
accepted limitation either — it's simply unaddressed. Fixing it properly needs a
version/`updated_at` field on the comment record, a 409-style conflict response, and
frontend handling for that response in `AssetReview.tsx` (and, once it exists, the
website canvas's own drag/resize) — a backend contract change, not a component-local
fix. Flagged for its own workstream/TDR rather than rushed into this pass, per the same
"don't fix parity by regressing or inventing architecture without a TDR" rule this
report is enforcing in §4.

## 6. Verification evidence

- `npm run typecheck` (`apps/web`): clean, 0 errors.
- `npm run lint` (`apps/web`): 0 errors, 3 pre-existing warnings in unrelated files
  (`ActivityPage.tsx`, `ViewportMenu.tsx`) — unchanged by this batch.
- `npm run build` (`apps/web`): succeeds; only a pre-existing chunk-size warning
  (`pdf.worker` + main bundle), unrelated to this diff.
- No test suites run or added, per batch instructions. No manual click-through
  performed, per this pass's explicit scope (code-level verification only).

## 7. Files changed in this pass

- `apps/web/src/features/projects/panel/comments/useCommentFilters.ts` (new by the
  prior pass, then fixed — see §3.2)
- `apps/web/src/features/projects/panel/CommentsTab.tsx` (already-correct diff from the
  prior pass, unchanged further)
- `apps/web/src/features/projects/panel/ProjectSidePanel.tsx` (fix — see §3.1)
- `apps/web/src/features/comments/MentionsInput.tsx` (fix — see §3.3)
- `docs/tdr/0019-comments-panel-migration-decisions.md` (amendment — see §4)
- `docs/tdr/0009-notifications-integrations-scope-and-design.md` (amendment — see §4)
- `docs/implementation/audit-batch-07-report.md` (this file, rewritten to reflect
  verified state)

## 8. Next steps

- Reanchor concurrency detection (§5) is the one open item from the original M-15
  checklist; needs its own TDR before implementation.
- Await next batch assignment.
