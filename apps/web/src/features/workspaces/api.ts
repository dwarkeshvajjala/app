import type { Schemas } from "@backline/types";

import { apiFetch } from "../../lib/api-client";

export type WorkspaceOut = Schemas["WorkspaceOut"];
export type MemberOut = Schemas["MemberOut"];

export function listWorkspaces(): Promise<WorkspaceOut[]> {
  return apiFetch<WorkspaceOut[]>("/api/v1/workspaces");
}

export function createWorkspace(name: string): Promise<WorkspaceOut> {
  return apiFetch<WorkspaceOut>("/api/v1/workspaces", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function getWorkspace(workspaceId: string): Promise<WorkspaceOut> {
  return apiFetch<WorkspaceOut>(`/api/v1/workspaces/${workspaceId}`);
}

export function listMembers(workspaceId: string): Promise<MemberOut[]> {
  return apiFetch<MemberOut[]>(`/api/v1/workspaces/${workspaceId}/members`);
}

export function inviteMember(
  workspaceId: string,
  email: string,
  role: "admin" | "member",
): Promise<MemberOut> {
  return apiFetch<MemberOut>(`/api/v1/workspaces/${workspaceId}/members/invite`, {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
}

export function updateMemberRole(
  workspaceId: string,
  memberId: string,
  role: "admin" | "member",
): Promise<void> {
  return apiFetch<void>(`/api/v1/workspaces/${workspaceId}/members/${memberId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export function removeMember(workspaceId: string, memberId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/workspaces/${workspaceId}/members/${memberId}`, {
    method: "DELETE",
  });
}
