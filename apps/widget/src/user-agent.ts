// Lightweight, custom parser rather than a UA-parsing library - the SDK's bundle-size
// budget (07-Review-SDK.md §7.7) can't absorb one, and 01-Product-Vision.md §1.10 only
// asks for accuracy across "the top 20 browser/OS combos," not universal coverage.

export interface ParsedUserAgent {
  browser: string;
  os: string;
  device_type: "mobile" | "tablet" | "desktop";
}

function detectBrowser(ua: string): string {
  if (/EdgiOS|Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/SamsungBrowser/.test(ua)) return "Samsung Internet";
  if (/CriOS|Chrome/.test(ua)) return "Chrome";
  if (/FxiOS|Firefox/.test(ua)) return "Firefox";
  if (/Version\/.*Safari/.test(ua) || /^((?!Chrome|Android).)*Safari/.test(ua)) return "Safari";
  return "Unknown";
}

function detectOs(ua: string): string {
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown";
}

function detectDeviceType(ua: string): "mobile" | "tablet" | "desktop" {
  if (/iPad/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) return "tablet";
  if (/Mobi|iPhone|iPod/.test(ua)) return "mobile";
  return "desktop";
}

export function parseUserAgent(ua: string): ParsedUserAgent {
  return {
    browser: detectBrowser(ua),
    os: detectOs(ua),
    device_type: detectDeviceType(ua),
  };
}
