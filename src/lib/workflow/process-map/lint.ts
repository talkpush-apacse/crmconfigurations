import { rectsOverlap, segmentHitsRect, segmentsOf, type Rect } from "./route";
import type { Scene, SceneShape } from "./scene";
import { PM, withLook } from "./tokens";

/**
 * "Layout check": the automated version of the Lucid skill's self-audit. Lucid's own validator never looked at
 * connectors, so a clean report could still hide a tangle. This one does, on the exact geometry that is drawn.
 * It only reports. It never moves anything.
 */

export type LayoutSeverity = "high" | "medium" | "low";

export interface LayoutFinding {
  code: LayoutCode;
  severity: LayoutSeverity;
  message: string;
  recommendation: string;
  nodeId?: string;
  edgeId?: string;
}

export type LayoutCode =
  | "shapes_overlap"
  | "connector_crosses_shape"
  | "note_in_connector_lane"
  | "label_overlap"
  | "label_on_short_run"
  | "badge_overlap"
  | "text_overflow"
  | "diagonal_connector"
  | "fork_mixed_connectors"
  | "far_merge"
  | "entry_row_mismatch"
  | "step_outside_lane"
  | "too_many_lanes"
  | "shapes_too_close";

const BADGE_W = 40;
const MIN_CLEARANCE = 40;
const FAR_MERGE = 1400;

const name = (s: SceneShape) => String(s.node.data?.label || s.id) || s.id;

function gap(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  return Math.max(dx, dy);
}

/** Checks the scene in the look it was built with. */
export function lintLayout(scene: Scene): LayoutFinding[] {
  return withLook(scene.look, () => lintNow(scene));
}

