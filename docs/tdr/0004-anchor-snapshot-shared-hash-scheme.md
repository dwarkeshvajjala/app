# TDR-0004: Anchor and Snapshot node identity must share one hash scheme

Date: 2026-07-12
Status: Accepted

## Context

`08-Anchor-Engine.md` §8.3's matching order depends on comparing a stored anchor's
fingerprint against nodes in a *later* Normalized DOM Snapshot (`09-Snapshot-Engine.md`) -
"Exact DOM path match (same selector path exists in new snapshot)" only means something
if the anchor and the snapshot compute node identity the same way.

Milestone 3's implementation didn't do this. `anchor.ts` (computed once, at click time,
for a single element) hashed `sha256(normalized full textContent)` for `text_hash` and a
list of per-ancestor selector-segment hashes for `ancestor_hashes`. `dom-snapshot.ts`
(walks the whole page) hashes `sha256(tag|stable_attributes|direct_text)` for `node_hash`
and a chained `sha256(parent_ancestor_hash|node_hash)` for `ancestor_path_hash`. These are
different inputs producing unrelated hash values - even for the exact same element on a
completely unchanged page, an anchor's hashes would never equal the corresponding node's
hashes in a snapshot taken moments later. Tier 1 exact-match (§8.3 step 1) would never
fire, not even in the trivial "identical page" case Milestone 5's golden dataset requires.

## Decision

Both computations now go through one shared module (`apps/widget/src/node-identity.ts`):
`computeNodeHash(el)` (tag + stable attributes + direct text, matching
`09-Snapshot-Engine.md` §9.6 exactly) and `computeIdentity(el)`, which walks the same
body-rooted ancestor chain `dom-snapshot.ts` walks and produces the identical
`ancestor_path_hash` a full-page snapshot would have computed for that element.
`anchor.ts`'s `DomFingerprint` now carries `node_hash`/`ancestor_path_hash` (matching the
snapshot's own field names and semantics) instead of the old, incompatible
`text_hash`/`ancestor_hashes`. `text_fingerprint.normalized_text` is unchanged - it was
always a plain string comparison, not a hash, so it had no cross-scheme mismatch problem.

## Consequences

- `backend/app/modules/comments/schemas.py`'s `DomFingerprintIn` changed field names to
  match (`node_hash`, `ancestor_path_hash`); any anchor payload captured before this
  change is shaped differently and won't match-eligible against post-change snapshots -
  acceptable pre-launch, called out here so it isn't mistaken for new data corruption.
- This is what makes `modules/anchor_engine`'s matcher (Milestone 5) meaningful: it can
  now do a direct hash-equality lookup against a snapshot's `nodes_index` and get a real
  answer, rather than comparing two fingerprints that were never in the same space.
- Confirms Milestone 5's scope split: the matching/confidence-scoring function is real
  and tested now (against synthetic snapshot-pair fixtures, `docs/spec/19-Testing-CI.md`
  §19.2); wiring it to run automatically whenever a revision changes - the diff engine,
  `recovery_logs` persistence, and orchestration - is Milestone 8
  (`10-Revision-Recovery.md`), per `20-Build-Plan.md`'s explicit "no recovery/diffing
  yet" scope note for Milestone 5.
