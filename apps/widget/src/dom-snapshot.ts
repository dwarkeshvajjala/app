import { sha256 } from "./hash";
import type { NodeRecord, NodeTreeEntry, NormalizedSnapshot } from "./types";

const STYLE_SUBSET_PROPERTIES = ["display", "font-size", "color", "background-color"] as const;

function getDirectText(el: Element): string {
  let text = "";
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent ?? "";
    }
  }
  return text.replace(/\s+/g, " ").trim();
}

function getStableAttributes(el: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  const id = el.getAttribute("id");
  if (id) attrs.id = id;
  const testId = el.getAttribute("data-testid");
  if (testId) attrs["data-testid"] = testId;
  const className = el.getAttribute("class");
  if (className) attrs.class = className;
  return attrs;
}

function getStyleSubset(el: Element): Record<string, string> {
  const computed = window.getComputedStyle(el);
  const subset: Record<string, string> = {};
  for (const prop of STYLE_SUBSET_PROPERTIES) {
    subset[prop] = computed.getPropertyValue(prop);
  }
  return subset;
}

// 09-Snapshot-Engine.md §9.3: non-visible nodes are excluded from the whole-page walk
// (they're only kept when a comment is directly anchored to one - out of scope here,
// this function captures the page-load-time snapshot, not a single anchored element).
function isVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  return window.getComputedStyle(el).display !== "none";
}

let nodeCounter = 0;
function nextNodeId(): string {
  nodeCounter += 1;
  return `n_${nodeCounter}`;
}

async function buildNode(
  el: Element,
  parentAncestorHash: string,
  nodesIndex: Record<string, NodeRecord>,
): Promise<NodeTreeEntry> {
  const nodeId = nextNodeId();
  const tag = el.tagName.toLowerCase();
  const attributes = getStableAttributes(el);
  const text = getDirectText(el);
  const rect = el.getBoundingClientRect();

  // Per-node / ancestor-path hashing (09-Snapshot-Engine.md §9.6).
  const nodeHash = await sha256(`${tag}|${JSON.stringify(attributes)}|${text.toLowerCase()}`);
  const ancestorPathHash = await sha256(`${parentAncestorHash}|${nodeHash}`);

  const children: NodeTreeEntry[] = [];
  for (const child of Array.from(el.children)) {
    if (!isVisible(child)) continue;
    children.push(await buildNode(child, ancestorPathHash, nodesIndex));
  }

  nodesIndex[nodeId] = {
    tag,
    attributes,
    text,
    bounding_box: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
    computed_style_subset: getStyleSubset(el),
    role: el.getAttribute("role"),
    accessible_name: el.getAttribute("aria-label") ?? (text || null),
    node_hash: nodeHash,
    ancestor_path_hash: ancestorPathHash,
  };

  return { node_id: nodeId, tag, children };
}

export async function captureSnapshot(): Promise<NormalizedSnapshot> {
  nodeCounter = 0;
  const nodesIndex: Record<string, NodeRecord> = {};
  const rootAncestorHash = await sha256("root");
  const nodeTree = await buildNode(document.body, rootAncestorHash, nodesIndex);

  const allHashes = Object.values(nodesIndex)
    .map((n) => n.node_hash)
    .join("|");
  const fullPageHash = await sha256(allHashes);

  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    node_tree: nodeTree,
    nodes_index: nodesIndex,
    full_page_hash: fullPageHash,
  };
}
