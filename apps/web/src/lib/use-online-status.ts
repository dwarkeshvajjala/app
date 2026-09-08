import { useEffect, useState } from "react";

// Guest review surfaces (AssetReview/GuestBoard in guest mode) render outside
// WorkspaceLayout, so they never get its WebSocket-derived bl-conn-banner
// (useConnectionStore is scoped to the authenticated workspace socket). This is
// the guest-safe equivalent: plain browser online/offline events, no auth needed.
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    function goOnline() { setOnline(true); }
    function goOffline() { setOnline(false); }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
