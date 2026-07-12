// sessionStorage, not localStorage: a share link's guest identity shouldn't silently
// persist across unrelated future visits from the same device (07-Review-SDK.md §7.2).
export interface StoredGuestSession {
  guestSessionToken: string;
  displayName: string;
}

function storageKey(shareToken: string): string {
  return `backline:guest-session:${shareToken}`;
}

export function getStoredGuestSession(shareToken: string): StoredGuestSession | null {
  const raw = sessionStorage.getItem(storageKey(shareToken));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredGuestSession;
  } catch {
    return null;
  }
}

export function setStoredGuestSession(shareToken: string, session: StoredGuestSession): void {
  sessionStorage.setItem(storageKey(shareToken), JSON.stringify(session));
}
