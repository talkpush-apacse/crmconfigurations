import { computeDecimalNumbers, type DecimalNumbering } from "../numbering-decimal";
import { boxFor, type BoxSpec, type NodeNumbers } from "./text-fit";
import { shapeKindOf } from "./model";
import { PM } from "./tokens";

/**
 * Layout for the Process Map style ("spine layout"), following the rules from the Lucid skill:
 *   1. The main path runs left to right on ONE straight row.
 *   2. Paths that leave it drop straight down below the step that forks, with elbow connectors only.
 *   3. A fork's paths are centered under the fork (by the middle of their first shapes), so a single path drops dead straight.
 *   4. Paths that leave one step share one exit point and one connector style.
 *   5. The entry channel sits on the same row as the main path.
 * It only decides positions and connector handles; it never changes what the workflow says.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Size {
  w: number;
  h: number;
}
export type Handle = "top" | "right" | "bottom" | "left";

export interface EdgeRoute {
  sourceHandle: Handle;
  targetHandle: Handle;
  lineType: "step";
  /** True when this connector runs into a step that belongs to another path (a rejoin). */
  isJoin: boolean;
}

export interface LayoutResult {
  /** Top-left position of every placed step. */
  positions: Map<string, { x: number; y: number }>;
  sizes: Map<string, Size>;
  edges: Map<string, EdgeRoute>;
  numbering: DecimalNumbering;
  boxes: Map<string, BoxSpec>;
}

const L = PM.layout;
/** Space between two notes stacked on the same step. */
const NOTE_GAP = 24;

/** What to print on each step: its number(s), and for a jump the number of the step it points at. */
export function numbersFor(nodes: any[], numbering: DecimalNumbering): Map<string, NodeNumbers> {
  const map = new Map<string, NodeNumbers>();
  for (const n of nodes) {
    const spine = numbering.spineNumbers.get(n.id);
    const branch = numbering.branchNumbers.get(n.id);
    const jumpTarget = n.data?.jumpToNodeId ? numbering.stepNumbers.get(n.data.jumpToNodeId) : undefined;
    map.set(n.id, { spine, branch, jumpTarget });
  }
  return map;
}

interface Measured {
  /** Offsets relative to the subtree root: dx = center-x offset, dy = top offset. */
  rel: Map<string, { dx: number; dy: number }>;
  minX: number;
  maxX: number;
  bottom: number;
}

