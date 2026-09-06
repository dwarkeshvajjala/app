import type { Schemas } from "@backline/types";
import { apiFetch } from "../../lib/api-client";

export function listActivity(workspaceId: string, offset: number, eventType: string) {
  return apiFetch<Schemas["ActivityListOut"]>(`/api/v1/workspaces/${workspaceId}/activity?offset=${offset}&event_type=${encodeURIComponent(eventType)}`);
}
