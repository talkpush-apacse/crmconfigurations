import { computeDecimalNumbers, type DecimalNumbering } from "../numbering-decimal";
import { boxFor } from "./text-fit";
import { actionTypeOf, personActs, shapeKindOf } from "./model";
import { AUTOMATED_LANE, laneKey, laneNameFor, laneText, stageText } from "./lane-mode";
import { numbersFor, type EdgeRoute, type Handle, type LayoutResult, type Size } from "./layout";

/**
 * The lanes layout. A diagram that carries lanes is drawn as stage bands, each holding one row per actor, with every
 * step in the row of whoever does it. Everything here is derived from the steps' own data, never from where they
 * happen to be dragged, so it is deterministic and never depends on a fixed list of actors.
 *
 *   stages  stacked bands, in the order they first appear along the flow; a map with no stages is one untitled band
 *   lanes   rows inside a band, only the lanes someone acts in, in one stable order across the whole map
 *   cells   a step's column (left to right along the flow) and sub-row (a branch that stays in the same lane drops
 *           below the step it leaves)
 *   markers a purple "continues in ..." circle at the end of a stage and a matching "from ..." circle at the start of
 *           the next, so a long process stays narrow instead of running off the page
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export const LANE = {
  colPitch: 350,
  subH: 210,
  /** Distance from the top of a sub-row to the centre of the shapes in it (leaves room for the badge above). */
  centerY: 112,
  labelW: 56,
  sidePad: 30,
  stageHead: 38,
  stageGap: 64,
  markerD: 100,
} as const;

export interface LaneBand {
  name: string;
  external: boolean;
  y: number;
  h: number;
}

export interface StageBand {
  index: number;
  title: string;
  y: number;
  h: number;
  lanes: LaneBand[];
}

export interface LaneCell {
  stage: number;
  lane: string;
  col: number;
  sub: number;
}

export interface StageMarker {
  id: string;
  kind: "out" | "in";
  edgeIds: string[];
  stage: number;
  lane: string;
  cell: LaneCell;
  text: string;
  /** Centre of the circle. */
  cx: number;
  cy: number;
}

export interface LaneGrid {
  laneOrder: string[];
  externalLanes: Set<string>;
  hasTitles: boolean;
  stages: StageBand[];
  width: number;
  height: number;
  cell: Map<string, LaneCell>;
  /** Centre of every placed step, note and marker. */
  center: Map<string, { x: number; y: number }>;
  markers: StageMarker[];
  /** Connector id -> the marker ids it runs through (set only for connectors that cross from one stage to another). */
  crossings: Map<string, { out: string; in: string }>;
  /** The lane (display name) each placed step sits in. */
  laneOf: Map<string, string>;
}

const FLOW_KINDS = new Set(["process", "decision", "end", "jump", "start"]);

const cx = (col: number) => LANE.labelW + LANE.sidePad + LANE.colPitch / 2 + col * LANE.colPitch;

export function fallbackLane(n: any): string {
  const d = n?.data ?? {};
  if (d.actor === "candidate" || actionTypeOf(n) === "candidate") return "Candidate";
  if (personActs(n)) return String(d.actorLabel || d.data?.ownerRole || "").trim() || "Team";
  return laneNameFor(d.actorLabel) || AUTOMATED_LANE;
}

