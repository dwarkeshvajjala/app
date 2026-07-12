# 09 - Snapshot Engine

Instead of storing raw HTML (which is noisy, render-order-dependent, and full of irrelevant detail), Backline defines a **Normalized DOM Snapshot**: a compact, structured representation of a page's meaningful content at a point in time. This is what the Anchor Engine matches against.

## 9.1 Normalized Snapshot Shape

```json
{
  "revision_id": "rev_45",
  "page_id": "page_12",
  "captured_at": "2026-07-01T10:00:00Z",
  "viewport": { "width": 1440, "height": 900 },
  "node_tree": {
    "node_id": "n_0",
    "tag": "html",
    "children": [
      {
        "node_id": "n_1",
        "tag": "body",
        "children": [ "... recursive ..." ]
      }
    ]
  },
  "nodes_index": {
    "n_2291": {
      "tag": "button",
      "attributes": { "class": "btn btn-primary", "data-testid": "upgrade-cta" },
      "text": "Upgrade to Pro",
      "bounding_box": { "x": 240, "y": 812, "w": 160, "h": 44 },
      "computed_style_subset": { "display": "inline-block", "font-size": "14px", "color": "#fff", "background-color": "#1a1a2e" },
      "role": "button",
      "accessible_name": "Upgrade to Pro",
      "node_hash": "sha256:9f2a...",
      "ancestor_path_hash": "sha256:aa11..."
    }
  },
  "full_page_hash": "sha256:c4d5..."
}
```

## 9.2 What Gets Captured Per Node

- **Structural**: tag, position among siblings, depth.
- **Stable identity attributes**: `id`, `data-testid`, `class` (class list, not computed CSSOM).
- **Text**: visible text content, normalized (whitespace-collapsed, lowercased for hashing purposes only - original casing preserved for display).
- **Style subset** - not the full computed style (too noisy, too large): only properties that affect visual identity for matching purposes (`display`, `font-size`, `color`, `background-color`, dimensions).
- **Accessibility**: ARIA role and accessible name - these are often more stable across redesigns than class names, and matter for the accessibility bar (`02-Engineering-Principles.md` §2.6).
- **Bounding box**: from `getBoundingClientRect()` at capture time.
- **Hashes**: a per-node hash (tag + stable attributes + text) and an ancestor-path hash (hash of the chain of parent hashes up to `body`) - this is what Tier 1/2 anchor matching (`08-Anchor-Engine.md`) actually compares.

## 9.3 What's Deliberately Excluded

- Full computed CSSOM (hundreds of properties per node) - far too large, and nearly all irrelevant to "is this the same element."
- Inline `<script>`/`<style>` contents.
- Third-party iframe contents (cross-origin, inaccessible anyway).
- Non-visible nodes (`display: none`, zero-area) unless they were the direct target of a comment (kept for that specific node so an already-anchored comment doesn't spuriously orphan just because a modal closed).

## 9.4 Capture Trigger

- On every guest session's first page view of a URL not yet registered for the project (creates the *first* revision for that page).
- On a manual "re-check for changes" action from the dashboard.
- On a scheduled poll (configurable per project, default: daily) - catches deploys the agency didn't explicitly announce.

Capture is **not** triggered on every single guest visit - that would create a new revision per page-load, which defeats the purpose of revisions representing actual deploys. A new snapshot only becomes a new **revision** if the Revision Engine's diff (`10-Revision-Recovery.md`) finds a meaningful change; otherwise it's discarded as a no-op re-capture.

## 9.5 Storage Strategy

- The full snapshot JSON is compressed (gzip) and stored in Cloudflare R2, keyed `snapshots/{project_id}/{revision_id}/snapshot.json.gz` (`18-Storage-Deployment.md`).
- MongoDB stores only the snapshot's metadata and top-level hashes (`revisions` collection, `11-Database.md`) - not the full node tree - so Mongo document size stays bounded and queries stay fast. The Anchor/Recovery Engine fetches the full snapshot from R2 only when it needs to diff or match against it.

## 9.6 Hashing Strategy

- **Per-node hash**: `sha256(tag + sorted(stable_attributes) + normalized_text)`. Cheap, deterministic, stable across whitespace/formatting-only changes.
- **Ancestor-path hash**: `sha256(parent.ancestor_path_hash + node.node_hash)`, computed root-down - lets the matcher compare "is this node in the same structural position" without a full tree walk each time.
- **Full-page hash**: hash of all node hashes concatenated in document order - a cheap first check to decide "did anything change at all" before running the (more expensive) diff engine.
