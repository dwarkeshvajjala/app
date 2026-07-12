// Mirrors the backend's Pydantic schemas (Rule 3, 02-Engineering-Principles.md) closely
// enough for the SDK's own use - the widget bundle stays dependency-free rather than
// pulling in @backline/types, so these are hand-kept in sync, not generated.

export interface BacklineConfig {
  shareToken: string;
  apiBaseUrl?: string;
}

export interface NodeRecord {
  tag: string;
  attributes: Record<string, string>;
  text: string;
  bounding_box: { x: number; y: number; w: number; h: number };
  computed_style_subset: Record<string, string>;
  role: string | null;
  accessible_name: string | null;
  node_hash: string;
  ancestor_path_hash: string;
  // SimHash of `text`, for approximate matching when a node's text changes slightly
  // between revisions (08-Anchor-Engine.md §8.1, Milestone 5's anchor_engine matcher).
  text_similarity_hash: string;
}

export interface NodeTreeEntry {
  node_id: string;
  tag: string;
  children: NodeTreeEntry[];
}

export interface NormalizedSnapshot {
  viewport: { width: number; height: number };
  node_tree: NodeTreeEntry;
  nodes_index: Record<string, NodeRecord>;
  full_page_hash: string;
}

export interface DomFingerprint {
  selector_path: string;
  tag: string;
  attributes: Record<string, string>;
  // Same hash scheme as NodeRecord above (docs/tdr/0004-anchor-snapshot-shared-hash-scheme.md) -
  // required for the Anchor Engine to compare an anchor against a snapshot's nodes_index at all.
  node_hash: string;
  ancestor_path_hash: string;
}

export interface AnchorPayload {
  tier: 1;
  dom_fingerprint: DomFingerprint;
  text_fingerprint: {
    normalized_text: string;
    text_similarity_hash: string;
  };
}
