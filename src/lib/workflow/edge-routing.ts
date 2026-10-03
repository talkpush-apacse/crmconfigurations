import { Position } from "@xyflow/react";

export interface Point {
  x: number;
  y: number;
}

export interface Segment {
  start: Point;
  end: Point;
  /** index in allPoints where this segment starts */
  index: number;
  isHorizontal: boolean;
  /** true when this segment is degenerate (near-zero length) */
  isDegenerate: boolean;
}

const HANDLE_OFFSET = 40;
const DEGENERATE_THRESHOLD = 8;

function offsetPoint(x: number, y: number, position: Position, offset: number): Point {
  switch (position) {
    case Position.Top:    return { x, y: y - offset };
    case Position.Bottom: return { x, y: y + offset };
    case Position.Left:   return { x: x - offset, y };
    case Position.Right:  return { x: x + offset, y };
    default: return { x, y };
  }
}

function isVerticalHandle(position: Position): boolean {
  return position === Position.Top || position === Position.Bottom;
}

export function getSourceExit(x: number, y: number, position: Position): Point {
  return offsetPoint(x, y, position, HANDLE_OFFSET);
}

export function getTargetApproach(x: number, y: number, position: Position): Point {
  return offsetPoint(x, y, position, HANDLE_OFFSET);
}

/** Generate waypoints that approximate getSmoothStepPath for a given endpoint pair. */
export function autoRouteWaypoints(
  sourceX: number, sourceY: number,
  targetX: number, targetY: number,
  sourcePosition: Position, targetPosition: Position,
): Point[] {
  const srcExit = getSourceExit(sourceX, sourceY, sourcePosition);
  const tgtApproach = getTargetApproach(targetX, targetY, targetPosition);

  const srcVert = isVerticalHandle(sourcePosition);
  const tgtVert = isVerticalHandle(targetPosition);

  if (srcVert && tgtVert) {
    const midY = (srcExit.y + tgtApproach.y) / 2;
    return [
      { x: srcExit.x, y: midY },
      { x: tgtApproach.x, y: midY },
    ];
  }
  if (!srcVert && !tgtVert) {
    const midX = (srcExit.x + tgtApproach.x) / 2;
    return [
      { x: midX, y: srcExit.y },
      { x: midX, y: tgtApproach.y },
    ];
  }
  if (srcVert && !tgtVert) {
    return [{ x: srcExit.x, y: tgtApproach.y }];
  }
  // srcHoriz && tgtVert
  return [{ x: tgtApproach.x, y: srcExit.y }];
}

/** Full ordered point array: source → srcExit → ...waypoints → tgtApproach → target */
export function getFullPoints(
  sourceX: number, sourceY: number,
  targetX: number, targetY: number,
  sourcePosition: Position, targetPosition: Position,
  waypoints: Point[],
): Point[] {
  const srcExit = getSourceExit(sourceX, sourceY, sourcePosition);
  const tgtApproach = getTargetApproach(targetX, targetY, targetPosition);
  return [
    { x: sourceX, y: sourceY },
    srcExit,
    ...waypoints,
    tgtApproach,
    { x: targetX, y: targetY },
  ];
}

