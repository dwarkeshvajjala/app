import type { Schemas } from "@backline/types";
import { apiFetch } from "../../lib/api-client";

export type Client = Schemas["ClientOut"];
export function listClients(workspaceId: string) {
  return apiFetch<Client[]>(`/api/v1/workspaces/${workspaceId}/clients`);
}
export function createClient(workspaceId: string, body: Schemas["ClientCreate"]) {
  return apiFetch<Client>(`/api/v1/workspaces/${workspaceId}/clients`, { method: "POST", body: JSON.stringify(body) });
}
export function updateClient(workspaceId: string, id: string, body: Schemas["ClientUpdate"]) {
  return apiFetch<Client>(`/api/v1/workspaces/${workspaceId}/clients/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}
export function archiveClient(workspaceId: string, id: string) {
  return apiFetch<void>(`/api/v1/workspaces/${workspaceId}/clients/${id}`, { method: "DELETE" });
}
