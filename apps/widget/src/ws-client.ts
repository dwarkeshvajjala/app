// Minimal reconnecting WebSocket client for the widget's own realtime signal:
// presence (announced by connecting with `page_id`) and status updates on comments this
// guest created (12-API-WebSocket.md §12.6). Deliberately not shared code with the
// dashboard's apps/web/src/lib/ws-client.ts - the widget is a separate <40KB vanilla-JS
// bundle (07-Review-SDK.md), so the same backoff schedule (1s, 2s, 4s... capped at 30s,
// §7.5) is duplicated here rather than factored into a package neither target needs
// elsewhere.
export function connectReviewSocket(
  apiBaseUrl: string,
  guestToken: string,
  pageId: string,
  onEvent: (type: string, payload: any) => void, // eslint-disable-line @typescript-eslint/no-explicit-any
): () => void {
  const wsBaseUrl = apiBaseUrl.replace(/^http/, "ws");
  let socket: WebSocket | null = null;
  let attempt = 0;
  let closedByCaller = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function open(): void {
    const url = `${wsBaseUrl}/ws?token=${encodeURIComponent(guestToken)}&page_id=${encodeURIComponent(pageId)}`;
    socket = new WebSocket(url);

    socket.onopen = () => {
      attempt = 0;
    };

    socket.onmessage = (event: MessageEvent<string>) => {
      try {
        const envelope = JSON.parse(event.data);
        onEvent(envelope.type, envelope.payload);
      } catch {
        // Malformed frame - nothing to recover, just drop it.
      }
    };

    socket.onclose = () => {
      if (closedByCaller) return;
      const delay = Math.min(1000 * 2 ** attempt, 30_000);
      attempt += 1;
      reconnectTimer = setTimeout(open, delay);
    };

    socket.onerror = () => socket?.close();
  }

  open();

  return () => {
    closedByCaller = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    socket?.close();
  };
}
