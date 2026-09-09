# 07 - Review SDK

The Review SDK is what actually runs inside the reviewed website's browser context. It is deliberately **not** a React app: it's a small (target < 40KB gzipped) vanilla TypeScript bundle, because it's injected into third-party pages where bundle size directly affects the acceptance criterion of "comment posted in under 30 seconds from link-tap."

## 7.1 Delivery

- **Snippet mode:** `<script async src="https://cdn.backline.app/sdk.v1.js" data-project-token="...">`.
- **Proxy mode:** injected server-side by the reverse proxy (`03-System-Architecture.md` §3.3) into the `<head>` of every proxied HTML response, no site changes required.

Both converge on the same `Backline.init(config)` entrypoint.

## 7.2 Initialization

```js
Backline.init({
  shareToken: "...",
  mode: "snippet" | "proxy",
  apiBaseUrl: "..."       // optional; defaults to the Backline API origin
});
```
The snippet's historical `data-project-token` attribute contains a share-link token; it
does not introduce a second project-token authentication model. Snippet and proxy modes
both resolve the same share link and create the same scoped guest session. See TDR-0002.

On init, the SDK:
1. Resolves or creates a **guest session** (`POST /api/v1/guest-sessions`) - first visit prompts for a display name only (F1 acceptance criterion); the session ID is stored in `sessionStorage`, not `localStorage`, since a share link's identity shouldn't silently persist across unrelated future visits from the same device beyond the session.
2. Registers the current page (`POST /api/v1/pages` - idempotent on normalized URL) if it hasn't been seen before.
3. Requests the current **Snapshot Engine** capture (`09-Snapshot-Engine.md`) of the page in its current state.
4. Opens a WebSocket connection scoped to the share link's project, for realtime presence/typing/new-comment updates from teammates also reviewing.
5. Renders the floating pin-drop affordance (single tooltip, dismissed after first successful comment - F7 empty-state requirement).

## 7.3 Injection Strategy

- Snippet mode: script tag loads asynchronously, does not block page render; SDK UI renders in a Shadow DOM root to avoid CSS collisions with the host page.
- Proxy mode: SDK is injected server-side, same Shadow DOM isolation, but the proxy also rewrites relative asset URLs so the target site's own resources still resolve correctly through the proxy origin.

## 7.4 Capture Pipeline (Pin -> Posted Comment)

1. **Click/tap** anywhere on the page - SDK computes the target element via `document.elementFromPoint(x, y)`.
2. **Anchor computation** (`08-Anchor-Engine.md`): DOM fingerprint + text fingerprint computed synchronously, client-side, in under ~50ms for typical DOM sizes.
3. **Screenshot capture**: `dom-to-image`-style rasterization of the current viewport (not the whole page - viewport only, to keep payload size and capture time bounded). On capture failure (canvas taint from cross-origin content, etc.), the SDK proceeds without a screenshot (P5, Graceful Failure) and flags `capture_status: "failed"`.
4. **Metadata capture**: page URL (normalized), `navigator.userAgent` parsed into browser+version+OS, viewport dimensions, device type (via a lightweight UA-based heuristic, not a network call).
5. **Upload**: screenshot uploaded directly to R2 via a pre-signed URL obtained from `POST /api/v1/uploads` (the SDK never sees R2 credentials).
6. **Submit**: `POST /api/v1/pages/{page_id}/comments` with anchor + metadata + screenshot key + body text.
7. **Optimistic UI**: the comment pin renders immediately in the SDK's overlay, marked "sending"; reconciled to "sent" on API success or "failed - tap to retry" on failure. The comment is never lost from the user's perspective even on a flaky connection.

## 7.5 Reconnection & Offline Handling

- WebSocket reconnects with exponential backoff (1s, 2s, 4s... capped at 30s), and on reconnect requests a delta sync (`GET /api/v1/pages/{page_id}/comments?since=<last_seen_event_id>`) rather than a full refetch.
- If the network is unavailable at submit time, the comment payload (body + anchor + metadata, screenshot upload deferred) is queued in an in-memory retry queue with a bounded retry count; if the tab closes before it flushes, the draft is not silently lost - it's persisted to `sessionStorage` and offered back ("you have an unsent comment") if the same session resumes within the same browser tab lifetime. This is a deliberate, small scope: full offline-first sync is not an MVP goal (P8, Incremental Delivery) - just "don't lose the last thing someone typed."

## 7.6 Pin Recovery on the Client

When the SDK loads a page that already has comments, it does **not** re-run the full Recovery Engine client-side (that's a backend job, `10-Revision-Recovery.md`) - it simply renders pins at the last known-good anchor position for each comment, using the `recovery_status` field the backend already computed (`ok` / `low_confidence` / `orphaned`). Low-confidence and orphaned pins render with a distinct visual treatment (P4, Human First) rather than silently appearing in the wrong place.

## 7.7 Performance Budget

| Metric | Budget |
|---|---|
| SDK bundle size (gzipped) | < 40KB |
| Time to interactive (pin-drop ready) | < 1s on 4G |
| Anchor computation | < 50ms |
| Screenshot capture | < 500ms (viewport only) |
