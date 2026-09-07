import type { Schemas } from "@backline/types";
import { API_BASE_URL, apiFetch } from "../../lib/api-client";

export type Asset = Schemas["AssetOut"];
export type Region = Schemas["Region"];
export async function assetRequest<T>(path: string, guest?: string, init?: RequestInit): Promise<T> {
  if (!guest) return apiFetch<T>(path, init);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', 'X-Guest-Session': guest, ...init?.headers } });
  if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(data?.error?.message ?? "The review could not be loaded."); }
  return response.json() as Promise<T>;
}
export function listAssets(projectId: string, guest?: string) { return assetRequest<Asset[]>(`/api/v1/projects/${projectId}/assets`, guest); }
export function uploadAsset(projectId: string, file: File) {
  const form = new FormData(); form.append('file', file);
  return apiFetch<Asset>(`/api/v1/projects/${projectId}/assets`, { method: 'POST', body: form });
}
export function listAssetComments(pageId: string, guest?: string) { return assetRequest<Schemas['CommentOut'][]>(`/api/v1/pages/${pageId}/comments`, guest); }
export function createAssetComment(projectId: string, assetId: string, body: Schemas['AssetCommentCreate'], guest?: string) { return assetRequest<Schemas['CommentOut']>(`/api/v1/projects/${projectId}/assets/${assetId}/comments`, guest, { method: 'POST', body: JSON.stringify(body) }); }
export function replyToComment(commentId: string, body: string, layer: 'client' | 'team', guest?: string) { return assetRequest<Schemas['CommentOut']>(`/api/v1/comments/${commentId}/replies`, guest, { method: 'POST', body: JSON.stringify({ body, layer }) }); }
export function reanchorComment(commentId: string, payload: { region: Region }, guest?: string) { return assetRequest<Schemas['CommentOut']>(`/api/v1/comments/${commentId}/reanchor`, guest, { method: 'PATCH', body: JSON.stringify({ anchor: { tier: 1, dom_fingerprint: { selector_path: "", tag: "", attributes: {}, node_hash: "", ancestor_path_hash: "" }, text_fingerprint: { normalized_text: "", text_similarity_hash: "" }, region: payload.region } }) }); }