function lintNow(scene: Scene): LayoutFinding[] {
  const out: LayoutFinding[] = [];
  const byId = new Map(scene.shapes.map((s) => [s.id, s]));
  const lanes = scene.containers.some((c) => c.kind === "lane");
  const pathsOf = (e: Scene["edges"][number]) => [e.points, ...(e.extra ?? [])];

  // 0: shapes sitting on top of each other (notes may overlap containers but never other shapes)
  for (let i = 0; i < scene.shapes.length; i++) {
    for (let j = i + 1; j < scene.shapes.length; j++) {
      const a = scene.shapes[i];
      const b = scene.shapes[j];
      if (rectsOverlap(a.rect, b.rect)) {
        out.push({ code: "shapes_overlap", severity: "high", nodeId: a.id, message: `"${name(a)}" and "${name(b)}" overlap.`, recommendation: "Move one of them, or re-run the layout." });
      }
    }
  }

  // 1 + 2: connectors crossing shapes that are not their own ends
  for (const e of scene.edges) {
    const segs = pathsOf(e).flatMap((p) => segmentsOf(p));
    for (const s of scene.shapes) {
      if (s.id === e.source || s.id === e.target) continue;
      if (!segs.some((seg) => segmentHitsRect(seg, s.rect))) continue;
      if (s.kind === "note") {
        out.push({ code: "note_in_connector_lane", severity: "high", edgeId: e.id, nodeId: s.id, message: `A note ("${name(s)}") sits on a connector.`, recommendation: "Move the note beside the step it talks about, never in the line's path." });
      } else {
        out.push({ code: "connector_crosses_shape", severity: "high", edgeId: e.id, nodeId: s.id, message: `A connector passes through "${name(s)}".`, recommendation: "Re-run the layout, or move that step out of the connector's path." });
      }
    }
  }

  // 3: labels on top of each other or on shapes
  const labelled = scene.edges.filter((e) => e.labelRect);
  for (let i = 0; i < labelled.length; i++) {
    for (let j = i + 1; j < labelled.length; j++) {
      if (rectsOverlap(labelled[i].labelRect!, labelled[j].labelRect!)) {
        out.push({ code: "label_overlap", severity: "medium", edgeId: labelled[i].id, message: `Connector labels "${labelled[i].label}" and "${labelled[j].label}" overlap.`, recommendation: "Move one of the steps apart, or shorten the label text." });
      }
    }
    for (const s of scene.shapes) {
      if (rectsOverlap(labelled[i].labelRect!, s.rect)) {
        out.push({ code: "label_overlap", severity: "medium", edgeId: labelled[i].id, nodeId: s.id, message: `The label "${labelled[i].label}" covers "${name(s)}".`, recommendation: "Move the steps apart so the label has room." });
      }
    }
  }

  // 4: a label on a straight run that is too short to hold it
  for (const e of labelled) {
    const need = e.labelRect!.w + 40;
    const first = segmentsOf(e.points).find((s) => s.length >= 60) ?? segmentsOf(e.points)[0];
    if (first && first.horizontal && first.length < need) {
      out.push({ code: "label_on_short_run", severity: "low", edgeId: e.id, message: `There is little room on the line for the label "${e.label}".`, recommendation: "Add space between the two steps or shorten the label." });
    }
  }

  // 5: icon badge colliding with another shape or a connector
  for (const s of scene.shapes) {
    if (!s.box.badge) continue;
    const badge: Rect = { x: s.rect.x, y: s.rect.y - PM.size.badgeH - 6, w: BADGE_W, h: PM.size.badgeH };
    const hitShape = scene.shapes.find((o) => o.id !== s.id && rectsOverlap(badge, o.rect));
    if (hitShape) out.push({ code: "badge_overlap", severity: "medium", nodeId: s.id, message: `The icon above "${name(s)}" overlaps "${name(hitShape)}".`, recommendation: "Leave at least 100px between stacked steps." });
    const hitLine = scene.edges.find((e) => segmentsOf(e.points).some((seg) => segmentHitsRect(seg, badge, 0)));
    if (hitLine) out.push({ code: "badge_overlap", severity: "medium", nodeId: s.id, edgeId: hitLine.id, message: `A connector runs through the icon above "${name(s)}".`, recommendation: "Leave at least 100px between stacked steps." });
  }

  // 6: text that no longer fits its box
  for (const s of scene.shapes) {
    if (s.kind === "process" || s.kind === "note") {
      const needed = 32 + s.box.lines.length * PM.type.lineH;
      if (s.rect.h + 1 < needed || s.rect.w + 1 < s.box.width) {
        out.push({ code: "text_overflow", severity: "medium", nodeId: s.id, message: `The text in "${name(s)}" does not fit its box.`, recommendation: "Shorten the text or re-run the layout to restore the standard box size." });
      }
    }
  }

  // 7: diagonal connectors
  for (const e of scene.edges) {
    const lt = e.lineType;
    if (lt === "straight" || lt === "bezier") {
      out.push({ code: "diagonal_connector", severity: "medium", edgeId: e.id, message: "A connector is set to a straight or curved line, so it can run diagonally.", recommendation: "Use elbow connectors in this style." });
    }
  }

  // 8: paths leaving one step must share one exit and one style
  // (A lanes diagram has no single exit for a fork: a path in the same lane leaves downward, one into another lane rightward.)
  const forks = new Map<string, typeof scene.edges>();
  for (const e of scene.edges) {
    if (!lanes && scene.numbering.edgeLabels.has(e.id) && !e.isJoin) forks.set(e.source, [...(forks.get(e.source) ?? []), e]);
  }
  for (const [source, list] of forks) {
    if (list.length < 2) continue;
    const handles = new Set(list.map((e) => e.sourceHandle));
    const types = new Set(list.map((e) => e.lineType));
    if (handles.size > 1 || types.size > 1) {
      out.push({ code: "fork_mixed_connectors", severity: "medium", nodeId: source, edgeId: list[0].id, message: `The paths leaving "${name(byId.get(source)!)}" do not share one exit point and one line style.`, recommendation: "Re-run the layout so sibling paths leave from the same spot." });
    }
  }

  // 9: rejoining a step far away
  for (const e of scene.edges) {
    if (!e.isJoin) continue;
    const length = segmentsOf(e.points).reduce((n, s) => n + s.length, 0);
    if (length > FAR_MERGE) {
      out.push({ code: "far_merge", severity: "low", edgeId: e.id, message: "A path runs a long way across the page to rejoin another step.", recommendation: "End the path with a copy of the destination step or a jump marker instead of a long connector." });
    }
  }

  // 10: the entry channel should share the main path's row
  const spineFirst = lanes ? undefined : scene.spine.map((id) => byId.get(id)).find(Boolean);
  if (spineFirst) {
    const row = spineFirst.rect.y + spineFirst.rect.h / 2;
    const entries = scene.shapes.filter((x) => x.kind === "start");
    if (entries.length === 1) {
      const s = entries[0];
      if (Math.abs(s.rect.y + s.rect.h / 2 - row) > 4) {
        out.push({ code: "entry_row_mismatch", severity: "low", nodeId: s.id, message: `"${name(s)}" is not level with the main path.`, recommendation: "Align the entry step with the first step of the main path." });
      }
    } else if (entries.length > 1) {
      // Several entry channels are stacked in a column: the column as a whole should be centred on the main row.
      const top = Math.min(...entries.map((s) => s.rect.y));
      const bottom = Math.max(...entries.map((s) => s.rect.y + s.rect.h));
      if (Math.abs((top + bottom) / 2 - row) > 4) {
        out.push({ code: "entry_row_mismatch", severity: "low", nodeId: entries[0].id, message: "The entry channels are not centred on the main path.", recommendation: "Centre the entry channels on the first step of the main path." });
      }
    }
  }

  // 11: lanes diagrams: a step must sit inside a row of its own lane, and a stage should not have too many lanes
  if (lanes && scene.laneOf) {
    const rows = scene.containers.filter((c) => c.kind === "lane");
    for (const s of scene.shapes) {
      if (s.kind === "note" || s.kind === "start") continue;
      const lane = scene.laneOf.get(s.id);
      if (!lane) continue;
      const cx = s.rect.x + s.rect.w / 2;
      const cy = s.rect.y + s.rect.h / 2;
      const inside = rows.some((r) => r.title === lane && cx >= r.rect.x && cx <= r.rect.x + r.rect.w && cy >= r.rect.y && cy <= r.rect.y + r.rect.h);
      if (!inside) out.push({ code: "step_outside_lane", severity: "medium", nodeId: s.id, message: `"${name(s)}" is outside its lane ("${lane}").`, recommendation: "Re-run the layout to put it back in its lane, or change its lane." });
    }
    const perStage = new Map<string, number>();
    for (const r of rows) {
      const stage = r.id.split("_")[1];
      perStage.set(stage, (perStage.get(stage) ?? 0) + 1);
    }
    for (const [stage, n] of perStage) {
      if (n > 6) out.push({ code: "too_many_lanes", severity: "low", message: `One stage has ${n} lanes, which is hard to read.`, recommendation: "Merge lanes that are really the same actor, or split the process into more stages." });
      void stage;
    }
  }

  // 12: shapes packed too close
  for (let i = 0; i < scene.shapes.length; i++) {
    for (let j = i + 1; j < scene.shapes.length; j++) {
      const a = scene.shapes[i];
      const b = scene.shapes[j];
      if (a.kind === "note" || b.kind === "note") continue;
      const g = gap(a.rect, b.rect);
      if (g < MIN_CLEARANCE && !rectsOverlap(a.rect, b.rect)) {
        out.push({ code: "shapes_too_close", severity: "low", nodeId: a.id, message: `"${name(a)}" and "${name(b)}" are very close together.`, recommendation: "Leave room for the connector and its label." });
      }
    }
  }

  const rank = { high: 0, medium: 1, low: 2 } as const;
  return out.sort((x, y) => rank[x.severity] - rank[y.severity]);
}
