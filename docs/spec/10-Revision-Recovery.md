# 10 - Revision Engine & Recovery Pipeline

## 10.1 The Chain

```
Page -> Revision -> Snapshot -> Comments (anchored to nodes in a Snapshot)
                 -> Diff (vs. previous Revision's Snapshot) -> Recovery job
```

A **Page** is a normalized URL within a project. A **Revision** is a confirmed, meaningfully-different capture of that page over time (`09-Snapshot-Engine.md` §9.4). Every Comment is anchored against exactly one Revision's Snapshot at creation time, and carries a `current_resolution` that may point at a later Revision once recovery has run.

## 10.2 When a New Revision Is Created

1. A new Snapshot is captured (SDK, on trigger conditions in `09-Snapshot-Engine.md`).
2. Its `full_page_hash` is compared to the current latest Revision's hash for that Page.
3. If identical - discarded, no new Revision (nothing changed).
4. If different - a new Revision is created, and a `revision.created` event is emitted, enqueuing the `run_recovery_pipeline` background job (`06-Backend-Architecture.md` §6.5).

## 10.3 Diff Engine

Compares the new Snapshot's `nodes_index` against the previous Revision's:
- **Unchanged nodes**: identical `node_hash` at the identical `ancestor_path_hash` - no action.
- **Moved nodes**: identical `node_hash`, different `ancestor_path_hash` - recorded as a move; anchors pointing here get "stable-attribute match" tier (`08-Anchor-Engine.md` §8.3, step 2) if `data-testid`/`id` also matches, else "text fingerprint" tier.
- **Modified nodes**: same position, different `node_hash` (text or attributes changed) - recorded as a modification; text-fingerprint similarity checked against the old text to decide if it's "the same element, edited" vs. "the same element, replaced."
- **Removed nodes**: present in old Snapshot, absent in new - any anchors here proceed to Recovery Engine's fallback strategies (text fingerprint search across the whole new tree) before being marked `orphaned`.
- **Added nodes**: present in new only - irrelevant to existing comments, but recorded for completeness (useful context for "what changed" views in v-next).

The diff output is a structured `revision_diff` document (`11-Database.md`), not just a
boolean. It is retained for audit and a future "what changed since you last reviewed"
view; it is not an input to per-comment anchor matching. TDR-0007 supersedes the older
orchestration wording.

## 10.4 Recovery Pipeline Orchestration

For each comment anchored to the *previous* Revision of an affected Page:

```
1. Look up the comment's anchor.
2. Call match_anchor() against the complete new snapshot, independently of the stored diff.
3. Persist the new resolution, confidence/status, and recovery log.
4. Emit `comment.recovery_updated` through the same visibility boundary as the comment.
```

The structural diff and anchor matcher run from the same revision pair but remain
separate artifacts. This avoids duplicating match logic inside the diff classifier.
Recovery runs as a background job (`run_recovery_pipeline`, Arq), scoped per Page, so a
large site's deploy does not block on recovering every comment synchronously.

## 10.5 Permanently Orphaned Determination

A comment marked `orphaned` is re-attempted on every subsequent Revision (in case the element comes back, e.g., a reverted deploy). After **two consecutive** Revisions with no successful match, it's marked `permanently_orphaned` - a distinct status so the dashboard can distinguish "still trying" from "given up," per P4 (Human First) - the user should never wonder whether the system is still looking.

## 10.6 What This Explicitly Does Not Do (MVP Scope Guard)

Per `01-Product-Vision.md` §1.2, this whole subsystem must not become the tail that wags the dog:
- No cross-page recovery.
- No visual (Tier 3) fallback in MVP - text fingerprint is the last deterministic line of defense.
- No automatic notification to the client reviewer when their comment orphans - that's an agency-facing signal only, in MVP; notifying guests is a v-next consideration once the core loop is proven.
