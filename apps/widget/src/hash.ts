// Web Crypto's subtle.digest requires a secure context (https, or localhost for local
// dev) - true of every real deployment target for this SDK (09-Snapshot-Engine.md §9.6).
export async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}
