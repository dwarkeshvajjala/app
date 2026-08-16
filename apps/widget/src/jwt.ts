// Client-side JWT payload decoding, for UI convenience only (deciding "is this comment
// mine" so the delete/edit affordances show up correctly) - never used to make an
// authorization decision, since the signature isn't verified here. The backend
// re-checks authorship itself on every delete/reply call regardless
// (core/session.py's GuestTokenClaims.sub is the same guest_session_id this decodes).
// Mirrors apps/web/src/lib/jwt.ts's identical approach on the dashboard side.
export function decodeGuestSessionId(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    const claims = JSON.parse(atob(padded)) as { sub?: string };
    return claims.sub ?? null;
  } catch {
    return null;
  }
}
