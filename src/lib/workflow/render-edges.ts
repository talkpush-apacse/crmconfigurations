import { MarkerType, type Edge } from "@xyflow/react";
import { normalizeWorkflowEdgeData } from "./normalize";
import type { EdgeMarkerType } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
function markerFromData(marker: EdgeMarkerType) {
  if (marker === "arrow") return MarkerType.Arrow;
  if (marker === "arrowclosed") return MarkerType.ArrowClosed;
  return undefined;
}

/** Turns stored connectors into what the diagram draws (labels, colours, arrow heads). Used by the client page. */
export function buildRenderEdges(edges: any[], recoveryEdges: Map<string, string>, extra?: (edge: any) => Partial<Edge>): Edge[] {
  return edges.map((edge) => {
    const data = normalizeWorkflowEdgeData(edge.data);
    const recoveryLabel = recoveryEdges.get(edge.id) ?? data.recoveryLabel;
    const isRecovery = data.isRecovery || recoveryEdges.has(edge.id);
    const isHappyPath = data.isHappyPath && !isRecovery;
    const label = isRecovery ? (recoveryLabel ?? "↩ Recovery path") : isHappyPath ? (data.label ? `✓ ${data.label}` : "✓") : data.label || edge.label;
    return {
      ...edge,
      type: "custom",
      label,
      data: { ...data, isRecovery, recoveryLabel },
      markerStart: markerFromData(data.markerStart),
      markerEnd: markerFromData(data.markerEnd),
      animated: data.animated === true,
      ...(extra ? extra(edge) : {}),
    } as Edge;
  });
}
