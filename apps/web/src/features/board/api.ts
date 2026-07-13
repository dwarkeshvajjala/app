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
