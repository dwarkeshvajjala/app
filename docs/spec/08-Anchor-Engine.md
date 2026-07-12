# 08 - Anchor Engine

This is the primary technical differentiator (`01-Product-Vision.md` §1.7) - but per §1.2, it's a **quality bar**, not a v1 marketing feature. MVP implements Tier 1 (DOM fingerprint) fully, and Tier 2/3 as documented interfaces so they can be filled in post-MVP without a redesign (Rule 4, Deterministic Before Intelligent - cheapest/most-reliable strategy first, always).

## 8.1 What an Anchor Is

```json
{
  "tier": 1,
  "dom_fingerprint": {
    "selector_path": "main > section:nth-of-type(2) > .pricing-card:nth-of-type(3) > button",
    "tag": "button",
    "attributes": { "class": "btn btn-primary", "data-testid": "upgrade-cta" },
    "text_hash": "sha256:9f2a...",
    "ancestor_hashes": ["sha256:aa11...", "sha256:bb22..."]
  },
  "text_fingerprint": {
    "normalized_text": "upgrade to pro",
    "text_similarity_hash": "simhash:0x1a2b3c"
  },
  "visual_fingerprint": {
    "bounding_box": { "x": 240, "y": 812, "w": 160, "h": 44 },
    "perceptual_hash": "phash:9e3f...",
    "cropped_region_key": "r2://snapshots/proj_123/rev_45/crops/elem_9.png"
  },
  "snapshot_ref": { "revision_id": "rev_45", "node_id": "n_2291" }
}
```

## 8.2 Fingerprinting Strategies (Tiered)

| Tier | Strategy | MVP status | Cost | Reliability |
|---|---|---|---|---|
| 1 | **DOM fingerprint** - structural selector path + stable attributes (`id`, `data-testid`, `class`) + position among siblings | Implemented in MVP | Cheapest | High when markup is stable, brittle across restructures |
| 2 | **Text fingerprint** - normalized visible text + a similarity hash (SimHash), so an element that moved but kept its label is still findable | Implemented in MVP as a fallback when Tier 1 fails | Low | Good for content-bearing elements, useless for icon-only buttons |
| 3 | **Visual fingerprint** - bounding box + perceptual hash of the cropped screenshot region | v-next, interface only in MVP | Highest | Best against pure restyle/reflow, requires stored snapshot crops |

## 8.3 Matching / Recovery Order

When a page's new revision is diffed against the previous one (`10-Revision-Recovery.md`), each existing comment's anchor is re-resolved against the new Snapshot's node tree in this order, stopping at the first confident match:

1. Exact DOM path match (same selector path exists in new snapshot) - confidence `1.0`.
2. Stable-attribute match (`data-testid`/`id` unchanged, path changed) - confidence `0.9`.
3. Text fingerprint match (normalized text found once, uniquely, in new snapshot) - confidence `0.7`.
4. Text fingerprint match with multiple candidates (ambiguous) - confidence `0.4`, flagged `low_confidence`.
5. No match found by any deterministic strategy - `orphaned`.

Tier 3 (visual) is reserved as a future step between 3 and 4 above, once implemented.

## 8.4 Confidence Scoring

```
confidence = strategy_base_score
             - 0.1 * (num_ambiguous_candidates - 1)   # ambiguity penalty
             - 0.05 * revisions_since_last_confirmed    # staleness penalty, capped
```
Thresholds: `>= 0.75` -> `ok` (render normally), `0.4-0.75` -> `low_confidence` (visually flagged per P4), `< 0.4` -> `orphaned` (comment stays fully intact, just detached - the body/screenshot/metadata are never deleted, only the *position* is marked unresolved).

## 8.5 Anchor Lifecycle State Machine

```
created
  -> active (ok)
       -> [revision diff detected] -> recovery_pending
              -> ok / low_confidence  (re-confirmed on next diff -> back to active)
              -> orphaned
                     -> [2+ consecutive diffs with no match] -> permanently_orphaned
```
A comment never transitions out of `orphaned` back to a fabricated position - a human (agency member) can manually re-anchor an orphaned comment to a new element, which is logged as a distinct `anchor.manually_reassigned` event (`06-Backend-Architecture.md` §6.6).

## 8.6 Recovery Logs

Every recovery attempt (successful or not) writes a `recovery_logs` document (`11-Database.md`) recording: `comment_id`, `from_revision_id`, `to_revision_id`, `strategy_used`, `confidence`, `candidates_considered` (count), `outcome`. This is what makes P4 (Human First) auditable - an agency can see *why* the system thinks a comment is still valid, not just a green checkmark.

## 8.7 Explicitly Out of Scope for MVP

- Cross-page anchor recovery (element moved to a different URL entirely) - not attempted.
- ML-based visual similarity beyond a plain perceptual hash - no learned model in MVP.
- Automatic anchor merging when two orphaned comments are detected as referring to the same element - flagged for a human, never auto-merged (P4).
