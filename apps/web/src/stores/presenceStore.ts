import { create } from "zustand";

// Keyed by page_id (12-API-WebSocket.md §12.6's `presence.updated` payload shape):
// which reviewers are currently on a given reviewed page, as observed by the widget's
// own WS connections - not something React Query owns, since it's never fetched via
// REST, only ever pushed.
interface PresenceState {
  byPageId: Record<string, string[]>;
  setPresence: (pageId: string, activeSessions: string[]) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  byPageId: {},
  setPresence: (pageId, activeSessions) =>
    set((state) => ({ byPageId: { ...state.byPageId, [pageId]: activeSessions } })),
}));
