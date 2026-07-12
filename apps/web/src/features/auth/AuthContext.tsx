import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { getAccessToken, onAccessTokenChange, setAccessToken } from "../../lib/auth-token";
import { decodeAccessToken } from "../../lib/jwt";
import * as authApi from "./api";
import type { UserOut } from "./api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: UserOut | null;
  workspaceId: string | null;
  role: string | null;
  requestOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  loginWithGoogleCode: (code: string) => Promise<void>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<UserOut | null>(null);
  // Bumped on every access-token change purely to force a re-render; decoding a JWT
  // payload is cheap enough that it doesn't need useMemo, so there's no dependency
  // array to keep in sync with it.
  const [, forceUpdate] = useState(0);
  useEffect(() => onAccessTokenChange(() => forceUpdate((v) => v + 1)), []);

  const currentToken = getAccessToken();
  const payload = currentToken ? decodeAccessToken(currentToken) : null;

  useEffect(() => {
    // Access tokens live in memory only (13-Authentication.md §13.6), so a page reload
    // loses them - try to silently restore a session from the httpOnly refresh cookie.
    let cancelled = false;
    authApi
      .refreshSession()
      .then((result) => {
        if (cancelled) return;
        setAccessToken(result.access_token);
        setUser(result.user);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("unauthenticated");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value: AuthContextValue = {
    status,
    user,
    workspaceId: payload?.workspace_id ?? null,
    role: payload?.role ?? null,
    async requestOtp(email) {
      await authApi.requestOtp(email);
    },
    async verifyOtp(email, code) {
      const result = await authApi.verifyOtp(email, code);
      setAccessToken(result.access_token);
      setUser(result.user);
      setStatus("authenticated");
    },
    async loginWithGoogleCode(code) {
      const result = await authApi.exchangeGoogleCode(code);
      setAccessToken(result.access_token);
      setUser(result.user);
      setStatus("authenticated");
    },
    async switchWorkspace(workspaceId) {
      const result = await authApi.switchWorkspace(workspaceId);
      setAccessToken(result.access_token);
    },
    async logout() {
      await authApi.logout().catch(() => undefined);
      setAccessToken(null);
      setUser(null);
      setStatus("unauthenticated");
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// The useAuth hook belongs next to the context/provider it reads, not split into its
// own file for one export.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
