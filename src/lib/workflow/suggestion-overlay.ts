import type { WorkflowOp } from "./ops";

/**
 * How pending suggestions are drawn on top of the real diagram (spec 12.6b):
 *   added   = dashed green outline      deleted = red tint
 *   edited  = amber "edited" outline    moved   = a ghost outline where it would go
 * Pure: it only works out WHAT to draw. The page decides how.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export type NodeMark = "added" | "deleted" | "edited" | "moved";

export interface Overlay {
  /** Marks for steps that already exist on the canvas. */
  nodeMarks: Map<string, NodeMark[]>;
  /** Steps that only exist in a suggestion (drawn as dashed ghosts). */
  addedNodes: any[];
  /** Where a moved step would go (ghost position). */
  movedTo: Map<string, { x: number; y: number }>;
  addedEdges: any[];
  deletedEdgeIds: Set<string>;
  /** For each text-edited step: field -> [old, new] so the detail card can show a before/after. */
  textChanges: Map<string, Record<string, [unknown, unknown]>>;
}

export function computeOverlay(pageId: string, nodes: any[], suggestions: { id: string; ops: unknown }[]): Overlay {
  const nodeMarks = new Map<string, NodeMark[]>();
  const movedTo = new Map<string, { x: number; y: number }>();
  const textChanges = new Map<string, Record<string, [unknown, unknown]>>();
  const addedNodes: any[] = [];
  const addedEdges: any[] = [];
  const deletedEdgeIds = new Set<string>();
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const mark = (id: string, m: NodeMark) => {
    const list = nodeMarks.get(id) ?? [];
    if (!list.includes(m)) list.push(m);
    nodeMarks.set(id, list);
  };

  for (const s of suggestions) {
    const ops = Array.isArray(s.ops) ? (s.ops as WorkflowOp[]) : [];
    for (const op of ops) {
      if (!("pageId" in op) || op.pageId !== pageId) continue;
      switch (op.op) {
        case "addNode":
          addedNodes.push({ ...op.node, id: op.node.id, __suggestionId: s.id });
          break;
        case "addEdge":
          addedEdges.push({ ...op.edge, __suggestionId: s.id });
          break;
        case "deleteNode":
          if (byId.has(op.nodeId)) mark(op.nodeId, "deleted");
          break;
        case "deleteEdge":
          deletedEdgeIds.add(op.edgeId);
          break;
        case "moveNode":
          if (byId.has(op.nodeId)) {
            mark(op.nodeId, "moved");
            movedTo.set(op.nodeId, op.position);
          }
          break;
        case "updateNode": {
          const node = byId.get(op.nodeId);
          if (!node) break;
          const { position, style, ...fields } = op.patch ?? {};
          void style;
          if (position) {
            mark(op.nodeId, "moved");
            movedTo.set(op.nodeId, position);
          }
          const changed: Record<string, [unknown, unknown]> = textChanges.get(op.nodeId) ?? {};
          for (const [k, v] of Object.entries(fields)) {
            if (node.data?.[k] !== v) changed[k] = [changed[k]?.[0] ?? node.data?.[k], v];
          }
          if (Object.keys(changed).length) {
            textChanges.set(op.nodeId, changed);
            mark(op.nodeId, "edited");
          }
          break;
        }
        default:
          break;
      }
    }
  }
  return { nodeMarks, addedNodes, movedTo, addedEdges, deletedEdgeIds, textChanges };
}

/** Short human text for a list of ops, for the suggestions panel ("2 steps added, 1 edited"). */
export function describeOps(ops: unknown): string {
  const list = Array.isArray(ops) ? (ops as WorkflowOp[]) : [];
  const count = (kinds: string[]) => list.filter((o) => kinds.includes(o.op)).length;
  const parts: string[] = [];
  const add = (n: number, one: string, many: string) => n && parts.push(`${n} ${n === 1 ? one : many}`);
  add(count(["addNode"]), "step added", "steps added");
  add(count(["updateNode"]), "step edited", "steps edited");
  add(count(["moveNode"]), "step moved", "steps moved");
  add(count(["deleteNode"]), "step removed", "steps removed");
  add(count(["addEdge"]), "connector added", "connectors added");
  add(count(["updateEdge"]), "connector edited", "connectors edited");
  add(count(["deleteEdge"]), "connector removed", "connectors removed");
  add(count(["addPage", "renamePage", "deletePage"]), "page change", "page changes");
  return parts.join(", ") || "No changes";
}
