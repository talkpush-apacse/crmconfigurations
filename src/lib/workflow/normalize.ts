import {
  DEFAULT_EDGE_DATA,
  type EdgeMarkerType,
  type PathSemantic,
  type WorkflowEdgeData,
} from "@/lib/workflow/types";

/**
 * The ONE place a stored connector's data is cleaned up and filled in.
 * The editor, the client viewer, version previews, Mermaid export, numbering and the server tools all call this,
 * so they can no longer drift apart (the viewer used to ignore pathSemantic and waypoints, and painted
 * happy-path green a different colour than the editor).
 */
export function normalizeEdgeMarker(
  marker: unknown,
  fallback: EdgeMarkerType
): EdgeMarkerType {
  return marker === "arrow" || marker === "arrowclosed" || marker === "none"
    ? marker
    : fallback;
}

export function normalizeWorkflowEdgeData(data: unknown): WorkflowEdgeData {
  const edgeData = (data ?? {}) as Partial<WorkflowEdgeData>;
  const lineType =
    edgeData.lineType === "straight" ||
    edgeData.lineType === "step" ||
    edgeData.lineType === "smoothstep"
      ? edgeData.lineType
      : DEFAULT_EDGE_DATA.lineType; // "bezier" falls through to default (smoothstep)
  const markerStart = normalizeEdgeMarker(
    edgeData.markerStart,
    DEFAULT_EDGE_DATA.markerStart
  );
  const markerEnd = normalizeEdgeMarker(
    edgeData.markerEnd,
    DEFAULT_EDGE_DATA.markerEnd
  );
  const strokeWidth =
    edgeData.strokeWidth === 1 ||
    edgeData.strokeWidth === 2 ||
    edgeData.strokeWidth === 3
      ? edgeData.strokeWidth
      : DEFAULT_EDGE_DATA.strokeWidth;
  const rawSemantic = edgeData.pathSemantic;
  const rawIsHappyPath = edgeData.isHappyPath === true;
  const rawIsRecovery = edgeData.isRecovery === true;

  // Derive pathSemantic from stored value, falling back to legacy booleans
  const pathSemantic: PathSemantic =
    rawSemantic === "happy" || rawSemantic === "failure" ||
    rawSemantic === "recovery" || rawSemantic === "neutral"
      ? rawSemantic
      : rawIsRecovery
      ? "recovery"
      : rawIsHappyPath
      ? "happy"
      : "neutral";

  // Keep legacy booleans in sync with the derived semantic
  const isHappyPath = pathSemantic === "happy";
  const isRecovery = pathSemantic === "recovery";

  return {
    ...DEFAULT_EDGE_DATA,
    label: typeof edgeData.label === "string" ? edgeData.label : "",
    lineType,
    markerStart,
    markerEnd,
    strokeColor:
      typeof edgeData.strokeColor === "string"
        ? edgeData.strokeColor
        : isRecovery
        ? "#F59E0B"
        : isHappyPath
        ? "#10B981"
        : DEFAULT_EDGE_DATA.strokeColor,
    strokeWidth:
      edgeData.strokeWidth === 1 ||
      edgeData.strokeWidth === 2 ||
      edgeData.strokeWidth === 3
        ? strokeWidth
        : isRecovery || isHappyPath || pathSemantic === "failure"
        ? 2
        : strokeWidth,
    animated:
      typeof edgeData.animated === "boolean"
        ? edgeData.animated
        : DEFAULT_EDGE_DATA.animated,
    isHappyPath,
    isRecovery,
    pathSemantic,
    recoveryLabel:
      typeof edgeData.recoveryLabel === "string"
        ? edgeData.recoveryLabel
        : undefined,
    isPrimary: typeof edgeData.isPrimary === "boolean" ? edgeData.isPrimary : undefined,
    waypoints: Array.isArray(edgeData.waypoints) ? edgeData.waypoints : undefined,
  };
}
