import { computeIdentity, getDirectText, getStableAttributes } from "./node-identity";
import { computeSimhash } from "./simhash";
import type { AnchorPayload, DomFingerprint } from "./types";

// Tier 1 only (08-Anchor-Engine.md §8.2) - Tier 2 text-similarity fallback and Tier 3
// visual fingerprint are the Recovery Engine's concern (Milestone 8's diff pipeline),
// not capture time. This must stay fast (< 50ms, 07-Review-SDK.md §7.7) since it runs
// synchronously on tap.

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

export async function computeAnchor(el: Element): Promise<AnchorPayload> {
  const tag = el.tagName.toLowerCase();
  const attributes = getStableAttributes(el);

  // node_hash/ancestor_path_hash use the exact same scheme captureSnapshot() uses
  // (docs/tdr/0004-anchor-snapshot-shared-hash-scheme.md) - without this, the Anchor
  // Engine's matcher could never find this element in a later snapshot, even
  // unchanged, since the hashes wouldn't be computed the same way.
  const { nodeHash, ancestorPathHash } = await computeIdentity(el);

  // Direct text only, matching what a snapshot node's own `text` field holds - not
  // el.textContent, which would include descendant elements' text and so wouldn't
  // match the snapshot's per-node text for anything with nested markup.
  const normalizedText = getDirectText(el).toLowerCase();

  const domFingerprint: DomFingerprint = {
    selector_path: buildSelectorPath(el),
    tag,
    attributes,
    node_hash: nodeHash,
    ancestor_path_hash: ancestorPathHash,
  };

  return {
    tier: 1,
    dom_fingerprint: domFingerprint,
    text_fingerprint: {
      normalized_text: normalizedText,
      text_similarity_hash: computeSimhash(normalizedText),
    },
  };
}
