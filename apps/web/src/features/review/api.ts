import type { Schemas } from "@backline/types";

import { API_BASE_URL, apiFetch } from "../../lib/api-client";

export type ReviewResolveOut = Schemas["ReviewResolveOut"];
export type GuestSessionOut = Schemas["GuestSessionOut"];
export type GuestBoardOut = Schemas["GuestBoardOut"];

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

// Guest requests never carry the member cookie/Authorization header - the guest
// session token rides in X-Guest-Session instead (matches assets/api.ts's
// assetRequest convention, and backend/tests/helpers.py's guest_headers fixture).
export async function getGuestBoard(projectId: string, guestToken: string): Promise<GuestBoardOut> {
  const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/guest-board`, {
    headers: { "X-Guest-Session": guestToken },
  });
  if (!response.ok) {
    throw new Error("Could not load the board.");
  }
  return response.json() as Promise<GuestBoardOut>;
}
