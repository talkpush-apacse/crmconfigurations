import { computeDecimalNumbers, type DecimalNumbering } from "../numbering-decimal";
import { numbersFor } from "./layout";
import { computeLaneGrid, LANE } from "./lanes";
import { laneKey, usesLanes } from "./lane-mode";
import { actionTypeOf, fillFor, personActs, shapeKindOf, type ShapeKind } from "./model";
import { handlePoint, pointAlong, routePoints, segmentsOf, type P, type Pos, type Rect } from "./route";
import { boxFor, wrapText, type BoxSpec } from "./text-fit";
import { PM, withLook, type Look } from "./tokens";

/**
 * The "scene": a workflow turned into exact shapes, connectors, labels, containers, title block and legend, with
 * coordinates. The on-screen diagram, the layout linter and the SVG / PNG / PDF exports all read the same scene, so
 * there is one drawing of the diagram, not several.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface SceneMeta {
  clientName: string;
  workflowName: string;
  /** Text after the title, for example "v3". */
  versionLabel?: string;
  /** For example "2026-10-02". */
  date?: string;
  author?: string;
  /** Title above the entry container (default "Candidate entry"). */
  entryTitle?: string;
  /** The process name used in the journey container title (default: the workflow name). */
  processName?: string;
  /** Draw without step numbers (the page's "Hide numbers" switch). */
  hideNumbers?: boolean;
  /** The map's look (WorkflowProject.look). Anything but "readable" draws the original look. */
  look?: Look | string | null;
}

export interface SceneShape {
  id: string;
  kind: ShapeKind;
  node: any;
  box: BoxSpec;
  rect: Rect;
  fill: string;
  stroke: string;
  dashed: boolean;
  textColor: string;
}

export interface SceneEdge {
  id: string;
  source: string;
  target: string;
  points: P[];
  sourceHandle: Pos;
  targetHandle: Pos;
  lineType: string;
  isJoin: boolean;
  label: string;
  labelRect: Rect | null;
  edge: any;
  /** A connector that changes stage is drawn in two pieces, with a marker circle between them: this is the second. */
  extra?: P[][];
  /** The connector goes to or comes from another system (a lane marked as external): drawn dashed and blue. */
  external?: boolean;
}

export interface SceneTable {
  id: string;
  rect: Rect;
  caption: string;
  subtitle: string;
  columns: { id: string; label: string; w: number }[];
  /** Each row's cell text per column, already split into lines that fit the column. */
  rows: { cells: string[][]; h: number; highlight: boolean[] }[];
  headerH: number;
}

export interface SceneContainer {
  id: string;
  title: string;
  rect: Rect;
  /** journey / entry: the classic frames. stage / lane / marker: the lanes layout (a stage band, a row in it, a "continues in" circle). */
  kind?: "journey" | "entry" | "stage" | "lane" | "marker";
  /** A lane that is another system (assessment platform, HRIS, a vendor). */
  external?: boolean;
  /** For a lane: its position among the lanes of its stage, to alternate the shading. */
  index?: number;
}

export interface LegendRow {
  key: string;
  label: string;
  /** `glyph`: a character drawn inside the swatch (the circled number in the numbering line). */
  swatch: { fill: string; stroke: string; dashed?: boolean; shape: "rect" | "diamond" | "circle" | "pill" | "display" | "cylinder" | "dashed-line"; glyph?: string };
}

export interface Scene {
  shapes: SceneShape[];
  edges: SceneEdge[];
  tables: SceneTable[];
  containers: SceneContainer[];
  title: { lines: { text: string; size: number; bold: boolean }[]; rect: Rect };
  legend: { rect: Rect; rows: LegendRow[] };
  bounds: Rect;
  numbering: DecimalNumbering;
  spine: string[];
  /** Lanes layout only: the lane each step sits in (display name). */
  laneOf?: Map<string, string>;
  /** The look this scene was built with. The drawing components and the layout check read it, so they match the build. */
  look: Look;
}

const C = PM.colors;

export function labelRect(text: string, at: P): Rect {
  const w = Math.max(24, Math.ceil(text.length * PM.edge.labelCharW) + PM.edge.labelPad);
  return { x: at.x - w / 2, y: at.y - 11, w, h: 22 };
}

