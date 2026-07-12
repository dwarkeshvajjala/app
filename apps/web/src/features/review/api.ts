import type { Schemas } from "@backline/types";

import { apiFetch } from "../../lib/api-client";

export type ReviewResolveOut = Schemas["ReviewResolveOut"];
export type GuestSessionOut = Schemas["GuestSessionOut"];

export function resolveShareLink(shareToken: string): Promise<ReviewResolveOut> {
  return apiFetch<ReviewResolveOut>(`/api/v1/review/${shareToken}`);
}

export function createGuestSession(
  shareToken: string,
  displayName: string,
  passcode?: string,
): Promise<GuestSessionOut> {
  return apiFetch<GuestSessionOut>("/api/v1/guest-sessions", {
    method: "POST",
    body: JSON.stringify({
      share_token: shareToken,
      display_name: displayName,
      passcode: passcode || null,
    }),
  });
}
