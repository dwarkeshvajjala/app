// Client-side JWT payload decoding, for UI convenience only (e.g. "which workspace
// is active", "what's my role badge") - never used to make an authorization
// decision, since the signature isn't verified here. The backend re-checks every
// permission on every request regardless (05-Frontend-Architecture.md §5.5).
export interface AccessTokenPayload {
  sub: string;
  workspace_id: string | null;
  role: string | null;
  iat: number;
  exp: number;
}

export function decodeAccessToken(token: string): AccessTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    return JSON.parse(atob(padded)) as AccessTokenPayload;
  } catch {
    return null;
  }
}
