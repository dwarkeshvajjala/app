import type { Schemas } from "@backline/types";

import { apiFetch } from "../../lib/api-client";

export type ProjectOut = Schemas["ProjectOut"];

export function listProjects(workspaceId: string, includeArchived = false): Promise<ProjectOut[]> {
  return apiFetch<ProjectOut[]>(`/api/v1/workspaces/${workspaceId}/projects?include_archived=${includeArchived}`);
}

export function createProject(
  workspaceId: string,
  name: string,
  targetOrigin: string,
  options: Partial<Schemas["ProjectCreate"]> = {},
): Promise<ProjectOut> {
  return apiFetch<ProjectOut>(`/api/v1/workspaces/${workspaceId}/projects`, {
    method: "POST",
    body: JSON.stringify({ ...options, name, target_origin: targetOrigin }),
  });
}

export function getProject(projectId: string): Promise<ProjectOut> {
  return apiFetch<ProjectOut>(`/api/v1/projects/${projectId}`);
}

export function archiveProject(projectId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/projects/${projectId}`, { method: "DELETE" });
}

export function updateProject(projectId: string, patch: Schemas["ProjectUpdate"]) {
  return apiFetch<ProjectOut>(`/api/v1/projects/${projectId}`, { method: "PATCH", body: JSON.stringify(patch) });
}
export function restoreProject(projectId: string) {
  return apiFetch<ProjectOut>(`/api/v1/projects/${projectId}/restore`, { method: "POST" });
}

export function duplicateProject(projectId: string) {
  return apiFetch<ProjectOut>(`/api/v1/projects/${projectId}/duplicate`, { method: "POST" });
}

export interface ProjectSettingsUpdate {
  capture_device_details?: boolean;
  reanchor_on_deploy?: boolean;
  reviewer_can_resolve?: boolean;
  show_board_to_client?: boolean;
  client_digest_enabled?: boolean;
}

export function updateProjectSettings(projectId: string, settings: ProjectSettingsUpdate) {
  return apiFetch<Schemas["ProjectSettingsOut"]>(`/api/v1/projects/${projectId}/settings`, {
    method: "PATCH",
    body: JSON.stringify(settings),
  });
}