function defaultHandles(a: Rect, b: Rect): [Pos, Pos] {
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const dx = bc.x - ac.x;
  const dy = bc.y - ac.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ["right", "left"] : ["left", "right"];
  return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
}

/** Builds the scene in the map's look (see tokens.ts: withLook). */
export function buildScene(nodes: any[], edges: any[], meta: SceneMeta): Scene {
  const look: Look = meta.look === "readable" ? "readable" : "original";
  return { ...withLook(look, () => buildSceneNow(nodes, edges, meta)), look };
}

function buildSceneNow(nodes: any[], edges: any[], meta: SceneMeta): Omit<Scene, "look"> {
  const numbering = computeDecimalNumbers(nodes, edges);
  const numbers = meta.hideNumbers ? new Map() : numbersFor(nodes, numbering);
  if (meta.hideNumbers) numbering.edgeLabels.clear();

  const lanesMode = usesLanes(nodes);
  const grid = lanesMode ? computeLaneGrid(nodes, edges, numbering) : null;
  const markerRect = (id: string): Rect | null => {
    const m = grid?.markers.find((x) => x.id === id);
    return m ? { x: m.cx - LANE.markerD / 2, y: m.cy - LANE.markerD / 2, w: LANE.markerD, h: LANE.markerD } : null;
  };

  const shapes: SceneShape[] = [];
  const byId = new Map<string, SceneShape>();
  for (const n of nodes) {
    const kind = shapeKindOf(n);
    if (kind === "none" || kind === "container" || kind === "table") continue;
    const box = boxFor(n, numbers.get(n.id));
    const fill = fillFor(n);
    const shape: SceneShape = {
      id: n.id,
      kind,
      node: n,
      box,
      rect: { x: n.position?.x ?? 0, y: n.position?.y ?? 0, w: box.width, h: box.height },
      fill: fill.fill,
      stroke: fill.stroke,
      dashed: fill.dashed,
      textColor: fill.textColor,
    };
    shapes.push(shape);
    byId.set(n.id, shape);
  }

  // ---- connectors ------------------------------------------------------------------------------------------
  const sceneEdges: SceneEdge[] = [];
  for (const e of edges) {
    const a = byId.get(e.source);
    const b = byId.get(e.target);
    if (!a || !b) continue;
    const [dS, dT] = defaultHandles(a.rect, b.rect);
    const sHandle = (e.sourceHandle as Pos) ?? dS;
    const tHandle = (e.targetHandle as Pos) ?? dT;
    let points = routePoints(handlePoint(a.rect, sHandle), sHandle, handlePoint(b.rect, tHandle), tHandle);
    let extra: P[][] | undefined;
    const crossing = grid?.crossings.get(e.id);
    if (crossing) {
      // a connector that changes stage runs into a "continues in" circle, and a matching "from" circle runs on to the target
      const mo = markerRect(crossing.out);
      const mi = markerRect(crossing.in);
      if (mo && mi) {
        points = routePoints(handlePoint(a.rect, "right"), "right", handlePoint(mo, "left"), "left");
        extra = [routePoints(handlePoint(mi, "right"), "right", handlePoint(b.rect, "left"), "left")];
      }
    }
    const external = Boolean(grid && (grid.externalLanes.has(laneKey(grid.laneOf.get(e.source) ?? "")) || grid.externalLanes.has(laneKey(grid.laneOf.get(e.target) ?? ""))));
    const text = String(numbering.edgeLabels.get(e.id) ?? e.data?.label ?? e.label ?? "").trim();
    let rect: Rect | null = null;
    if (text) {
      const segs = segmentsOf(points);
      const last = segs[segs.length - 1];
      const first = segs.find((s) => s.length >= 60) ?? segs[0];
      if (last && !last.horizontal && last.length >= 80) {
        // A path dropping into a step: the label sits on the final vertical run just above the step, so sibling
        // labels line up in one tidy row and never land on the shared bar above them. A path running UP into a shape
        // (a decision to a note above it) puts the label just below the end instead, never inside the shape.
        const goingUp = last.b.y < last.a.y;
        rect = labelRect(text, { x: last.b.x, y: goingUp ? last.b.y + 40 : last.b.y - 40 });
      } else {
        const mid = first ? { x: (first.a.x + first.b.x) / 2, y: (first.a.y + first.b.y) / 2 } : pointAlong(points, 0.5);
        const at = first && first.horizontal ? { x: mid.x, y: mid.y - 14 } : first ? { x: mid.x + labelRect(text, mid).w / 2 + 8, y: mid.y } : mid;
        rect = labelRect(text, at);
      }
    }
    sceneEdges.push({
      id: e.id,
      source: e.source,
      target: e.target,
      points,
      sourceHandle: sHandle,
      targetHandle: tHandle,
      lineType: String(e.data?.lineType ?? "step"),
      isJoin: numbering.joinEdges.has(e.id) || (numbering.enteredVia.has(e.target) && numbering.enteredVia.get(e.target) !== e.id),
      label: text,
      labelRect: rect,
      edge: e,
      ...(extra ? { extra } : {}),
      ...(external ? { external: true } : {}),
    });
  }

  // ---- containers ---------------------------------------------------------------------------------------------
  const entryShapes = shapes.filter((s) => s.kind === "start");
  const journeyShapes = shapes.filter((s) => s.kind !== "start");
  const tables = nodes.filter((n) => shapeKindOf(n) === "table").map((n) => buildTable(n));
  const tableRects: Rect[] = tables.map((t) => t.rect);
  const union = (rs: Rect[]): Rect | null => {
    if (rs.length === 0) return null;
    const x1 = Math.min(...rs.map((r) => r.x));
    const y1 = Math.min(...rs.map((r) => r.y));
    const x2 = Math.max(...rs.map((r) => r.x + r.w));
    const y2 = Math.max(...rs.map((r) => r.y + r.h));
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  };
  const withBadge = (s: SceneShape): Rect => ({ x: s.rect.x, y: s.rect.y - s.box.badgeSpace, w: s.rect.w, h: s.rect.h + s.box.badgeSpace });
  const grow = (r: Rect, p: number): Rect => ({ x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p });

  const containers: SceneContainer[] = [];
  if (grid) {
    // Lanes layout: stage bands, a row per actor inside each, and the "continues in" circles. No journey / entry frames.
    for (const st of grid.stages) {
      if (grid.hasTitles) containers.push({ id: `stage_${st.index}`, kind: "stage", title: st.title, rect: { x: 0, y: st.y, w: grid.width, h: st.h } });
      st.lanes.forEach((ln, i) => containers.push({ id: `lane_${st.index}_${i}`, kind: "lane", title: ln.name, external: ln.external, index: i, rect: { x: 0, y: ln.y, w: grid.width, h: ln.h } }));
    }
    for (const m of grid.markers) containers.push({ id: m.id, kind: "marker", title: m.text, rect: markerRect(m.id)! });
  }
  const journeyRects = [...journeyShapes.map(withBadge), ...tableRects, ...sceneEdges.map((e) => e.labelRect).filter((r): r is Rect => Boolean(r))];
  const journeyBox = union(journeyRects);
  const entryBox = union(entryShapes.map(withBadge));
  let entryContainer: Rect | null = null;
  let journeyContainer: Rect | null = null;
  if (journeyBox && !grid) {
    journeyContainer = grow(journeyBox, PM.layout.containerPad);
    containers.push({ id: "container_journey", kind: "journey", title: `${meta.processName ?? meta.workflowName} Journey`, rect: journeyContainer });
  }
  if (entryBox && !grid) {
    entryContainer = grow(entryBox, PM.layout.containerPad * 0.75);
    // The entry container is as tall as the room it needs; it sits to the left of the journey container.
    containers.push({ id: "container_entry", kind: "entry", title: meta.entryTitle ?? "Candidate entry", rect: entryContainer });
  }

  // ---- title block ------------------------------------------------------------------------------------------------
  const all = containers.map((c) => c.rect);
  const sceneBox = union(all.length ? all : shapes.map(withBadge)) ?? { x: 0, y: 0, w: 400, h: 300 };
  const metaLine = [meta.versionLabel, meta.date, meta.author].filter(Boolean).join(" · ");
  const titleText = `${meta.clientName}: ${meta.workflowName}`;
  const titleW = Math.max(300, Math.ceil(titleText.length * PM.ui.titleCharW));
  const title = {
    lines: [
      { text: titleText, size: PM.type.titleSize, bold: true },
      ...(metaLine ? [{ text: metaLine, size: PM.type.metaSize, bold: false }] : []),
    ],
    rect: { x: sceneBox.x + sceneBox.w / 2 - titleW / 2, y: sceneBox.y - 70, w: titleW, h: 44 },
  };

  // ---- legend ("Diagram key"): only the kinds this diagram uses --------------------------------------------------------
  const rows: LegendRow[] = [];
  const has = (f: (s: SceneShape) => boolean) => shapes.some(f);
  const isReject = (s: SceneShape) => s.kind === "process" && actionTypeOf(s.node) === "rejection_reason";
  if (has((s) => s.kind === "process" && !personActs(s.node) && !isReject(s))) rows.push({ key: "system", label: "System does it, no person needed", swatch: { fill: C.system, stroke: C.stroke, shape: "rect" } });
  if (has((s) => s.kind === "process" && personActs(s.node) && !isReject(s))) rows.push({ key: "person", label: "A person acts (role in brackets)", swatch: { fill: C.person, stroke: C.stroke, shape: "rect" } });
  if (has((s) => s.kind === "decision")) rows.push({ key: "decision", label: "Decision", swatch: { fill: C.decision, stroke: C.stroke, shape: "diamond" } });
  // End states: one line per colour this diagram actually uses, so green / pink / grey never has to be guessed.
  const endKinds = new Set(shapes.filter((s) => s.kind === "end").map((s) => s.node.data?.endKind ?? "neutral"));
  if (endKinds.has("success")) rows.push({ key: "end_success", label: "Ends successfully", swatch: { fill: C.endSuccess, stroke: C.stroke, shape: "pill" } });
  if (endKinds.has("soft")) rows.push({ key: "end_soft", label: "Partly successful", swatch: { fill: C.endSoft, stroke: C.stroke, shape: "pill" } });
  if (endKinds.has("failure")) rows.push({ key: "end_failure", label: "Ends without success", swatch: { fill: C.endFailure, stroke: C.stroke, shape: "pill" } });
  if (endKinds.has("neutral")) rows.push({ key: "end_neutral", label: "Closed or handed off", swatch: { fill: C.endNeutral, stroke: C.stroke, shape: "pill" } });
  const noteKinds = new Set(shapes.filter((s) => s.kind === "note").map((s) => s.node.data?.noteKind ?? "info"));
  if (noteKinds.has("rejection") || has(isReject)) rows.push({ key: "rejection", label: "Rejection reason", swatch: { fill: C.noteRejection, stroke: C.noteRejectionStroke, dashed: true, shape: "rect" } });
  if (noteKinds.has("needs_input")) rows.push({ key: "needs", label: `To confirm with ${meta.clientName}`, swatch: { fill: C.noteOrange, stroke: C.noteOrangeStroke, dashed: true, shape: "rect" } });
  if (noteKinds.has("info")) rows.push({ key: "note", label: "Note", swatch: { fill: C.note, stroke: C.noteStroke, dashed: true, shape: "rect" } });
  if (noteKinds.has("out_of_scope")) rows.push({ key: "scope", label: "Out of scope", swatch: { fill: C.noteOutOfScope, stroke: C.noteOutOfScopeStroke, dashed: true, shape: "rect" } });
  if (has((s) => s.kind === "jump")) rows.push({ key: "jump", label: "Jump to another step", swatch: { fill: C.jump, stroke: C.jumpStroke, shape: "circle" } });
  if (has((s) => s.node.data?.shapeKind === "display")) rows.push({ key: "display", label: "Screen the person sees", swatch: { fill: "#FFFFFF", stroke: C.stroke, shape: "display" } });
  if (grid) {
    if (grid.stages.some((st) => st.lanes.some((l) => l.external))) rows.push({ key: "external_lane", label: "Another system (blue lane)", swatch: { fill: C.laneExternal, stroke: C.laneLabelExternal, shape: "rect" } });
    if (sceneEdges.some((e) => e.external)) rows.push({ key: "external_flow", label: "Dashed line: data crosses systems", swatch: { fill: "none", stroke: C.externalLine, shape: "dashed-line" } });
    if (grid.markers.length > 0) rows.push({ key: "stage_jump", label: "Circle: carries on in the next stage", swatch: { fill: C.jump, stroke: C.jumpStroke, shape: "circle" } });
  }
  // How to read the numbers, with a real example from this diagram: circled = main path, decimal = a branch.
  if (!meta.hideNumbers && numbering.spineNumbers.size > 0) {
    const branch = [...numbering.branchNumbers.values()].find((v) => typeof v === "string" && v.includes("."));
    const parent = branch ? String(branch).split(".").slice(0, -1).join(".") : "";
    const label = branch ? `main path · ${branch} a branch from step ${parent}` : "main path steps are numbered in order";
    rows.push({ key: "numbers", label, swatch: { fill: "#FFFFFF", stroke: C.stroke, shape: "circle", glyph: "①" } });
  }
  const legendH = rows.length ? 56 + rows.length * 32 : 0;
  const legendX = entryContainer ? entryContainer.x : sceneBox.x;
  const legendY = entryContainer ? entryContainer.y + entryContainer.h + 40 : sceneBox.y + sceneBox.h + 40;
  const legend = { rows, rect: { x: legendX, y: legendY, w: grid ? 340 : Math.max(260, entryContainer?.w ?? 260), h: legendH } };

  const parts: Rect[] = [...containers.map((c) => c.rect), title.rect, ...(rows.length ? [legend.rect] : []), ...sceneEdges.map((e) => e.labelRect).filter((r): r is Rect => Boolean(r))];
  const bounds = union(parts) ?? sceneBox;
  return { shapes, edges: sceneEdges, tables, containers, title, legend, bounds: grow(bounds, 40), numbering, spine: numbering.spineOrder, ...(grid ? { laneOf: grid.laneOf } : {}) };
}