/** Build an orthogonal SVG path string through the given points, with optional corner rounding. */
export function buildOrthogonalPath(points: Point[], borderRadius = 0): string {
  if (points.length < 2) return "";
  if (points.length === 2 || borderRadius <= 0) {
    return points.map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`)).join(" ");
  }

  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const len1 = Math.hypot(dx1, dy1);
    const len2 = Math.hypot(dx2, dy2);

    if (len1 < 1 || len2 < 1) {
      d += ` L ${curr.x},${curr.y}`;
      continue;
    }

    const r = Math.min(borderRadius, len1 / 2, len2 / 2);
    const p1x = curr.x - (dx1 / len1) * r;
    const p1y = curr.y - (dy1 / len1) * r;
    const p2x = curr.x + (dx2 / len2) * r;
    const p2y = curr.y + (dy2 / len2) * r;
    d += ` L ${p1x},${p1y} Q ${curr.x},${curr.y} ${p2x},${p2y}`;
  }
  d += ` L ${points[points.length - 1].x},${points[points.length - 1].y}`;
  return d;
}

/** Decompose allPoints into segments for hit-testing and drag logic. */
export function getSegments(allPoints: Point[]): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < allPoints.length - 1; i++) {
    const start = allPoints[i];
    const end = allPoints[i + 1];
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    const len = Math.hypot(dx, dy);
    segments.push({
      start,
      end,
      index: i,
      isHorizontal: dy <= dx,
      isDegenerate: len < DEGENERATE_THRESHOLD,
    });
  }
  return segments;
}

/** Distance from point (px,py) to line segment (a→b). */
function distanceToSegment(px: number, py: number, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - a.x, py - a.y);
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lenSq));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

/** Whether segment at segIndex in allPoints is draggable (both endpoints are waypoints). */
export function isDraggableSegment(segIndex: number, allPoints: Point[]): boolean {
  const n = allPoints.length;
  // Both endpoints must be waypoints: indices 2..n-3
  return segIndex >= 2 && segIndex + 1 <= n - 3;
}

/** Find the nearest draggable segment to (px, py) within `threshold` flow units. */
export function findNearestDraggableSegment(
  allPoints: Point[],
  px: number,
  py: number,
  threshold = 20,
): Segment | null {
  const segments = getSegments(allPoints);
  let best: Segment | null = null;
  let bestDist = threshold;

  for (const seg of segments) {
    if (!isDraggableSegment(seg.index, allPoints)) continue;
    const d = distanceToSegment(px, py, seg.start, seg.end);
    if (d < bestDist) {
      bestDist = d;
      best = seg;
    }
  }
  return best;
}

/**
 * Translate a segment in allPoints by (dx,dy) and return updated waypoints array.
 *
 * allPoints = [source, srcExit, ...waypoints, tgtApproach, target]
 * waypoints correspond to allPoints[2 .. n-3]
 *
 * For a degenerate segment (both endpoints same), inserts a Z-shape offset instead.
 */
export function applySegmentDrag(
  sourceX: number, sourceY: number,
  targetX: number, targetY: number,
  sourcePosition: Position, targetPosition: Position,
  startWaypoints: Point[],
  allPoints: Point[],
  segIndex: number,
  dx: number,
  dy: number,
): Point[] {
  const n = allPoints.length;
  const segStart = allPoints[segIndex];
  const segEnd = allPoints[segIndex + 1];
  const segLen = Math.hypot(segEnd.x - segStart.x, segEnd.y - segStart.y);

  // Degenerate segment: insert Z-shape offset instead of translating
  if (segLen < DEGENERATE_THRESHOLD) {
    const srcExit = getSourceExit(sourceX, sourceY, sourcePosition);
    const tgtApproach = getTargetApproach(targetX, targetY, targetPosition);
    const newX = srcExit.x + dx;
    const newY = srcExit.y + dy;
    // Determine dominant drag direction from context
    const prevSeg = segIndex > 0 ? allPoints[segIndex - 1] : null;
    const nextSeg = segIndex + 2 < n ? allPoints[segIndex + 2] : null;
    const prevIsVert = prevSeg ? Math.abs(segStart.y - prevSeg.y) > Math.abs(segStart.x - prevSeg.x) : true;
    const nextIsVert = nextSeg ? Math.abs(segEnd.y - nextSeg.y) > Math.abs(segEnd.x - nextSeg.x) : true;

    if (prevIsVert && nextIsVert) {
      // Straight vertical path → horizontal offset (Z-shape)
      return [
        { x: newX, y: srcExit.y },
        { x: newX, y: tgtApproach.y },
      ];
    }
    // Straight horizontal path → vertical offset
    return [
      { x: srcExit.x, y: newY },
      { x: tgtApproach.x, y: newY },
    ];
  }

  const isHoriz = Math.abs(segEnd.y - segStart.y) <= Math.abs(segEnd.x - segStart.x);
  const moveX = isHoriz ? 0 : dx;
  const moveY = isHoriz ? dy : 0;

  // waypoints are allPoints[2..n-3], so waypoints[i] = allPoints[i+2]
  return startWaypoints.map((p, i) => {
    const apIdx = i + 2;
    if (apIdx === segIndex || apIdx === segIndex + 1) {
      return { x: p.x + moveX, y: p.y + moveY };
    }
    return { ...p };
  });
}
