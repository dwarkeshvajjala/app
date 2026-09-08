import type { Schemas } from "@backline/types";
import { apiFetch } from "../../lib/api-client";

export type SearchResults = Schemas["SearchResultsOut"];

export function searchWorkspace(workspaceId: string, query: string, signal?: AbortSignal) {
  return apiFetch<SearchResults>(`/api/v1/workspaces/${workspaceId}/search?q=${encodeURIComponent(query)}`, { signal });
}
