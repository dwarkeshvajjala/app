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
