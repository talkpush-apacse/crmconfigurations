"use client";

import { useRef, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  MarkerType,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { DEFAULT_EDGE_DATA, type PathSemantic, type WorkflowEdgeData } from "@/lib/workflow/types";
import {
  autoRouteWaypoints,
  getFullPoints,
  buildOrthogonalPath,
  getSegments,
  isDraggableSegment,
  findNearestDraggableSegment,
  applySegmentDrag,
  type Point,
} from "@/lib/workflow/edge-routing";
import { cn } from "@/lib/utils";

// Colors auto-assigned by semantic logic — not treated as user overrides
const AUTO_SEMANTIC_COLORS = new Set(["#6B7280", "#00BFA5", "#10B981", "#F59E0B", "#F87171"]);

const SEMANTIC_COLOR: Record<PathSemantic, string> = {
  happy:    "#10B981",
  failure:  "#F87171",
  recovery: "#F59E0B",
  neutral:  "#6B7280",
};

function resolveSemanticStrokeColor(edgeData: WorkflowEdgeData): string {
  const stored = edgeData.strokeColor ?? DEFAULT_EDGE_DATA.strokeColor ?? "#6B7280";
  // If user set a color outside the semantic palette, honour it
  if (stored && !AUTO_SEMANTIC_COLORS.has(stored)) return stored;
  // Derive from pathSemantic, falling back to legacy booleans
  const semantic: PathSemantic =
    edgeData.pathSemantic ??
    (edgeData.isRecovery ? "recovery" : edgeData.isHappyPath ? "happy" : "neutral");
  return SEMANTIC_COLOR[semantic];
}

function markerType(marker: WorkflowEdgeData["markerStart"]) {
  if (marker === "arrow") return MarkerType.Arrow;
  if (marker === "arrowclosed") return MarkerType.ArrowClosed;
  return undefined;
}

interface DragState {
  segIndex: number;
  startClientX: number;
  startClientY: number;
  startWaypoints: Point[];
  allPoints: Point[];
  isDegenerate: boolean;
  isDragging: boolean;
}

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label: edgeLabel,
  data,
  style,
  selected,
  markerStart,
  markerEnd,
}: EdgeProps) {
  const { setEdges, screenToFlowPosition } = useReactFlow();
  const dragRef = useRef<DragState | null>(null);
  const [hoveredSegIdx, setHoveredSegIdx] = useState<number | null>(null);

  const edgeData: WorkflowEdgeData = {
    ...DEFAULT_EDGE_DATA,
    ...((data ?? {}) as Partial<WorkflowEdgeData>),
  };

  const storedWaypoints: Point[] = Array.isArray(edgeData.waypoints)
    ? (edgeData.waypoints as Point[])
    : [];
  const isOrthogonal =
    edgeData.lineType === "step" || edgeData.lineType === "smoothstep";
  const borderRadius = edgeData.lineType === "smoothstep" ? 8 : 0;

  const pathParams = {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  };

  // ── Build visual path ──────────────────────────────────────────────────────

  let edgePath: string;
  let labelX: number;
  let labelY: number;
  let allPointsForHit: Point[] | null = null;

  if (isOrthogonal && storedWaypoints.length > 0) {
    // Custom path through stored waypoints
    const pts = getFullPoints(
      sourceX, sourceY, targetX, targetY,
      sourcePosition, targetPosition,
      storedWaypoints,
    );
    edgePath = buildOrthogonalPath(pts, borderRadius);
    allPointsForHit = pts;
    const mid = Math.floor(pts.length / 2);
    labelX = (pts[mid].x + pts[mid - 1].x) / 2;
    labelY = (pts[mid].y + pts[mid - 1].y) / 2;
  } else if (isOrthogonal) {
    // Auto-routed: use ReactFlow's getSmoothStepPath for pixel-perfect match
    [edgePath, labelX, labelY] =
      edgeData.lineType === "step"
        ? getSmoothStepPath({ ...pathParams, borderRadius: 0 })
        : getSmoothStepPath({ ...pathParams, borderRadius: 8 });
    // Compute allPoints for the drag hit area (uses auto-route approximation)
    const initWp = autoRouteWaypoints(
      sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
    );
    allPointsForHit = getFullPoints(
      sourceX, sourceY, targetX, targetY,
      sourcePosition, targetPosition,
      initWp,
    );
  } else {
    [edgePath, labelX, labelY] =
      edgeData.lineType === "straight"
        ? getStraightPath(pathParams)
        : getBezierPath(pathParams);
  }

  // ── Styling ────────────────────────────────────────────────────────────────

  const styledStrokeWidth =
    typeof style?.strokeWidth === "number"
      ? style.strokeWidth
      : typeof style?.strokeWidth === "string"
      ? Number.parseFloat(style.strokeWidth)
      : undefined;
  const strokeWidth =
    (Number.isFinite(styledStrokeWidth) ? styledStrokeWidth : undefined) ??
    edgeData.strokeWidth ??
    DEFAULT_EDGE_DATA.strokeWidth ??
    1;
  const strokeColor = selected
    ? "#14B8A6"
    : (style?.stroke as string | undefined) ??
      resolveSemanticStrokeColor(edgeData);
  const label =
    typeof edgeLabel === "string" && edgeLabel.trim()
      ? edgeLabel.trim()
      : edgeData.label?.trim();

  const dashArray =
    edgeData.pathSemantic === "recovery" || edgeData.isRecovery
      ? "6 3"
      : edgeData.animated
      ? "5 5"
      : (style?.strokeDasharray as string | undefined);

  // ── Drag handlers ──────────────────────────────────────────────────────────

  function startDrag(
    e: React.PointerEvent<SVGPathElement>,
    segIndex: number,
    initWaypoints: Point[],
    initAllPoints: Point[],
    isDegenerate: boolean,
  ) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      segIndex,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startWaypoints: initWaypoints.map((p) => ({ ...p })),
      allPoints: initAllPoints,
      isDegenerate,
      isDragging: false,
    };
  }

  // Full-path hit area pointerDown (when no waypoints yet)
  function handleFullPathPointerDown(e: React.PointerEvent<SVGPathElement>) {
    if (!allPointsForHit) return;
    const clickFlow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const initWp = autoRouteWaypoints(
      sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
    );
    const initAllPts = getFullPoints(
      sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, initWp,
    );
    const seg = findNearestDraggableSegment(initAllPts, clickFlow.x, clickFlow.y, 120);
    if (!seg) return;
    startDrag(e, seg.index, initWp, initAllPts, seg.isDegenerate);
  }

  // Per-segment hit area pointerDown (when waypoints exist)
  function handleSegmentPointerDown(
    e: React.PointerEvent<SVGPathElement>,
    segIndex: number,
  ) {
    if (!allPointsForHit) return;
    const seg = getSegments(allPointsForHit)[segIndex];
    if (!seg) return;
    startDrag(e, segIndex, storedWaypoints, allPointsForHit, seg.isDegenerate);
  }

  function handlePointerMove(e: React.PointerEvent<SVGPathElement>) {
    if (!dragRef.current) return;

    const { startClientX, startClientY } = dragRef.current;
    const rawDx = e.clientX - startClientX;
    const rawDy = e.clientY - startClientY;

    // Require 4px screen movement before starting drag to avoid accidental drags
    if (!dragRef.current.isDragging && Math.abs(rawDx) < 4 && Math.abs(rawDy) < 4) return;

    if (!dragRef.current.isDragging) {
      dragRef.current.isDragging = true;
    }
    e.stopPropagation(); // prevent canvas pan while dragging a segment

    const startFlow = screenToFlowPosition({ x: startClientX, y: startClientY });
    const currentFlow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const dx = currentFlow.x - startFlow.x;
    const dy = currentFlow.y - startFlow.y;

    const newWaypoints = applySegmentDrag(
      sourceX, sourceY, targetX, targetY,
      sourcePosition, targetPosition,
      dragRef.current.startWaypoints,
      dragRef.current.allPoints,
      dragRef.current.segIndex,
      dx, dy,
    );

    setEdges((eds) =>
      eds.map((edge) =>
        edge.id === id
          ? { ...edge, data: { ...(edge.data as object), waypoints: newWaypoints } }
          : edge,
      ),
    );
  }

  function handlePointerUp(e: React.PointerEvent<SVGPathElement>) {
    if (!dragRef.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);

    if (dragRef.current.isDragging) {
      // Commit: let WorkflowEditor save via custom event
      setEdges((eds) => {
        const edge = eds.find((ed) => ed.id === id);
        const finalWaypoints: Point[] = edge
          ? (((edge.data as WorkflowEdgeData).waypoints ?? []) as Point[])
          : [];
        window.dispatchEvent(
          new CustomEvent("rflow:waypoints-committed", {
            detail: { edgeId: id, waypoints: finalWaypoints },
          }),
        );
        return eds;
      });
    }

    dragRef.current = null;
  }

  // ── Segment hit areas ──────────────────────────────────────────────────────

  const draggableSegments =
    isOrthogonal && allPointsForHit && storedWaypoints.length > 0
      ? getSegments(allPointsForHit).filter((s) =>
          isDraggableSegment(s.index, allPointsForHit!),
        )
      : [];

  const sharedPointerHandlers = {
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerStart={markerStart ?? markerType(edgeData.markerStart)}
        markerEnd={markerEnd ?? markerType(edgeData.markerEnd)}
        // Keep interaction width for click-to-select; segment hit areas handle drag
        interactionWidth={24}
        className={cn(edgeData.animated && "react-flow__edge-path-animated")}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth: selected ? strokeWidth + 1 : strokeWidth,
          strokeDasharray: (edgeData.pathSemantic === "recovery" || edgeData.isRecovery) ? "6 3" : edgeData.animated ? "5 5" : style?.strokeDasharray,
        }}
      />

      {/* ── Orthogonal edge drag affordances ── */}
      {isOrthogonal && (
        <>
          {storedWaypoints.length === 0 ? (
            /* No waypoints: full-path drag area — user clicks anywhere on the line */
            <path
              d={edgePath}
              fill="none"
              stroke="transparent"
              strokeWidth={20}
              style={{ pointerEvents: "stroke", cursor: "crosshair" }}
              onPointerDown={handleFullPathPointerDown}
              {...sharedPointerHandlers}
            />
          ) : (
            /* With waypoints: per-segment drag areas */
            draggableSegments.map((seg) => {
              const isHovered = hoveredSegIdx === seg.index;
              const segCursor = seg.isDegenerate
                ? "crosshair"
                : seg.isHorizontal
                ? "ns-resize"
                : "ew-resize";
              return (
                <path
                  key={`seg-${seg.index}`}
                  d={`M ${seg.start.x},${seg.start.y} L ${seg.end.x},${seg.end.y}`}
                  fill="none"
                  stroke={isHovered ? strokeColor : "transparent"}
                  strokeWidth={isHovered ? strokeWidth + 4 : 20}
                  strokeOpacity={isHovered ? 0.35 : 1}
                  strokeDasharray={dashArray}
                  style={{ pointerEvents: "stroke", cursor: segCursor }}
                  onPointerEnter={() => setHoveredSegIdx(seg.index)}
                  onPointerLeave={() => setHoveredSegIdx(null)}
                  onPointerDown={(e) => handleSegmentPointerDown(e, seg.index)}
                  {...sharedPointerHandlers}
                />
              );
            })
          )}
        </>
      )}

      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
            className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-600 shadow-sm"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