/** A data table inside the diagram: caption above, grey header row, black grid, optional orange "still to confirm" cells. */
export function buildTable(node: any): SceneTable {
  const d = node.data ?? {};
  const columns: { id: string; label: string }[] = Array.isArray(d.columns) && d.columns.length ? d.columns : [{ id: "col1", label: "Column A" }];
  const rawRows: Record<string, string>[] = Array.isArray(d.rows) ? d.rows : [];
  const highlight = new Set<string>(Array.isArray(d.highlight) ? d.highlight : []); // "rowIndex:columnId"
  const widths = columns.map((c) => {
    const longest = Math.max(String(c.label ?? "").length, ...rawRows.map((r) => String(r[c.id] ?? "").length));
    return { id: c.id, label: String(c.label ?? ""), w: Math.max(120, Math.min(240, Math.ceil(longest * PM.ui.tableCharW) + 24)) };
  });
  const headerH = PM.ui.tableHeaderH;
  const rows = rawRows.map((r, ri) => {
    const cells = widths.map((c) => wrapText(String(r[c.id] ?? ""), Math.max(8, Math.floor((c.w - 16) / PM.ui.tableCharW))));
    const lines = Math.max(1, ...cells.map((x) => x.length));
    return { cells, h: PM.ui.tableRowPad + lines * PM.ui.tableLineH, highlight: widths.map((c) => highlight.has(`${ri}:${c.id}`)) };
  });
  const w = widths.reduce((n, c) => n + c.w, 0);
  const h = headerH + rows.reduce((n, r) => n + r.h, 0);
  const captionH = (d.label ? 22 : 0) + (d.subtitle ? 18 : 0);
  return {
    id: node.id,
    rect: { x: node.position?.x ?? 0, y: node.position?.y ?? 0, w, h: h + captionH },
    caption: String(d.label ?? ""),
    subtitle: String(d.subtitle ?? ""),
    columns: widths,
    rows,
    headerH,
  };
}
