// 08-Anchor-Engine.md §8.1 specifies a `text_similarity_hash` (SimHash) alongside
// `normalized_text` - exact-string text matching can never satisfy the "element text
// edited slightly" golden dataset case (19-Testing-CI.md §19.2) by definition, since the
// text itself changed. SimHash bit-fingerprints are close in Hamming distance for
// similar inputs, so a small edit still matches approximately.
//
// Character trigrams, not word tokens: empirically verified (scratch script, not
// checked in) that word-level shingling gives poor discrimination on short strings like
// button labels - a 2-4 word phrase barely has enough shingles for the bit-vote to mean
// anything, and unrelated short phrases end up nearly as "similar" as genuinely edited
// ones. Character trigrams give every string, however short, dozens of overlapping
// shingles, which is what SimHash actually needs to work.
//
// FNV-1a (not a cryptographic hash - doesn't need to be, this only needs good bit
// distribution) per shingle, then a standard 64-bit SimHash bit-vote.

function fnv1a(str: string): bigint {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i));
    hash = (hash * prime) & mask;
  }
  return hash;
}

function trigrams(text: string): string[] {
  const padded = `  ${text}  `;
  const result: string[] = [];
  for (let i = 0; i <= padded.length - 3; i++) {
    result.push(padded.slice(i, i + 3));
  }
  return result.length > 0 ? result : [text];
}

export function computeSimhash(text: string): string {
  if (text.length === 0) return "0".repeat(16);

  const bitCounts = new Array<number>(64).fill(0);
  for (const shingle of trigrams(text)) {
    const h = fnv1a(shingle);
    for (let bit = 0; bit < 64; bit++) {
      const isSet = (h & (1n << BigInt(bit))) !== 0n;
      bitCounts[bit] += isSet ? 1 : -1;
    }
  }

  let signature = 0n;
  for (let bit = 0; bit < 64; bit++) {
    if (bitCounts[bit] > 0) signature |= 1n << BigInt(bit);
  }
  return signature.toString(16).padStart(16, "0");
}
