"""Diff Engine unit tests (10-Revision-Recovery.md §10.3). Pure function, synthetic
nodes_index pairs - same testing philosophy as test_anchor_engine.py's golden fixtures."""

from app.modules.revision_engine.diff import compute_diff


def _node(node_hash: str, ancestor_path_hash: str) -> dict[str, str]:
    return {"tag": "button", "node_hash": node_hash, "ancestor_path_hash": ancestor_path_hash}


def test_unchanged_node_is_not_recorded_anywhere() -> None:
    old = {"n1": _node("hash-a", "pos-a")}
    new = {"n1": _node("hash-a", "pos-a")}

    diff = compute_diff(old, new)

    assert diff.moved == []
    assert diff.modified == []
    assert diff.removed == []
    assert diff.added == []


def test_moved_node_same_content_different_position() -> None:
    old = {"n1": _node("hash-a", "pos-a")}
    new = {"n2": _node("hash-a", "pos-b")}

    diff = compute_diff(old, new)

    assert diff.moved == ["n2"]
    assert diff.modified == []
    assert diff.removed == []
    assert diff.added == []


def test_modified_node_same_position_different_content() -> None:
    old = {"n1": _node("hash-a", "pos-a")}
    new = {"n2": _node("hash-b", "pos-a")}

    diff = compute_diff(old, new)

    assert diff.modified == ["n2"]
    assert diff.moved == []
    assert diff.removed == []
    assert diff.added == []


def test_removed_node_matches_nothing_in_new_tree() -> None:
    old = {"n1": _node("hash-a", "pos-a")}
    new = {"n2": _node("hash-b", "pos-b")}

    diff = compute_diff(old, new)

    assert diff.removed == ["n1"]
    assert diff.added == ["n2"]
    assert diff.moved == []
    assert diff.modified == []


def test_added_node_has_no_counterpart_in_old_tree() -> None:
    old: dict[str, dict[str, str]] = {}
    new = {"n1": _node("hash-a", "pos-a")}

    diff = compute_diff(old, new)

    assert diff.added == ["n1"]
    assert diff.removed == []


def test_mixed_diff_classifies_each_node_independently() -> None:
    old = {
        "unchanged": _node("hash-u", "pos-u"),
        "moved": _node("hash-m", "pos-m-old"),
        "modified": _node("hash-x-old", "pos-x"),
        "gone": _node("hash-gone", "pos-gone"),
    }
    new = {
        "unchanged": _node("hash-u", "pos-u"),
        "moved-new": _node("hash-m", "pos-m-new"),
        "modified-new": _node("hash-x-new", "pos-x"),
        "brand-new": _node("hash-new", "pos-new"),
    }

    diff = compute_diff(old, new)

    assert diff.moved == ["moved-new"]
    assert diff.modified == ["modified-new"]
    assert diff.removed == ["gone"]
    assert diff.added == ["brand-new"]
