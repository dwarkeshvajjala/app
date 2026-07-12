# TDR-0003: Screenshot rasterization must load the SVG via a data: URI, not blob:

Date: 2026-07-12
Status: Accepted

## Context

`07-Review-SDK.md` §7.4 step 3 specifies "dom-to-image-style rasterization" for viewport
screenshots: serialize the DOM into an SVG `<foreignObject>`, draw it to a `<canvas>`,
export via `canvas.toBlob()`. The first implementation loaded the serialized SVG as an
`<img>` via `URL.createObjectURL(svgBlob)` (a `blob:` URL). Verified against real Chromium
(Playwright, headless) on a fully same-origin, no-external-resources test page: every
single capture failed with `Tainted canvases may not be exported`, at 100% - not the
occasional cross-origin edge case the spec anticipates (P5, Graceful Failure), but always.

Chrome unconditionally treats a `foreignObject`-bearing SVG loaded via a `blob:` URL as
tainting the canvas on draw, regardless of whether the embedded HTML content is same-origin.
This is a known characteristic of this rasterization technique, not a bug in this app's
code (`dom-to-image`, which `07-Review-SDK.md` names as the reference technique, has the
same underlying constraint).

## Decision

Load the serialized SVG via a `data:image/svg+xml;charset=utf-8,<encoded>` URI instead of
a `blob:` URL. Verified empirically (same Playwright setup): this avoids the taint
entirely for same-origin content, and `canvas.toBlob()` succeeds. Genuine cross-origin
content embedded in the page (a cross-origin `<img>`, a cross-origin stylesheet whose
`cssRules` throws a `SecurityError` when read) still taints the canvas or fails to
inline, and is still handled by the existing try/catch → `capture_status: "failed"` path -
that failure mode is real and correctly anticipated by the spec; the blob: URL issue was
a false failure that would have fired even when nothing cross-origin was involved.

## Consequences

- `apps/widget/src/screenshot.ts` uses `data:` URIs; do not revert to `blob:` for this
  specific `<img src>` without re-verifying against a real browser first.
- Data URIs have a practical size ceiling (implementation-defined, but generous in modern
  Chrome - hundreds of MB) that a single serialized viewport is very unlikely to approach;
  if very large/complex pages ever hit it, that failure still routes through the same
  try/catch and `capture_status: "failed"` path, so it degrades the same way rather than
  crashing the SDK.
- This was caught by driving the actual built widget in headless Chromium (Playwright),
  not by unit tests or type-checking - `docs/spec/19-Testing-CI.md`'s test pyramid doesn't
  yet include a headless-browser check for the widget; worth adding when Milestone 3's
  Playwright journeys are written (`19-Testing-CI.md` §19.3).
