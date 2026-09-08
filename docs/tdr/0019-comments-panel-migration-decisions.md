# TDR-0019: Project side panel and comment thread migration decisions

Date: 2026-09-08
Status: Accepted

## Context

Slice 04 of the post-login UI migration (`docs/implementation/10-ui-migration-chat-prompts.md`)
covers `ProjectSidePanel` and its Comments/Details/Integrations/MCP/AI tabs, the
`CommentsTab` component tree, and `CommentThreadPanel`. Before this slice, the panel
shell and `CommentRow` already used the Final Draft's `bl-` brand tokens (TDR-0018),
but the tab bodies, the comment filter/sort/view controls, and `CommentThreadPanel`
still used the pre-migration Tailwind theme (`bg-accent-primary`, `dark:`, `text-muted`,
...), and several controls named in the slice (priority, tags, assignees, due date,
waiting-on, reply threads) had no UI in this panel at all.

`backline-Final Draft.html` has no "BugHunt AI", "MCP Server", "Page Overview", or
"Available Integrations" markup anywhere (confirmed by a full-text search of the
checked-in reference) - these are legitimate pre-existing product surfaces from an
earlier implementation pass, not something to invent or remove. The reference's own
comment sidebar (`renderSide`/`detailFor` in the source HTML) instead informed how the
Comments tab's filter/sort/status controls and the thread/detail view should look and
behave.

## Decisions

1. **Reuse the established `bl-` component vocabulary instead of inventing new
   patterns.** The Comments tab's status grid, sort/filter popovers, comment cards,
   tags, due-date chips, and layer/recovery badges are built from classes and
   components already shipped for other slices: `.bl-review-popover`/`.bl-review-menu-row`
   (ProjectOverviewPage's toolbar), `.bl-chip`/`.bl-chip-row`/`.bl-message`/`.bl-screenshot`/
   `.bl-fields`/`.bl-people`/`.bl-check` (TicketDetail.tsx), `.bl-share-*`/`.bl-setting-row`/
   `.bl-switch` (ShareProjectModal.tsx), and `@backline/ui`'s `Avatar`/`LayerBadge`/
   `RecoveryBadge`/`STATUS_LABELS`/`STATUS_COLORS`. A small, new `.bl-comment-*` set
   covers what genuinely has no precedent (the comment card layout, a downward-opening
   popover variant, and due-date/status-grid chips). `comments/types.ts`'s status
   label/color map now re-exports `@backline/ui`'s workflow module (FE-05) instead of
   keeping its own independent copy.

2. **`CommentThreadPanel` becomes the Comments tab's reply/thread and full metadata
   editor**, opened from a new "open thread" action on `CommentRow` (distinct from the
   row's existing click-to-navigate behavior, which is preserved). It now edits status,
   priority, tags, assignees, due date, and waiting-on/waiting-on-client - the same
   fields `TicketDetail.tsx` already exposes for the same underlying comment record -
   using the same `DatePicker`/`PeoplePicker` components, rather than a second,
   drifting field set. `CommentThreadPanel` is rebuilt on the shared `Dialog` component
   for native modal semantics; `BoardPage.tsx`'s existing usage (`comment`/`replies`/
   `projectId`/`onClose`) is unchanged.

3. **Fixed an assignee/waiting-on identity bug found while aligning with
   `PeoplePicker`.** The pre-migration `CommentThreadPanel` compared `assignee_ids`/
   `waiting_on_ids` (member `user_id`s) against workspace membership-record `id`s in
   its member `<select>` options - a mismatch that meant a saved assignee could never
   show as selected again. `PeoplePicker` already used the correct `user_id` key; the
   panel now does too.

4. **Details/Integrations/MCP/AI stay separate panel tabs** (the existing rail/drawer
   architecture from TDR-0018) rather than being collapsed into the reference's single
   scrolling comment panel with an inline "Summarise/Build tasks/Find duplicates" AI
   strip. Restyling, not restructuring, is this slice's scope; AI and MCP remain
   visibly gated/static since no AI provider or MCP server is configured.

5. **Comments-tab filters stay local component state**, not URL parameters. Unlike
   `TicketsPage`/`BoardPage`, which are full shareable page views, this panel is a
   transient drawer over the review canvas; its filter/sort/display/group choices were
   already local state before this slice and there is no product requirement to make
   them shareable links.

## Consequences

The Comments tab now surfaces recovery status (anchor uncertain/lost), priority, due
dates (with overdue/soon language), tags, assignees, mentions, screenshots, and reply
counts directly in the list, and a full thread/reply view reachable from every row.
Comment/ticket status colors and labels can no longer drift between this panel, the
workspace ticket board, and the widget's own copy without all three being updated
together (the widget keeps its own hand-copied constants by design; see
`packages/ui/src/workflow.ts`'s own comment). No backend, database, generated API
declaration, or widget file was changed.

## Amendment (audit batch 07, 2026-09-09): decision 5 superseded

Decision 5 ("Comments-tab filters stay local component state, not URL parameters") is
**superseded**. The M-15 audit (ledger IDs FD-AUD-027..031, UX-AUD-047..055) explicitly
requires filters and the open-thread id to be URL-owned so a thread deep link and a
hard refresh both reproduce the same view - the same FE-03 rationale `BoardPage.tsx`
already followed for its own `?comment=`/filter params (see that file's own comment at
the top of its `useSearchParams` block). `useCommentFilters.ts` now stores all of
`status`/`hideResolved`/`layer`/`sort`/`currentPageOnly`/`tags`/`deviceTypes`/
`browsers`/`assignees`/`display`/`groupBy`/`thread` in `ProjectOverviewPage`'s existing
search params (same pattern as its `page`/`mode`/`zoom`/`viewport` params - no key
collisions). `ProjectSidePanel`'s own open/closed drawer state is lazily initialized
from `?thread=` on mount so a deep link actually opens the Comments tab, not just
restores its filters once manually reopened.

The rest of TDR-0019 (decisions 1-4) is unaffected and still describes the current
implementation.
