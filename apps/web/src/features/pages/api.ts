import type { Schemas } from "@backline/types";

import { apiFetch } from "../../lib/api-client";

export type PageOut = Schemas["PageOut"];

export function listProjectPages(projectId: string): Promise<PageOut[]> {
  return apiFetch<PageOut[]>(`/api/v1/projects/${projectId}/pages`);
}