export function computeLaneGrid(nodes: any[], edges: any[], numberingIn?: DecimalNumbering): LaneGrid {
  const numbering = numberingIn ?? computeDecimalNumbers(nodes, edges);
  const flow = nodes.filter((n) => FLOW_KINDS.has(shapeKindOf(n)));
  const notes = nodes.filter((n) => shapeKindOf(n) === "note");
  const byId = new Map(flow.map((n) => [n.id, n]));
  const fe = edges.filter((e) => byId.has(e.source) && byId.has(e.target));
  const edgeOrder = new Map(edges.map((e, i) => [e.id, i]));
  const spineIdx = new Map(numbering.spineOrder.map((id, i) => [id, i]));
  const isRecovery = (e: any) => e.data?.isRecovery === true || e.data?.pathSemantic === "recovery";
  const isMain = (e: any) =>
    e.data?.isPrimary === true ||
    e.data?.isHappyPath === true ||
    e.data?.pathSemantic === "happy" ||
    (spineIdx.has(e.source) && spineIdx.has(e.target) && spineIdx.get(e.target) === (spineIdx.get(e.source) ?? -9) + 1);
  const prefer = (a: any, b: any) => Number(!isMain(a)) - Number(!isMain(b)) || (edgeOrder.get(a.id) ?? 0) - (edgeOrder.get(b.id) ?? 0);

  // ---- flow order: a topological order with the main continuation first; loops are set aside ----------------
  const out = new Map<string, any[]>();
  for (const e of fe) out.set(e.source, [...(out.get(e.source) ?? []), e]);
  for (const list of out.values()) list.sort(prefer);
  const hasIn = new Set(fe.map((e) => e.target));
  const roots = [...flow.filter((n) => shapeKindOf(n) === "start"), ...flow.filter((n) => shapeKindOf(n) !== "start" && !hasIn.has(n.id))];
  const state = new Map<string, number>();
  const post: string[] = [];
  const back = new Set<string>();
  const visit = (id: string) => {
    state.set(id, 1);
    for (const e of [...(out.get(id) ?? [])].reverse()) {
      const s = state.get(e.target);
      if (s === 1) back.add(e.id);
      else if (!s) visit(e.target);
    }
    state.set(id, 2);
    post.push(id);
  };
  for (const r of roots) if (!state.has(r.id)) visit(r.id);
  for (const n of flow) if (!state.has(n.id)) visit(n.id);
  const topo = post.reverse();
  const topoIdx = new Map(topo.map((id, i) => [id, i]));
  const forward = fe.filter((e) => !back.has(e.id) && !isRecovery(e));
  const preds = new Map<string, any[]>();
  for (const e of forward) preds.set(e.target, [...(preds.get(e.target) ?? []), e]);
  for (const list of preds.values()) list.sort((a, b) => (topoIdx.get(a.source) ?? 0) - (topoIdx.get(b.source) ?? 0));
  const nearestPred = (id: string): any | undefined => {
    const list = preds.get(id) ?? [];
    return list.reduce<any>((best, e) => (!best || (topoIdx.get(e.source) ?? 0) > (topoIdx.get(best.source) ?? 0) ? e : best), undefined);
  };

  // ---- stages: explicit names in order of first appearance; a step without one continues the stage before it ----
  const stageNames: string[] = [];
  for (const id of topo) {
    const s = stageText(byId.get(id));
    if (s && !stageNames.includes(s)) stageNames.push(s);
  }
  const hasTitles = stageNames.length > 0;
  const stageOf = new Map<string, number>();
  for (const id of topo) {
    const n = byId.get(id);
    const explicit = stageText(n);
    if (explicit) stageOf.set(id, stageNames.indexOf(explicit));
    else if (shapeKindOf(n) === "start") continue;
    else {
      const p = nearestPred(id);
      stageOf.set(id, p && stageOf.has(p.source) ? stageOf.get(p.source)! : 0);
    }
  }
  for (const id of topo) {
    if (stageOf.has(id)) continue; // an entry channel with no stage of its own joins the stage of the step it leads to
    const first = (out.get(id) ?? [])[0];
    stageOf.set(id, first && stageOf.has(first.target) ? stageOf.get(first.target)! : 0);
  }
  const stageCount = Math.max(1, stageNames.length);
  const stageTitle = (i: number) => (hasTitles ? stageNames[i] ?? "" : "");

  // ---- lanes ---------------------------------------------------------------------------------------------------
  const display = new Map<string, string>();
  const laneOf = new Map<string, string>();
  const setLane = (id: string, name: string) => {
    const k = laneKey(name);
    if (!display.has(k)) display.set(k, name.trim());
    laneOf.set(id, display.get(k)!);
  };
  for (const id of topo) {
    const n = byId.get(id);
    const k = shapeKindOf(n);
    if (k === "end" || k === "jump" || k === "start") continue;
    setLane(id, laneText(n) || fallbackLane(n));
  }
  for (const id of topo) {
    const n = byId.get(id);
    const k = shapeKindOf(n);
    if (k !== "end" && k !== "jump") continue;
    const p = nearestPred(id);
    setLane(id, laneText(n) || (p && laneOf.get(p.source)) || fallbackLane(n));
  }
  for (const id of topo) {
    const n = byId.get(id);
    if (shapeKindOf(n) !== "start") continue;
    const first = (out.get(id) ?? [])[0];
    setLane(id, laneText(n) || (first && laneOf.get(first.target)) || "Candidate");
  }
  const externalLanes = new Set<string>();
  const rank = new Map<string, number>();
  for (const n of flow) {
    const name = laneOf.get(n.id);
    if (!name) continue;
    if (n.data?.laneKind === "external") externalLanes.add(laneKey(name));
    const r = Number(n.data?.laneRank);
    if (Number.isFinite(r)) rank.set(laneKey(name), Math.min(rank.get(laneKey(name)) ?? Infinity, r));
  }
  const firstSeen = new Map<string, number>();
  topo.forEach((id, i) => {
    const name = laneOf.get(id);
    if (name && !firstSeen.has(laneKey(name))) firstSeen.set(laneKey(name), i);
  });
  const laneKeys = [...firstSeen.keys()].sort((a, b) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity) || (firstSeen.get(a) ?? 0) - (firstSeen.get(b) ?? 0));
  const laneOrder = laneKeys.map((k) => display.get(k)!);

  // ---- columns and sub-rows ------------------------------------------------------------------------------------
  const cell = new Map<string, LaneCell>();
  const taken = new Set<string>();
  const place = (stage: number, lane: string, col: number, sub: number): LaneCell => {
    let s = sub;
    while (taken.has(`${stage}|${laneKey(lane)}|${col}|${s}`)) s += 1;
    taken.add(`${stage}|${laneKey(lane)}|${col}|${s}`);
    return { stage, lane, col, sub: s };
  };
  // A stage that something enters from outside (an entry channel, or a connector from another stage) keeps column 0 free.
  const hasEntry = (stage: number) => flow.some((n) => shapeKindOf(n) === "start" && stageOf.get(n.id) === stage);
  const enteredFromOutside = (stage: number) =>
    fe.some((e) => stageOf.get(e.target) === stage && stageOf.get(e.source) !== stage && shapeKindOf(byId.get(e.source)) !== "start") || hasEntry(stage);
  const baseCol = (stage: number) => (enteredFromOutside(stage) ? 1 : 0);
  const isFork = (id: string) => (out.get(id) ?? []).filter((e) => !back.has(e.id) && !isRecovery(e)).length > 1 || byId.get(id)?.type === "decision";

  for (const id of topo) {
    const n = byId.get(id);
    if (shapeKindOf(n) === "start") continue;
    const stage = stageOf.get(id)!;
    const lane = laneOf.get(id)!;
    const same = (preds.get(id) ?? []).filter((e) => stageOf.get(e.source) === stage && cell.has(e.source));
    if (same.length === 0) {
      cell.set(id, place(stage, lane, baseCol(stage), 0));
      continue;
    }
    const main = same.find(isMain) ?? same[0];
    const pc = cell.get(main.source)!;
    let col = Math.max(...same.map((e) => cell.get(e.source)!.col)) + 1;
    let sub = laneKey(pc.lane) === laneKey(lane) ? pc.sub : 0;
    // A branch that stays in the same lane drops below the fork it leaves instead of running on beside it.
    if (same.length === 1 && isFork(main.source) && !isMain(main) && laneKey(pc.lane) === laneKey(lane)) {
      col = pc.col;
      sub = pc.sub + 1;
    }
    cell.set(id, place(stage, lane, col, sub));
  }
  for (const id of topo) {
    const n = byId.get(id);
    if (shapeKindOf(n) !== "start") continue;
    const first = (out.get(id) ?? [])[0];
    const stage = stageOf.get(id)!;
    const tc = first ? cell.get(first.target) : undefined;
    cell.set(id, place(stage, laneOf.get(id)!, tc ? Math.max(0, tc.col - 1) : 0, tc ? tc.sub : 0));
  }

  // ---- stage-change markers ------------------------------------------------------------------------------------
  const markers: StageMarker[] = [];
  const crossings = new Map<string, { out: string; in: string }>();
  const markerByKey = new Map<string, StageMarker>();
  for (const e of fe) {
    const sa = stageOf.get(e.source)!;
    const sb = stageOf.get(e.target)!;
    if (sa === sb || !hasTitles) continue;
    const src = cell.get(e.source)!;
    const tgt = cell.get(e.target)!;
    const outKey = `${e.source}|out|${sb}`;
    const inKey = `${e.target}|in|${sa}`;
    let mo = markerByKey.get(outKey);
    if (!mo) {
      const c = place(sa, src.lane, src.col + 1, src.sub);
      mo = { id: `marker_${e.id}_out`, kind: "out", edgeIds: [], stage: sa, lane: src.lane, cell: c, text: `Continues in|${shorten(stageTitle(sb))}`, cx: 0, cy: 0 };
      markerByKey.set(outKey, mo);
      markers.push(mo);
    }
    let mi = markerByKey.get(inKey);
    if (!mi) {
      const c = place(sb, tgt.lane, Math.max(0, tgt.col - 1), tgt.sub);
      mi = { id: `marker_${e.id}_in`, kind: "in", edgeIds: [], stage: sb, lane: tgt.lane, cell: c, text: `From|${shorten(stageTitle(sa))}`, cx: 0, cy: 0 };
      markerByKey.set(inKey, mi);
      markers.push(mi);
    }
    mo.edgeIds.push(e.id);
    mi.edgeIds.push(e.id);
    crossings.set(e.id, { out: mo.id, in: mi.id });
  }

  // ---- notes sit under the step they belong to, in the same lane -------------------------------------------------
  const noteCell = new Map<string, LaneCell>();
  for (const n of notes) {
    const target = cell.get(String(n.data?.attachTo ?? ""));
    if (target) noteCell.set(n.id, place(target.stage, target.lane, target.col, target.sub + 1));
    else noteCell.set(n.id, place(0, laneOrder[0] ?? "Candidate", 0, 1));
  }

  // ---- geometry ------------------------------------------------------------------------------------------------
  const all: LaneCell[] = [...cell.values(), ...markers.map((m) => m.cell), ...noteCell.values()];
  const colsUsed = Math.max(1, ...all.map((c) => c.col + 1));
  const width = LANE.labelW + LANE.sidePad * 2 + colsUsed * LANE.colPitch;
  const stages: StageBand[] = [];
  let y = 0;
  for (let si = 0; si < stageCount; si += 1) {
    const inStage = all.filter((c) => c.stage === si);
    const lanes: LaneBand[] = [];
    let ly = y + (hasTitles ? LANE.stageHead + 6 : 0);
    for (const name of laneOrder) {
      const here = inStage.filter((c) => laneKey(c.lane) === laneKey(name));
      if (here.length === 0) continue;
      const h = LANE.subH * (Math.max(...here.map((c) => c.sub)) + 1);
      lanes.push({ name, external: externalLanes.has(laneKey(name)), y: ly, h });
      ly += h;
    }
    const h = ly - y + (hasTitles ? 6 : 0);
    stages.push({ index: si, title: stageTitle(si), y, h, lanes });
    y += h + LANE.stageGap;
  }
  const height = Math.max(0, y - LANE.stageGap);
  const centerOf = (c: LaneCell) => {
    const band = stages[c.stage]?.lanes.find((l) => laneKey(l.name) === laneKey(c.lane));
    return { x: cx(c.col), y: (band?.y ?? 0) + c.sub * LANE.subH + LANE.centerY };
  };
  const center = new Map<string, { x: number; y: number }>();
  for (const [id, c] of cell) center.set(id, centerOf(c));
  for (const [id, c] of noteCell) center.set(id, centerOf(c));
  for (const m of markers) {
    const p = centerOf(m.cell);
    m.cx = p.x;
    m.cy = p.y;
    center.set(m.id, p);
  }
  for (const [id, c] of noteCell) cell.set(id, c);
  return { laneOrder, externalLanes, hasTitles, stages, width, height, cell, center, markers, crossings, laneOf };
}

