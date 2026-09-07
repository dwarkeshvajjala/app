// Shared targeted-cache-merge helpers for the qk.projectComments(projectId) query
// (14-State-Management.md §14.4 - patch the cache directly on WS events/mutation
// success instead of a blind invalidate, so a busy review session doesn't thrash the
// board with full refetches). BoardPage, ProjectOverviewPage and CommentThreadPanel
// each had their own copy of this same "find by id, replace or append" merge logic
// (FE-01/FE-02) - centralized here instead.
import type { QueryClient } from "@tanstack/react-query";
import type { CommentOut } from "../features/board/api";
import { qk } from "./query-keys";

export function upsertProjectComment(queryClient: QueryClient, projectId: string, comment: CommentOut) {
  queryClient.setQueryData<CommentOut[]>(qk.projectComments(projectId), (old) => {
    if (!old) return old;
    const index = old.findIndex((c) => c.id === comment.id);
    if (index === -1) return [...old, comment];
    const next = [...old];
    next[index] = comment;
    return next;
  });
}

export function removeProjectComment(queryClient: QueryClient, projectId: string, commentId: string) {
  queryClient.setQueryData<CommentOut[]>(qk.projectComments(projectId), (old) =>
    old ? old.filter((c) => c.id !== commentId) : old,
  );
}

// Merges `patch` into the existing comment if present; no-ops (does not append) when
// the comment isn't in the cache yet - unlike upsertProjectComment, this is for
// updates to a comment that must already be loaded (recovery-status pushes, edits).
export function patchProjectComment(
  queryClient: QueryClient,
  projectId: string,
  commentId: string,
  patch: Partial<CommentOut>,
) {
  queryClient.setQueryData<CommentOut[]>(qk.projectComments(projectId), (old) => {
    if (!old) return old;
    const index = old.findIndex((c) => c.id === commentId);
    if (index === -1) return old;
    const next = [...old];
    next[index] = { ...next[index], ...patch };
    return next;
  });
}
