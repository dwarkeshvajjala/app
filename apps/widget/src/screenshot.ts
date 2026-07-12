// Viewport rasterization (07-Review-SDK.md §7.4 step 3): serialize the live DOM into an
// SVG <foreignObject>, rasterize that to a canvas, export as JPEG. This is the same
// fundamental technique libraries like dom-to-image use. It can legitimately fail -
// cross-origin stylesheets can't be read (SecurityError) and cross-origin images inside
// the cloned subtree taint the canvas - both are the "canvas taint from cross-origin
// content" failure mode the spec explicitly anticipates (P5, Graceful Failure): this
// function returns null rather than throwing, and the caller proceeds without a
// screenshot and flags capture_status: "failed".
//
// The SVG must be loaded as a data: URI, not a blob: URL - verified empirically
// (docs/tdr/0003-widget-screenshot-data-uri.md): Chrome unconditionally taints the
// canvas for a foreignObject-bearing SVG loaded via blob:, even with fully same-origin
// content, which would make every single capture fail regardless of cross-origin
// content. A data: URI doesn't hit this restriction.

function collectInlineStyles(): string {
  let css = "";
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        css += rule.cssText + "\n";
      }
    } catch {
      // Cross-origin stylesheet without CORS headers - can't read its rules. Skip it.
    }
  }
  return css;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to rasterize snapshot SVG."));
    img.src = src;
  });
}

export async function captureScreenshot(): Promise<Blob | null> {
  try {
    const width = window.innerWidth;
    const height = window.innerHeight;

    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("[data-backline-root]").forEach((node) => node.remove());

    const css = collectInlineStyles();
    const serializedBody = new XMLSerializer().serializeToString(clone);
    // Without this, the canvas area below the page's actual content height (whenever
    // it's shorter than the viewport) rasterizes as black instead of matching the page.
    const bodyBackground = window.getComputedStyle(document.body).backgroundColor;

    const svgString =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<foreignObject width="100%" height="100%">` +
      `<div xmlns="http://www.w3.org/1999/xhtml" style="background:${bodyBackground};min-height:${height}px;">` +
      `<style>${css}</style>${serializedBody}</div>` +
      `</foreignObject></svg>`;

    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
    const image = await loadImage(dataUrl);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, width, height);

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.8);
    });
  } catch {
    return null;
  }
}
