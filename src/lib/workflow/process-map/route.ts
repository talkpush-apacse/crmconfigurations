/**
 * Connector routing for the Process Map style: elbows only (no diagonals). One function used by the on-screen
 * connector, the linter and every export, so the line you see is the line that is checked and exported.
 */

export type Pos = "top" | "right" | "bottom" | "left";
export interface P {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where a connector attaches on a shape: the middle of one side. */
export function handlePoint(rect: Rect, handle: Pos): P {
  switch (handle) {
    case "top":
      return { x: rect.x + rect.w / 2, y: rect.y };
    case "bottom":
      return { x: rect.x + rect.w / 2, y: rect.y + rect.h };
    case "left":
      return { x: rect.x, y: rect.y + rect.h / 2 };
    default:
      return { x: rect.x + rect.w, y: rect.y + rect.h / 2 };
  }
}

const same = (a: number, b: number) => Math.abs(a - b) < 0.5;

/** Removes points that sit on a straight line between their neighbours, and repeated points. */
function simplify(points: P[]): P[] {
  const out: P[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && same(last.x, p.x) && same(last.y, p.y)) continue;
    out.push(p);
  }
  for (let i = out.length - 2; i > 0; i--) {
    const a = out[i - 1];
    const b = out[i];
    const c = out[i + 1];
    if ((same(a.x, b.x) && same(b.x, c.x)) || (same(a.y, b.y) && same(b.y, c.y))) out.splice(i, 1);
  }
  return out;
}

/**
 * The path from one point to another, leaving in the direction of `sPos` and arriving from the direction of `tPos`.
 * `bias` (0..1) moves the middle section of a Z-shaped connector toward the source (0) or the target (1).
 */
export function routePoints(s: P, sPos: Pos, t: P, tPos: Pos, bias = 0.5): P[] {
  const vertS = sPos === "top" || sPos === "bottom";
  const vertT = tPos === "top" || tPos === "bottom";

  if (vertS && vertT) {
    if (same(s.x, t.x)) return simplify([s, t]);
    const midY = s.y + (t.y - s.y) * bias;
    return simplify([s, { x: s.x, y: midY }, { x: t.x, y: midY }, t]);
  }
  if (!vertS && !vertT) {
    if (same(s.y, t.y)) return simplify([s, t]);
    const midX = s.x + (t.x - s.x) * bias;
    return simplify([s, { x: midX, y: s.y }, { x: midX, y: t.y }, t]);
  }
  if (!vertS && vertT) {
    // leave sideways, arrive from above or below: one bend
    return simplify([s, { x: t.x, y: s.y }, t]);
  }
  // leave up/down, arrive from the side: one bend
  return simplify([s, { x: s.x, y: t.y }, t]);
}

/** A rounded-corner SVG path through the points (radius 0 gives sharp elbows). */
export function pathFromPoints(points: P[], radius = 0): string {
  if (points.length === 0) return "";
  if (radius <= 0 || points.length < 3) return points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ");
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];
    const r = Math.min(radius, Math.hypot(cur.x - prev.x, cur.y - prev.y) / 2, Math.hypot(next.x - cur.x, next.y - cur.y) / 2);
    const ax = cur.x + Math.sign(prev.x - cur.x) * r;
    const ay = cur.y + Math.sign(prev.y - cur.y) * r;
    const bx = cur.x + Math.sign(next.x - cur.x) * r;
    const by = cur.y + Math.sign(next.y - cur.y) * r;
    d += ` L${ax} ${ay} Q${cur.x} ${cur.y} ${bx} ${by}`;
  }
  const last = points[points.length - 1];
  return `${d} L${last.x} ${last.y}`;
}

export interface Segment {
  a: P;
  b: P;
  horizontal: boolean;
  length: number;
}

export function segmentsOf(points: P[]): Segment[] {
  const out: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    out.push({ a, b, horizontal: same(a.y, b.y), length: Math.abs(b.x - a.x) + Math.abs(b.y - a.y) });
  }
  return out;
}

/** The spot for a connector's label: on the chosen segment, `t` of the way along the whole path. */
export function pointAlong(points: P[], t: number): P {
  const segs = segmentsOf(points);
  const total = segs.reduce((n, s) => n + s.length, 0);
  let want = total * t;
  for (const s of segs) {
    if (want <= s.length) {
      const f = s.length === 0 ? 0 : want / s.length;
      return { x: s.a.x + (s.b.x - s.a.x) * f, y: s.a.y + (s.b.y - s.a.y) * f };
    }
    want -= s.length;
  }
  return points[points.length - 1];
}

export function rectsOverlap(a: Rect, b: Rect, margin = 0): boolean {
  return a.x < b.x + b.w + margin && b.x < a.x + a.w + margin && a.y < b.y + b.h + margin && b.y < a.y + a.h + margin;
}

/** Does the segment pass through the rectangle (shrunk by `inset` so merely touching an edge does not count)? */
export function segmentHitsRect(seg: Segment, r: Rect, inset = 1): boolean {
  const x1 = r.x + inset;
  const y1 = r.y + inset;
  const x2 = r.x + r.w - inset;
  const y2 = r.y + r.h - inset;
  if (seg.horizontal) {
    const y = seg.a.y;
    const lo = Math.min(seg.a.x, seg.b.x);
    const hi = Math.max(seg.a.x, seg.b.x);
    return y > y1 && y < y2 && hi > x1 && lo < x2;
  }
  const x = seg.a.x;
  const lo = Math.min(seg.a.y, seg.b.y);
  const hi = Math.max(seg.a.y, seg.b.y);
  return x > x1 && x < x2 && hi > y1 && lo < y2;
}
