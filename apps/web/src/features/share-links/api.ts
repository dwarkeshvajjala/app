import type { Schemas } from "@backline/types";

import { apiFetch } from "../../lib/api-client";

export type ShareLinkOut = Schemas["ShareLinkOut"];

export function listShareLinks(projectId: string): Promise<ShareLinkOut[]> {
  return apiFetch<ShareLinkOut[]>(`/api/v1/projects/${projectId}/share-links`);
}

export function createShareLink(
  projectId: string,
  options: { mode: "snippet" | "proxy"; passcode?: string; expiresAt?: string },
): Promise<ShareLinkOut> {
  return apiFetch<ShareLinkOut>(`/api/v1/projects/${projectId}/share-links`, {
    method: "POST",
    body: JSON.stringify({
      mode: options.mode,
      passcode: options.passcode || null,
      expires_at: options.expiresAt || null,
    }),
  });
}

export function revokeShareLink(shareLinkId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/share-links/${shareLinkId}/revoke`, { method: "PATCH" });
}
