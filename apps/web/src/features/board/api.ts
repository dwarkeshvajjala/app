import type { Schemas } from "@backline/types";

import { apiFetch } from "../../lib/api-client";

export type CommentOut = Schemas["CommentOut"];
export type CommentStatus = "todo" | "in_progress" | "resolved" | "wont_fix";
export type CommentLayer = "client" | "team";

export function listProjectComments(projectId: string): Promise<CommentOut[]> {
  return apiFetch<CommentOut[]>(`/api/v1/projects/${projectId}/comments`);
}

export function updateComment(
  commentId: string,
  patch: { status?: CommentStatus; assignee_id?: string | null },
): Promise<CommentOut> {
  return apiFetch<CommentOut>(`/api/v1/comments/${commentId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function createReply(
  commentId: string,
  body: string,
  layer: CommentLayer,
): Promise<CommentOut> {
  return apiFetch<CommentOut>(`/api/v1/comments/${commentId}/replies`, {
    method: "POST",
    body: JSON.stringify({ body, layer }),
  });
}

// Moderation delete (any comment in the caller's workspace, regardless of authorship) -
// distinct from the widget's own-author-only guest self-service delete, which this
// dashboard never calls.
export function deleteComment(commentId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/comments/${commentId}/moderate`, { method: "DELETE" });
}

export function deleteThread(commentId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/comments/${commentId}/thread/moderate`, { method: "DELETE" });
}