export function layoutProcessMap(nodes: any[], edges: any[]): LayoutResult {
  const numbering = computeDecimalNumbers(nodes, edges);
  const numbers = numbersFor(nodes, numbering);
  const boxes = new Map<string, BoxSpec>();
  const sizes = new Map<string, Size>();
  for (const n of nodes) {
    const box = boxFor(n, numbers.get(n.id));
    boxes.set(n.id, box);
    sizes.set(n.id, { w: box.width, h: box.height });
  }
  const size = (id: string): Size => sizes.get(id) ?? { w: PM.size.processW, h: PM.size.processMinH };
  const positions = new Map<string, { x: number; y: number }>();
  const routes = new Map<string, EdgeRoute>();

  // The flow tree: each step hangs below the step it was first reached from.
  const children = new Map<string, string[]>();
  for (const [child, parent] of numbering.parentOf) {
    if (numbering.spineOrder.includes(child)) continue; // main-path steps are placed on the row, not hung below
    children.set(parent, [...(children.get(parent) ?? []), child]);
  }
  // Keep each fork's children in the order they are numbered (reading order).
  for (const [parent, kids] of children) {
    const order = numbering.branchOrder.get(parent);
    if (order && order.length) {
      kids.sort((a, b) => {
        const ea = order.indexOf(numbering.enteredVia.get(a) ?? "");
        const eb = order.indexOf(numbering.enteredVia.get(b) ?? "");
        return (ea < 0 ? 99 : ea) - (eb < 0 ? 99 : eb);
      });
    }
  }

  const memo = new Map<string, Measured>();
  function measure(id: string, firstDrop: boolean): Measured {
    const key = `${id}:${firstDrop}`;
    const hit = memo.get(key);
    if (hit) return hit;
    const { w, h } = size(id);
    const kids = children.get(id) ?? [];
    const rel = new Map<string, { dx: number; dy: number }>();
    rel.set(id, { dx: 0, dy: 0 });
    let minX = -w / 2;
    let maxX = w / 2;
    let bottom = h;
    if (kids.length > 0) {
      const gapY = isFork(id) ? L.dropGap : L.chainGap;
      const subs = kids.map((k) => measure(k, false));
      // lay the paths side by side...
      let cursor = 0;
      const centers: number[] = [];
      const offsets: number[] = [];
      subs.forEach((s) => {
        const left = cursor - s.minX; // shift so this subtree's left edge sits at the cursor
        offsets.push(left);
        centers.push(left); // its root center
        cursor = left + s.maxX + L.branchGap;
      });
      // ...then center them by the middle of their FIRST shapes (not by the cluster's outline).
      const mean = centers.reduce((a, b) => a + b, 0) / centers.length;
      const top = h + gapY;
      subs.forEach((s, i) => {
        const shift = offsets[i] - mean;
        for (const [cid, r] of s.rel) rel.set(cid, { dx: r.dx + shift, dy: r.dy + top });
        minX = Math.min(minX, s.minX + shift);
        maxX = Math.max(maxX, s.maxX + shift);
        bottom = Math.max(bottom, top + s.bottom);
      });
    }
    const out = { rel, minX, maxX, bottom };
    memo.set(key, out);
    return out;
  }
  const isFork = (id: string) => (children.get(id) ?? []).length > 1 || nodes.find((n) => n.id === id)?.type === "decision";

  // ---- the main path on one row -------------------------------------------------------------------------
  const spine = numbering.spineOrder;
  let cursorX = 0;
  const rowCenterY = 0;
  const spineCenters = new Map<string, number>();
  let maxBottom = 0;
  spine.forEach((id, i) => {
    const m = measure(id, true);
    const { w, h } = size(id);
    const left = i === 0 ? 0 : cursorX + L.spineGap;
    const cx = left - m.minX; // the column starts at `left` and holds the step plus everything that hangs below it
    spineCenters.set(id, cx);
    cursorX = cx + m.maxX;
    positions.set(id, { x: cx - w / 2, y: rowCenterY - h / 2 });
    for (const [cid, r] of m.rel) {
      if (cid === id) continue;
      const cw = size(cid).w;
      positions.set(cid, { x: cx + r.dx - cw / 2, y: rowCenterY - h / 2 + r.dy });
    }
    maxBottom = Math.max(maxBottom, rowCenterY - h / 2 + m.bottom);
  });

  // ---- the entry channel sits on the same row, to the left ----------------------------------------------
  const sources = nodes.filter((n) => shapeKindOf(n) === "start");
  const firstX = spine.length ? (positions.get(spine[0])?.x ?? 0) : 0;
  // One entry channel is level with the main row. Several are stacked in one column, centred on that row, so each has its own
  // straight run to the first step and none sits in another's way.
  const entryRight = firstX - L.containerGap * 2 - L.containerPad * 2;
  const entryHeights = sources.map((n) => size(n.id).h);
  const entryStack = entryHeights.reduce((a, h) => a + h, 0) + L.branchGap * Math.max(0, sources.length - 1);
  let entryY = rowCenterY - entryStack / 2;
  sources.forEach((n) => {
    const { w, h } = size(n.id);
    positions.set(n.id, { x: entryRight - w, y: entryY });
    entryY += h + L.branchGap;
  });

  // ---- steps that are not connected to the flow: a tidy row below ---------------------------------------
  const placed = new Set(positions.keys());
  const loose = nodes.filter((n) => !placed.has(n.id) && ["process", "decision", "end", "jump"].includes(shapeKindOf(n)));
  let looseX = firstX;
  for (const n of loose) {
    const { w } = size(n.id);
    positions.set(n.id, { x: looseX, y: maxBottom + L.containerPad });
    looseX += w + L.branchGap;
  }

  // ---- notes and tables ------------------------------------------------------------------------------------
  placeNotesAndTables(nodes, positions, sizes, spine, spineCenters, maxBottom, cursorX);

  // ---- connectors: handles and style ------------------------------------------------------------------------
  const center = (id: string) => {
    const p = positions.get(id);
    const s = size(id);
    return p ? { x: p.x + s.w / 2, y: p.y + s.h / 2 } : { x: 0, y: 0 };
  };
  const onSpine = new Set(spine);
  for (const e of edges) {
    if (!positions.has(e.source) || !positions.has(e.target)) continue;
    const isJoin = numbering.joinEdges.has(e.id) || numbering.enteredVia.get(e.target) !== e.id;
    const s = center(e.source);
    const t = center(e.target);
    let sourceHandle: Handle = "bottom";
    let targetHandle: Handle = "top";
    const bothOnRow = onSpine.has(e.source) && onSpine.has(e.target);
    const fromEntry = shapeKindOf(nodes.find((n) => n.id === e.source)) === "start";
    const touchesNote = shapeKindOf(nodes.find((n) => n.id === e.source)) === "note" || shapeKindOf(nodes.find((n) => n.id === e.target)) === "note";
    if (touchesNote) {
      // A connector to or from a note is not a path of the process: keep it off the sides the real paths use. Go straight up or down to a note above or below, sideways only when it sits level.
      if (Math.abs(t.y - s.y) >= 40) {
        sourceHandle = t.y < s.y ? "top" : "bottom";
        targetHandle = t.y < s.y ? "bottom" : "top";
      } else {
        sourceHandle = t.x >= s.x ? "right" : "left";
        targetHandle = t.x >= s.x ? "left" : "right";
      }
    } else if (fromEntry || (bothOnRow && !isJoin) || (bothOnRow && t.x > s.x)) {
      sourceHandle = t.x >= s.x ? "right" : "left";
      targetHandle = t.x >= s.x ? "left" : "right";
    } else if (isJoin) {
      // A path that rejoins another: leave sideways, enter from below (or from the side when the target is level).
      if (Math.abs(t.y - s.y) < 40) {
        sourceHandle = t.x >= s.x ? "right" : "left";
        targetHandle = t.x >= s.x ? "left" : "right";
      } else if (t.y < s.y) {
        sourceHandle = t.x >= s.x ? "right" : "left";
        targetHandle = "bottom";
      } else {
        sourceHandle = "bottom";
        targetHandle = "top";
      }
    }
    routes.set(e.id, { sourceHandle, targetHandle, lineType: "step", isJoin });
  }

  return { positions, sizes, edges: routes, numbering, boxes };
}

