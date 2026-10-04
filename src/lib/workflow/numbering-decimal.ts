import { normalizeWorkflowEdgeData } from "./normalize";
import { computeStepNumbers } from "./numbering";
import { usesLanes } from "./process-map/lane-mode";

/**
 * Jolo's numbering (Process Map style). The number names the BRANCH, not the position in a chain:
 *
 *   - Steps on the main path are numbered 1, 2, 3... (drawn as circled numerals).
 *   - A decision on the main path that forks gives its extra paths 5.1, 5.2... and EVERY step in such a path carries
 *     that same number (5.1, 5.1, 5.1). A deeper number appears only when a step inside the path is itself a fork:
 *     10.1 splits into 10.1.1 and 10.1.2.
 *   - A terminator ("Hired", "Rejected", "Closed") and the entry channel are never numbered.
 *   - The connector that starts a numbered path carries the number: "5.1 · Declines".
 *
 * Pure and computed when drawing (never stored), so editing the main path renumbers everything after it.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface DecimalNumbering {
  /** "5" for a main-path step, "5.1" for a step in a branch. Terminators, jumps and notes have none. */
  stepNumbers: Map<string, string>;
  /** Main-path steps only: id -> its number as an integer (drawn circled). */
  spineNumbers: Map<string, number>;
  /** Branch steps only: id -> "5.1". */
  branchNumbers: Map<string, string>;
  /** Connector id -> text to show on it ("5.1 · Declines"), for connectors that start a numbered path. */
  edgeLabels: Map<string, string>;
  /** Connectors that run into a step that already belongs to another path (the branch rejoins there). */
  joinEdges: Set<string>;
  /** Same shape the older scheme returns, so callers can use either. */
  recoveryEdges: Map<string, string>;
  warnings: Set<string>;
  overflowNodes: Set<string>;
  mergeNodes: Set<string>;
  /** The main path, in order (terminators and jumps on it included, unnumbered). */
  spineOrder: string[];
  /** Step id -> the connector it was first reached through. Together these form the tree the layout is built from. */
  enteredVia: Map<string, string>;
  /** Step id -> the step that connector leaves from. */
  parentOf: Map<string, string>;
  /** Fork paths in the order they are numbered and laid out, per fork step. */
  branchOrder: Map<string, string[]>;
}

const SKIP = new Set(["source", "annotation", "dangling_endpoint", "swimlane", "frame", "note", "table"]);
const UNNUMBERED = new Set(["terminator", "jump"]);

function isSkipped(n: any): boolean {
  return SKIP.has(n.type) || Boolean(n.data?.isAnnotation);
}

