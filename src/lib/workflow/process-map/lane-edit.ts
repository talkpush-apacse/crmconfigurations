import { computeLaneGrid, fallbackLane } from "./lanes";
import { laneKey, laneNameFor, laneText, usesLanes } from "./lane-mode";
import { shapeKindOf } from "./model";

/**
 * Editing lanes: the pure steps behind the editor's lane controls and the connector's `set_diagram_layout`, so the two
 * behave identically. Each takes the steps and returns new steps; nothing here moves a shape (the layout does that).
 * Lanes live on the steps (data.lane, data.laneKind, data.laneRank), so renaming or reordering a lane edits every step in it.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const LANE_FIELDS = ["lane", "stage", "laneKind", "laneRank"] as const;

export interface LaneSummary {
  name: string;
  external: boolean;
  /** Steps sitting in this lane across all stages. */
  steps: number;
}

/** The lanes of a diagram in the order they are drawn, with how many steps each holds. Empty for a single-row diagram. */
export function laneSummaries(nodes: any[], edges: any[]): LaneSummary[] {
  if (!usesLanes(nodes)) return [];
  const grid = computeLaneGrid(nodes, edges);
  return grid.laneOrder.map((name) => ({
    name,
    external: grid.externalLanes.has(laneKey(name)),
    steps: [...grid.laneOf.values()].filter((l) => laneKey(l) === laneKey(name)).length,
  }));
}

/** Gives every step that has no lane one, from its own role. Steps that already have a lane keep it. */
export function assignLanes(nodes: any[], externalNames: string[] = []): { nodes: any[]; touched: number } {
  const external = new Set(externalNames.map((n) => laneKey(laneNameFor(n))));
  let touched = 0;
  const out = nodes.map((n) => {
    const kind = shapeKindOf(n);
    if (kind !== "process" && kind !== "decision") return n;
    const lane = laneText(n) || fallbackLane(n);
    const ext = external.has(laneKey(lane));
    if (laneText(n) && !ext) return n;
    touched += 1;
    return { ...n, data: { ...n.data, lane, ...(ext ? { laneKind: "external" } : {}) } };
  });
  return { nodes: out, touched };
}

/** Removes lanes and stages from every step, which puts the diagram back to the classic single row. */
export function stripLanes(nodes: any[]): { nodes: any[]; touched: number } {
  let touched = 0;
  const out = nodes.map((n) => {
    const d = n.data ?? {};
    if (LANE_FIELDS.every((f) => d[f] === undefined)) return n;
    touched += 1;
    const rest = { ...d };
    for (const f of LANE_FIELDS) delete rest[f];
    return { ...n, data: rest };
  });
  return { nodes: out, touched };
}

/** Renames a lane on every step in it. Renaming to a name another lane already has merges the two. */
export function renameLane(nodes: any[], from: string, to: string): any[] {
  const next = laneNameFor(to.trim());
  if (!next) return nodes;
  return nodes.map((n) => (laneKey(laneText(n)) === laneKey(from) && laneText(n) ? { ...n, data: { ...n.data, lane: next } } : n));
}

/** Marks a whole lane as another system (assessment platform, HRIS, a vendor), or as an ordinary lane again. */
export function setLaneExternal(nodes: any[], lane: string, external: boolean): any[] {
  return nodes.map((n) => (laneText(n) && laneKey(laneText(n)) === laneKey(lane) ? { ...n, data: { ...n.data, laneKind: external ? "external" : "" } } : n));
}

/** Moves a lane up (-1) or down (+1) among the lanes by giving every lane an explicit rank. */
export function moveLane(nodes: any[], edges: any[], lane: string, delta: -1 | 1): any[] {
  const order = laneSummaries(nodes, edges).map((l) => l.name);
  const at = order.findIndex((l) => laneKey(l) === laneKey(lane));
  const to = at + delta;
  if (at < 0 || to < 0 || to >= order.length) return nodes;
  [order[at], order[to]] = [order[to], order[at]];
  const rank = new Map(order.map((l, i) => [laneKey(l), i]));
  return nodes.map((n) => (laneText(n) && rank.has(laneKey(laneText(n))) ? { ...n, data: { ...n.data, laneRank: rank.get(laneKey(laneText(n))) } } : n));
}

/** Sets one step's lane (an existing lane or a new one) and keeps the lane's outside-system flag consistent. */
export function setStepLane(nodes: any[], id: string, lane: string): any[] {
  const name = laneNameFor(lane.trim());
  const existing = nodes.find((n) => laneText(n) && laneKey(laneText(n)) === laneKey(name));
  return nodes.map((n) =>
    n.id === id
      ? { ...n, data: { ...n.data, lane: name, ...(existing?.data?.laneKind === "external" ? { laneKind: "external" } : n.data?.laneKind === "external" ? { laneKind: "" } : {}), ...(existing?.data?.laneRank !== undefined ? { laneRank: existing.data.laneRank } : {}) } }
      : n
  );
}
