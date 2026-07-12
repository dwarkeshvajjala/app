import { create } from "zustand";

import type { ConnectionStatus } from "../lib/ws-client";

// 14-State-Management.md §14.4: "WebSocket connection status... is a client fact about
// the client's own connection, not server data" - the first genuine use of a Zustand
// store in this app (Milestone 6's board filters stayed in URL params instead, see
// docs/tdr/0005 - this is exactly the cross-component need that TDR deferred to).
interface ConnectionState {
  status: ConnectionStatus;
  setStatus: (status: ConnectionStatus) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: "disconnected",
  setStatus: (status) => set({ status }),
}));
