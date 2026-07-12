# 14 - State Management Strategy

## 14.1 The Split

**React Query owns everything that came from the server.** Zustand owns everything that is purely client-side and ephemeral. If a piece of state could be answered by "what does the API say right now," it does not belong in Zustand - this is the rule that keeps the two systems from fighting over the same data (a recurring failure mode in apps that use both without a clear line).

## 14.2 React Query - Cache Key Structure

Central factory in `lib/query-keys.ts`, never ad-hoc array literals scattered in components (Rule 3):
```ts
export const qk = {
  workspace: (id: string) => ['workspace', id] as const,
  projects: (wsId: string) => ['workspace', wsId, 'projects'] as const,
  board: (projectId: string) => ['project', projectId, 'board'] as const,
  comments: (pageId: string) => ['page', pageId, 'comments'] as const,
  comment: (id: string) => ['comment', id] as const,
};
```

## 14.3 Invalidation Rules

- WebSocket `comment.created`/`comment.updated` -> targeted `queryClient.setQueryData(qk.comments(pageId), ...)` merge, **not** a blind `invalidateQueries` - a full refetch on every keystroke-adjacent event would thrash the kanban board during an active review session.
- `comment.recovery_updated` -> same targeted merge, updates just the affected comment's `recovery_status`/`confidence` fields.
- Mutations (status change, assignee change) use optimistic updates: `onMutate` writes the expected new state immediately, `onError` rolls back via the snapshot returned from `onMutate`, `onSettled` reconciles with the server response. This is what makes the "PM triages 50 comments in under 10 minutes" acceptance criterion (`01-Product-Vision.md`) feel instant rather than round-trip-bound.

## 14.4 Prefetching

- Hovering a project card in the workspace home prefetches `qk.board(projectId)` - triage is the most common next action.
- Opening the board prefetches the first page's `qk.comments(pageId)` for the currently-selected filter.

## 14.5 Offline / Retry / Polling

- Default retry: 2 attempts, exponential backoff, only for idempotent (`GET`) queries - mutations never auto-retry silently (a retried `POST /comments` could double-post; mutations that need retry safety use an idempotency key, not blind retry).
- `staleTime` defaults: comment lists `30s` (WebSocket keeps them fresh in between; this is just a safety net if a WS event was missed), workspace/project metadata `5min` (rarely changes).
- No polling for comments (WebSocket-driven). Polling is used only for the recovery pipeline's status on a page that just had a new revision detected, at a 5s interval, capped at 2 minutes, as a fallback if the WS event is missed.

## 14.6 What Belongs in Zustand

- Active pin-drop UI state (which element is being commented on, composer open/closed) - this is SDK-local state, not server state, and doesn't outlive the interaction.
- Board view state: current filter selections (status/assignee/layer/device), kanban vs. list toggle, selected page in a multi-page project. These are per-session UI preferences, not something the server needs to know about for MVP.
- Modal/drawer open state.
- WebSocket connection status (`connected`/`reconnecting`/`disconnected`) - this is a client fact about the client's own connection, not server data.

## 14.7 What Does Not Belong in Zustand

- Comment data, project data, member lists, integration configs - all React Query.
- Anything that needs to survive a page refresh as "the truth" rather than "the last UI preference" - if it needs to survive, it's either a URL param (view filters, so a link to a filtered board view is shareable) or server state.

## 14.8 Store Shape Example

```ts
type BoardUIStore = {
  activeFilters: { status?: Status; assignee?: string; layer?: Layer };
  viewMode: 'kanban' | 'list';
  setFilter: (patch: Partial<BoardUIStore['activeFilters']>) => void;
  setViewMode: (mode: BoardUIStore['viewMode']) => void;
};
```
One store per feature (`stores/board-ui.ts`, `stores/composer-ui.ts`), never a single monolithic app-wide store - this keeps re-renders scoped and keeps Rule 5 (Modular by Default) true on the frontend too.