export function computeDecimalNumbers(nodes: any[], edges: any[]): DecimalNumbering {
  const out: DecimalNumbering = {
    stepNumbers: new Map(),
    spineNumbers: new Map(),
    branchNumbers: new Map(),
    edgeLabels: new Map(),
    joinEdges: new Set(),
    recoveryEdges: new Map(),
    warnings: new Set(),
    overflowNodes: new Set(),
    mergeNodes: new Set(),
    spineOrder: [],
    enteredVia: new Map(),
    parentOf: new Map(),
    branchOrder: new Map(),
  };

  const real = nodes.filter((n) => !isSkipped(n));
  if (real.length === 0) return out;
  const byId = new Map(real.map((n) => [n.id, n]));
  const flowEdges = edges.filter((e) => byId.has(e.source) && byId.has(e.target));
  const outgoing = new Map<string, any[]>();
  const incomingCount = new Map<string, number>();
  for (const e of flowEdges) {
    outgoing.set(e.source, [...(outgoing.get(e.source) ?? []), e]);
    incomingCount.set(e.target, (incomingCount.get(e.target) ?? 0) + 1);
  }
  const data = (e: any) => normalizeWorkflowEdgeData(e.data);
  const isRecovery = (e: any) => data(e).isRecovery;

  const claimed = new Set<string>();
  const label = (e: any): string => {
    const d = e.data ?? {};
    return String(d.label ?? e.label ?? "").trim();
  };
  const pos = (id: string) => byId.get(id)?.position ?? { x: 0, y: 0 };
  const order = new Map(flowEdges.map((e, i) => [e.id, i]));
  /** Left-to-right, top-to-bottom reading order of a fork's paths; ties keep the order they were drawn in. */
  // In a lanes diagram a step's place on the page comes FROM the numbering (lane rows, stage bands), so the order of a
  // fork's paths follows the order the connectors were drawn instead. That keeps numbers from shifting when lanes change.
  const lanes = usesLanes(nodes);
  const byReading = (a: any, b: any) => {
    if (lanes) return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
    const pa = pos(a.target);
    const pb = pos(b.target);
    return pa.y - pb.y || pa.x - pb.x || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  };

  const hasPrimary = (e: any) => data(e).isPrimary === true;
  const isHappy = (e: any) => data(e).pathSemantic === "happy" || data(e).isHappyPath;

  /** The one path that continues the main line from a step, if it is clear which one. */
  function pickContinuation(list: any[]): any | null {
    const forward = list.filter((e) => !isRecovery(e));
    if (forward.length === 0) return null;
    if (forward.length === 1) return forward[0];
    return forward.find(hasPrimary) ?? forward.find(isHappy) ?? null;
  }

  // ---- 1. the main path ------------------------------------------------------------------------------
  const entry = real.find((n) => !incomingCount.has(n.id)) ?? real[0];
  const spine: string[] = [];
  let cursor: any = entry;
  let counter = 0;
  while (cursor && !claimed.has(cursor.id)) {
    claimed.add(cursor.id);
    spine.push(cursor.id);
    if (!UNNUMBERED.has(cursor.type)) {
      counter += 1;
      out.spineNumbers.set(cursor.id, counter);
      out.stepNumbers.set(cursor.id, String(counter));
    }
    const list = outgoing.get(cursor.id) ?? [];
    const forward = list.filter((e) => !isRecovery(e));
    const next = pickContinuation(list);
    if (forward.length > 1 && !next && (cursor.type === "decision" || cursor.type === "parallel")) out.warnings.add(cursor.id);
    cursor = next ? byId.get(next.target) : null;
    if (cursor && claimed.has(cursor.id)) {
      // the main path loops back on itself: mark the connector, do not number twice
      out.joinEdges.add(next.id);
      cursor = null;
    } else if (cursor && next) {
      out.enteredVia.set(cursor.id, next.id);
      out.parentOf.set(cursor.id, next.source);
    }
  }
  out.spineOrder = spine;

  // ---- 2. branches: every path that leaves a step without being the main line ------------------------
  function walkBranch(start: any, number: string, depth: number, via: any): void {
    let node: any = start;
    let viaEdge: any = via;
    while (node) {
      if (claimed.has(node.id)) return;
      claimed.add(node.id);
      out.enteredVia.set(node.id, viaEdge.id);
      out.parentOf.set(node.id, viaEdge.source);
      if (!UNNUMBERED.has(node.type)) {
        out.stepNumbers.set(node.id, number);
        out.branchNumbers.set(node.id, number);
        if (depth > 3) out.overflowNodes.add(node.id);
      }
      const list = (outgoing.get(node.id) ?? []).filter((e) => !isRecovery(e));
      for (const e of outgoing.get(node.id) ?? []) if (isRecovery(e)) out.joinEdges.add(e.id);
      if (list.length === 0) return;
      if (list.length === 1) {
        const target = byId.get(list[0].target)!;
        if (claimed.has(target.id)) {
          out.joinEdges.add(list[0].id);
          out.mergeNodes.add(target.id);
          return;
        }
        viaEdge = list[0];
        node = target;
        continue;
      }
      // A fork inside a branch. If one connector is marked as the main line it continues with the same number,
      // otherwise EVERY outgoing path is a numbered sub-branch (11.1 splits into 11.1.1 and 11.1.2).
      const main = list.find(hasPrimary) ?? null;
      const subs = list.filter((e) => e !== main).sort(byReading);
      out.branchOrder.set(node.id, [...subs, ...(main ? [main] : [])].map((e) => e.id));
      subs.forEach((e, i) => startBranch(e, `${number}.${i + 1}`, depth + 1));
      if (main) {
        const target = byId.get(main.target)!;
        if (claimed.has(target.id)) {
          out.joinEdges.add(main.id);
          out.mergeNodes.add(target.id);
          return;
        }
        viaEdge = main;
        node = target;
        continue;
      }
      return;
    }
  }

  function startBranch(e: any, number: string, depth: number): void {
    const target = byId.get(e.target);
    if (!target) return;
    const text = label(e);
    out.edgeLabels.set(e.id, text ? `${number} · ${text}` : number);
    if (claimed.has(target.id)) {
      // a path that runs straight into a step that already belongs elsewhere
      out.joinEdges.add(e.id);
      out.mergeNodes.add(target.id);
      return;
    }
    walkBranch(target, number, depth, e);
  }

  // Branches off the main path, taken in main-path order so numbering follows the page.
  for (const id of spine) {
    const base = out.spineNumbers.get(id);
    const node = byId.get(id)!;
    const list = (outgoing.get(id) ?? []).filter((e) => !isRecovery(e));
    for (const e of outgoing.get(id) ?? []) if (isRecovery(e)) out.joinEdges.add(e.id);
    const continuation = pickContinuation(outgoing.get(id) ?? []);
    const extras = list.filter((e) => e !== continuation).sort(byReading);
    if (extras.length) out.branchOrder.set(id, [...extras.map((e) => e.id), ...(continuation ? [continuation.id] : [])]);
    // Spine edges that were used to continue the main line stay plain; label them as they are.
    extras.forEach((e, i) => {
      const parent = base !== undefined ? String(base) : (out.stepNumbers.get(id) ?? "0");
      // A terminator or jump on the main path has no number to build on; its paths are rare, so number off the nearest numbered step.
      startBranch(e, `${parent}.${i + 1}`, 1);
    });
    void node;
  }

  // ---- 3. anything still unreached is unconnected -------------------------------------------------------
  let u = 0;
  for (const n of real) {
    if (!claimed.has(n.id) && !UNNUMBERED.has(n.type)) {
      u += 1;
      out.stepNumbers.set(n.id, `U${u}`);
    }
  }
  return out;
}

export type NumberingScheme = "letters" | "decimal";

/** Numbering in whichever scheme the workflow uses, with the shape older callers expect. */
export function computeNumbers(nodes: any[], edges: any[], scheme: NumberingScheme = "letters") {
  if (scheme === "decimal") return computeDecimalNumbers(nodes, edges);
  const legacy = computeStepNumbers(nodes, edges);
  return {
    ...legacy,
    spineNumbers: new Map<string, number>(),
    branchNumbers: new Map<string, string>(),
    edgeLabels: new Map<string, string>(),
    joinEdges: new Set<string>(),
  };
}
