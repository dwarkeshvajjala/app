from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any


@dataclass
class DiffResult:
    """10-Revision-Recovery.md §10.3. `moved`/`modified` ids are keyed to the *new*
    snapshot's nodes_index; `removed` ids are keyed to the *old* one (they don't exist
    in the new tree at all); `added` ids are keyed to the *new* one.

    Deliberately doesn't classify by text-similarity the way the Anchor Engine's matcher
    does (08-Anchor-Engine.md §8.3's SimHash tier) - this is a structural diff for audit/
    "what changed" purposes (§10.3's own stated use), not the recovery decision itself.
    Per-comment recovery re-runs `anchor_engine.matcher.match_anchor` directly against
    the new snapshot's full nodes_index regardless of which bucket a node landed in
    here, since that function's tiered scan already subsumes this diff's structural
    classification for matching purposes (see docs/tdr/0007)."""

    moved: list[str] = field(default_factory=list)
    modified: list[str] = field(default_factory=list)
    removed: list[str] = field(default_factory=list)
    added: list[str] = field(default_factory=list)


def compute_diff(
    old_nodes_index: dict[str, dict[str, Any]], new_nodes_index: dict[str, dict[str, Any]]
) -> DiffResult:
    new_by_ancestor: dict[str, list[str]] = defaultdict(list)
    new_by_hash: dict[str, list[str]] = defaultdict(list)
    for node_id, node in new_nodes_index.items():
        new_by_ancestor[node["ancestor_path_hash"]].append(node_id)
        new_by_hash[node["node_hash"]].append(node_id)

    matched_new_ids: set[str] = set()
    moved: list[str] = []
    modified: list[str] = []
    removed: list[str] = []

    for old_id, old_node in old_nodes_index.items():
        old_hash = old_node["node_hash"]
        old_ancestor = old_node["ancestor_path_hash"]

        # Unchanged: same content at the same position - nothing to record.
        unchanged = [
            node_id
            for node_id in new_by_ancestor.get(old_ancestor, [])
            if new_nodes_index[node_id]["node_hash"] == old_hash
        ]
        if unchanged:
            matched_new_ids.update(unchanged)
            continue

        # Moved: identical content, different position.
        same_content_elsewhere = new_by_hash.get(old_hash, [])
        if same_content_elsewhere:
            matched_new_ids.update(same_content_elsewhere)
            moved.extend(same_content_elsewhere)
            continue

        # Modified: same position, different content.
        same_position_different_content = new_by_ancestor.get(old_ancestor, [])
        if same_position_different_content:
            matched_new_ids.update(same_position_different_content)
            modified.extend(same_position_different_content)
            continue

        # Neither position nor content survived anywhere - gone.
        removed.append(old_id)

    added = [node_id for node_id in new_nodes_index if node_id not in matched_new_ids]

    return DiffResult(moved=moved, modified=modified, removed=removed, added=added)
