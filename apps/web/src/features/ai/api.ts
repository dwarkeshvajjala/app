import { apiFetch } from "../../lib/api-client";

export async function summarizeThread(workspaceId: string, projectId: string, commentId: string): Promise<{ summary: string }> {
  return apiFetch(`/api/workspaces/${workspaceId}/projects/${projectId}/comments/${commentId}/ai/summarize`, {
    method: "POST"
  });
}

export async function suggestReply(workspaceId: string, projectId: string, commentId: string): Promise<{ suggestions: string[] }> {
  return apiFetch(`/api/workspaces/${workspaceId}/projects/${projectId}/comments/${commentId}/ai/suggest-reply`, {
    method: "POST"
  });
}