function shorten(s: string): string {
  return s.length > 14 ? `${s.slice(0, 13).trimEnd()}…` : s;
}

/** Where a connector attaches, from the cells at its two ends. */
function routeFor(a: LaneCell, b: LaneCell, laneIndex: (lane: string) => number): { s: Handle; t: Handle } {
  if (a.stage !== b.stage) return { s: "right", t: "left" };
  const sameLane = laneKey(a.lane) === laneKey(b.lane);
  if (b.col > a.col) return { s: "right", t: "left" };
  if (b.col === a.col) {
    const below = sameLane ? b.sub > a.sub : laneIndex(b.lane) > laneIndex(a.lane);
    return below ? { s: "bottom", t: "top" } : { s: "top", t: "bottom" };
  }
  // a connector that runs backwards (a loop): leave and arrive sideways
  return { s: "left", t: "right" };
}

export function layoutLanes(nodes: any[], edges: any[]): LayoutResult {
  const numbering = computeDecimalNumbers(nodes, edges);
  const numbers = numbersFor(nodes, numbering);
  const boxes = new Map<string, ReturnType<typeof boxFor>>();
  const sizes = new Map<string, Size>();
  for (const n of nodes) {
    const box = boxFor(n, numbers.get(n.id));
    boxes.set(n.id, box);
    sizes.set(n.id, { w: box.width, h: box.height });
  }
  const grid = computeLaneGrid(nodes, edges, numbering);
  const positions = new Map<string, { x: number; y: number }>();
  for (const [id, c] of grid.center) {
    const s = sizes.get(id);
    if (s) positions.set(id, { x: c.x - s.w / 2, y: c.y - s.h / 2 });
  }
  // Tables (rare in a lanes diagram) go in a row under the last stage.
  let tx = LANE.labelW + LANE.sidePad;
  for (const n of nodes) {
    if (shapeKindOf(n) !== "table") continue;
    const s = sizes.get(n.id) ?? { w: 360, h: 200 };
    positions.set(n.id, { x: tx, y: grid.height + 90 });
    tx += s.w + 60;
  }
  const laneIndex = (lane: string) => grid.laneOrder.findIndex((l) => laneKey(l) === laneKey(lane));
  const routes = new Map<string, EdgeRoute>();
  for (const e of edges) {
    const a = grid.cell.get(e.source);
    const b = grid.cell.get(e.target);
    if (!a || !b) continue;
    const touchesNote = shapeKindOf(nodes.find((n) => n.id === e.source)) === "note" || shapeKindOf(nodes.find((n) => n.id === e.target)) === "note";
    let r = routeFor(a, b, laneIndex);
    if (touchesNote) {
      const pa = grid.center.get(e.source)!;
      const pb = grid.center.get(e.target)!;
      r = Math.abs(pb.y - pa.y) >= 40 ? (pb.y < pa.y ? { s: "top", t: "bottom" } : { s: "bottom", t: "top" }) : pb.x >= pa.x ? { s: "right", t: "left" } : { s: "left", t: "right" };
    }
    routes.set(e.id, { sourceHandle: r.s, targetHandle: r.t, lineType: "step", isJoin: numbering.joinEdges.has(e.id) });
  }
  return { positions, sizes, edges: routes, numbering, boxes };
}

