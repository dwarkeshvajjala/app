import { sha256 } from "./hash";
import type { AnchorPayload, DomFingerprint } from "./types";

// Tier 1 only (08-Anchor-Engine.md §8.2) - Tier 2 text-similarity fallback and Tier 3
// visual fingerprint are the Recovery Engine's concern (Milestone 5), not capture time.
// This must stay fast (< 50ms, 07-Review-SDK.md §7.7) since it runs synchronously on tap.

function nthOfTypeIndex(el: Element): number {
  let index = 1;
  let sibling = el.previousElementSibling;
  while (sibling) {
    if (sibling.tagName === el.tagName) index += 1;
    sibling = sibling.previousElementSibling;
  }
  return index;
}

function selectorSegment(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `${tag}#${el.id}`;
  return `${tag}:nth-of-type(${nthOfTypeIndex(el)})`;
}

function buildSelectorPath(el: Element): string {
  const segments: string[] = [];
  let current: Element | null = el;
  while (current && current !== document.body) {
    segments.unshift(selectorSegment(current));
    current = current.parentElement;
  }
  return `body > ${segments.join(" > ")}`;
}

function ancestorChain(el: Element): Element[] {
  const chain: Element[] = [];
  let current = el.parentElement;
  while (current) {
    chain.push(current);
    current = current.parentElement;
  }
  return chain;
}

export async function computeAnchor(el: Element): Promise<AnchorPayload> {
  const tag = el.tagName.toLowerCase();
  const attributes: Record<string, string> = {};
  if (el.getAttribute("class")) attributes.class = el.getAttribute("class")!;
  if (el.getAttribute("data-testid")) attributes["data-testid"] = el.getAttribute("data-testid")!;

  const normalizedText = (el.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const textHash = await sha256(normalizedText);

  const ancestors = ancestorChain(el);
  const ancestorHashes = await Promise.all(
    ancestors.map((ancestor) => sha256(selectorSegment(ancestor))),
  );

  const domFingerprint: DomFingerprint = {
    selector_path: buildSelectorPath(el),
    tag,
    attributes,
    text_hash: textHash,
    ancestor_hashes: ancestorHashes,
  };

  return {
    tier: 1,
    dom_fingerprint: domFingerprint,
    text_fingerprint: { normalized_text: normalizedText },
  };
}