/** Notes sit BESIDE the step they talk about (never in its connector lane); tables go to the lower right. */
function placeNotesAndTables(
  nodes: any[],
  positions: Map<string, { x: number; y: number }>,
  sizes: Map<string, Size>,
  spine: string[],
  spineCenters: Map<string, number>,
  maxBottom: number,
  rightEdge: number
) {
  const onSpine = new Set(spine);
  let stackAbove = 0;
  let tableX = rightEdge;
  // Several notes can belong to one step: stack them (upwards above a main-path step, downwards beside a branch step) so they never sit on top of each other.
  const stackedHeight = new Map<string, number>();
  for (const n of nodes) {
    const kind = shapeKindOf(n);
    if (kind === "note") {
      const attach: string | undefined = n.data?.attachTo;
      const target = attach ? positions.get(attach) : undefined;
      const s = sizes.get(n.id) ?? { w: PM.size.noteW, h: 80 };
      if (attach && target) {
        const ts = sizes.get(attach) ?? { w: PM.size.processW, h: PM.size.processMinH };
        const used = stackedHeight.get(attach) ?? 0;
        stackedHeight.set(attach, used + s.h + NOTE_GAP);
        if (onSpine.has(attach)) {
          // above a main-path step, clear of its badge and connectors
          positions.set(n.id, { x: target.x + ts.w / 2 - s.w / 2, y: target.y - s.h - PM.size.badgeH - 70 - used });
        } else {
          // to the right of a step in a branch
          positions.set(n.id, { x: target.x + ts.w + 50, y: target.y + used });
        }
      } else {
        const topOfRow = Math.min(0, ...spine.map((id) => positions.get(id)?.y ?? 0));
        positions.set(n.id, { x: (spineCenters.get(spine[0]) ?? 0) - s.w / 2 + stackAbove, y: topOfRow - PM.size.badgeH - 70 - s.h });
        stackAbove += s.w + 40;
      }
    }
  }
  for (const n of nodes) {
    if (shapeKindOf(n) === "table") {
      const s = sizes.get(n.id) ?? { w: 360, h: 200 };
      positions.set(n.id, { x: tableX - s.w, y: maxBottom + PM.layout.containerPad });
      tableX -= s.w + 60;
    }
  }
}

/** Applies a layout to workflow nodes and edges, returning NEW arrays (the inputs are untouched). */
/**
 * Where a NEW note goes so it sits beside the step it is attached to straight away, using the same rule as the full
 * layout but measured from where that step actually is now. Nothing else moves. Null when the note has no valid
 * `attachTo`, so the caller keeps its own default.
 */
export function positionForNewNote(nodes: any[], edges: any[], note: any, layout: (nodes: any[], edges: any[]) => LayoutResult = layoutProcessMap): { x: number; y: number } | null {
  const attach: string | undefined = note?.data?.attachTo;
  const actual = attach ? nodes.find((n) => n.id === attach) : undefined;
  if (!attach || !actual?.position) return null;
  try {
    const result = layout([...nodes, note], edges);
    const target = result.positions.get(attach);
    const spot = result.positions.get(note.id);
    if (!target || !spot) return null;
    return { x: actual.position.x + (spot.x - target.x), y: actual.position.y + (spot.y - target.y) };
  } catch {
    return null;
  }
}

export function applyLayout(nodes: any[], edges: any[], result: LayoutResult): { nodes: any[]; edges: any[] } {
  return {
    nodes: nodes.map((n) => {
      const p = result.positions.get(n.id);
      return p ? { ...n, position: { x: Math.round(p.x), y: Math.round(p.y) } } : n;
    }),
    edges: edges.map((e) => {
      const r = result.edges.get(e.id);
      return r ? { ...e, sourceHandle: r.sourceHandle, targetHandle: r.targetHandle, data: { ...(e.data ?? {}), lineType: r.lineType } } : e;
    }),
  };
}
