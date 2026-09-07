import type { Schemas } from "@backline/types";

import { apiFetch } from "../../lib/api-client";

export type UserOut = Schemas["UserOut"];
export type TokenPairOut = Schemas["TokenPairOut"];
export type AccessTokenOut = Schemas["AccessTokenOut"];

export function requestOtp(email: string): Promise<void> {
  return apiFetch<void>("/api/v1/auth/otp/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function verifyOtp(email: string, code: string): Promise<TokenPairOut> {
  return apiFetch<TokenPairOut>("/api/v1/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

export function exchangeGoogleCode(code: string): Promise<TokenPairOut> {
  return apiFetch<TokenPairOut>("/api/v1/auth/google/callback", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function switchWorkspace(workspaceId: string): Promise<AccessTokenOut> {
  return apiFetch<AccessTokenOut>("/api/v1/auth/switch-workspace", {
    method: "POST",
    body: JSON.stringify({ workspace_id: workspaceId }),
  });
}

export function logout(): Promise<void> {
  return apiFetch<void>("/api/v1/auth/logout", { method: "POST" });
}

export function refreshSession(): Promise<TokenPairOut> {
  return apiFetch<TokenPairOut>("/api/v1/auth/refresh", { method: "POST" });
}

export interface UserPreferencesOut {
  notify_on_assignment: boolean;
  notify_on_mention: boolean;
  notify_on_reply: boolean;
  notify_on_status_change: boolean;
  daily_digest: boolean;
}

export interface UserUpdateRequest {
  name?: string | null;
  preferences?: UserPreferencesOut | null;
}

// We override UserOut locally to include preferences since types aren't regenerated yet.
export type UserOutWithPrefs = UserOut & { preferences: UserPreferencesOut };

export function updateProfile(updates: UserUpdateRequest): Promise<UserOutWithPrefs> {
  return apiFetch<UserOutWithPrefs>("/api/v1/auth/me", {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export interface SessionOut {
  id: string;
  current: boolean;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  created_at: string;
  last_active_at: string;
}

export function listSessions(): Promise<SessionOut[]> {
  return apiFetch<SessionOut[]>("/api/v1/auth/sessions", { method: "GET" });
}

export function revokeSession(familyId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/auth/sessions/${familyId}`, { method: "DELETE" });
}
