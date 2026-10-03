import Dagre from "@dagrejs/dagre";
import type { PathSemantic } from "./types";

// Minimum separations — Dagre will never use less than these even if measured
// nodes are tiny. Exposed so callers can reuse the same floors when computing
// dynamic spacing from measured dimensions.
export const LAYOUT_MIN_NODESEP = 80;
export const LAYOUT_MIN_RANKSEP = 120;

// Extra horizontal breathing room when edges carry labels (e.g. "Yes"/"No"
// branches off a decision), so the label doesn't collide with the next node.
export const EDGE_LABEL_BUFFER = 40;

// Must match Dagre config below (fallbacks when no measured map is provided)
const RANK_SEP = LAYOUT_MIN_RANKSEP;
const NODE_SEP = LAYOUT_MIN_NODESEP;

type LayoutNode = { id: string; position: { x: number; y: number }; [key: string]: unknown };
type LayoutEdge = { source: string; target: string; [key: string]: unknown };

export type NodeDimensionMap = Map<string, { width: number; height: number }>;

function fallbackWidth(node: LayoutNode): number {
  const t = (node as { type?: string }).type;
  if (t === "decision") return 120;
  if (t === "table") return 280;
  return 240;
}

function fallbackHeight(node: LayoutNode): number {
  const t = (node as { type?: string }).type;
  if (t === "decision") return 120;
  if (t === "table") return 180;
  return 80;
}

function nodeWidth(node: LayoutNode, dims?: NodeDimensionMap): number {
  const measured = dims?.get(node.id);
  if (measured && measured.width > 0) return measured.width;
  return fallbackWidth(node);
}

function nodeHeight(node: LayoutNode, dims?: NodeDimensionMap): number {
  const measured = dims?.get(node.id);
  if (measured && measured.height > 0) return measured.height;
  return fallbackHeight(node);
}

const SEMANTIC_RANK: Record<string, number> = {
  failure: 0,
  neutral: 1,
  happy: 2,
  recovery: 3,
};

function shiftSubtree(
  nodeId: string,
  dx: number,
  dy: number,
  outgoing: Map<string, LayoutEdge[]>,
  nodesById: Map<string, LayoutNode>,
  visited: Set<string>
) {
  if (visited.has(nodeId)) return;
  visited.add(nodeId);
  const node = nodesById.get(nodeId);
  if (!node) return;
  node.position = { x: node.position.x + dx, y: node.position.y + dy };
  for (const edge of outgoing.get(nodeId) ?? []) {
    shiftSubtree(edge.target, dx, dy, outgoing, nodesById, visited);
  }
}

function normalizeDecisionBranches(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  dims: NodeDimensionMap | undefined,
  rankSep: number,
  nodeSep: number
) {
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  // Build outgoing-edge map
  const outgoing = new Map<string, LayoutEdge[]>();
  for (const edge of edges) {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    outgoing.get(edge.source)!.push(edge);
  }

  for (const decision of nodes) {
    const t = (decision as { type?: string }).type;
    if (t !== "decision") continue;

    const childEdges = outgoing.get(decision.id) ?? [];
    if (childEdges.length < 2) continue;

    // Pair each edge with its target node
    const children = childEdges
      .map((e) => ({ edge: e, node: nodesById.get(e.target) }))
      .filter((c): c is { edge: LayoutEdge; node: LayoutNode } => c.node !== undefined);

    if (children.length < 2) continue;

    // Sort by pathSemantic rank, then by current x as tie-break
    children.sort((a, b) => {
      const sem = (e: LayoutEdge): string =>
        ((e as { data?: { pathSemantic?: PathSemantic } }).data?.pathSemantic) ?? "neutral";
      const rankA = SEMANTIC_RANK[sem(a.edge)] ?? 1;
      const rankB = SEMANTIC_RANK[sem(b.edge)] ?? 1;
      return rankA - rankB || a.node.position.x - b.node.position.x;
    });

    const dW = nodeWidth(decision, dims);
    const dH = nodeHeight(decision, dims);
    const decisionCenterX = decision.position.x + dW / 2;
    const targetY = decision.position.y + dH + rankSep;

    // Total width of all children with gaps between them
    const totalWidth =
      children.reduce((sum, { node }) => sum + nodeWidth(node, dims), 0) +
      (children.length - 1) * nodeSep;

    let cursor = decisionCenterX - totalWidth / 2;
    const visited = new Set<string>();

    for (const { node } of children) {
      const targetX = cursor;
      const dx = targetX - node.position.x;
      const dy = targetY - node.position.y;
      cursor += nodeWidth(node, dims) + nodeSep;
      shiftSubtree(node.id, dx, dy, outgoing, nodesById, visited);
    }
  }
}

export type LayoutOptions = {
  direction?: "TB" | "LR";
  nodeDimensions?: NodeDimensionMap;
};

export function getLayoutedElements(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  directionOrOptions: "TB" | "LR" | LayoutOptions = "TB"
) {
  const options: LayoutOptions =
    typeof directionOrOptions === "string"
      ? { direction: directionOrOptions }
      : directionOrOptions ?? {};
  const direction = options.direction ?? "TB";
  const dims = options.nodeDimensions;

  // Dynamic spacing: scale by the largest measured node in the graph. Falls
  // back to per-type defaults when a node hasn't been measured yet.
  let maxWidth = 0;
  let maxHeight = 0;
  for (const node of nodes) {
    const w = nodeWidth(node, dims);
    const h = nodeHeight(node, dims);
    if (w > maxWidth) maxWidth = w;
    if (h > maxHeight) maxHeight = h;
  }

  const hasEdgeLabels = edges.some((edge) => {
    const data = (edge as { data?: { label?: string } }).data;
    const label = data?.label;
    return typeof label === "string" && label.trim().length > 0;
  });

  // Dagre's nodesep is the *gap* between siblings, so using maxWidth + 60 as
  // the gap guarantees even the widest pair doesn't overlap horizontally.
  let nodeSep = Math.max(LAYOUT_MIN_NODESEP, maxWidth + 60);
  if (hasEdgeLabels) nodeSep += EDGE_LABEL_BUFFER;

  const rankSep = Math.max(LAYOUT_MIN_RANKSEP, maxHeight + 80);

  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: nodeSep, ranksep: rankSep });

  nodes.forEach((node) => {
    const width = nodeWidth(node, dims);
    const height = nodeHeight(node, dims);
    g.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  Dagre.layout(g);

  const layoutedNodes: LayoutNode[] = nodes.map((node) => {
    const pos = g.node(node.id);
    const width = nodeWidth(node, dims);
    const height = nodeHeight(node, dims);
    return { ...node, position: { x: pos.x - width / 2, y: pos.y - height / 2 } };
  });

  // Post-pass: normalise decision branch positions
  normalizeDecisionBranches(layoutedNodes, edges, dims, rankSep, nodeSep);

  return {
    nodes: layoutedNodes,
    edges,
  };
}
