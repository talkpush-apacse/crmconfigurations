import { type NodeType, type WorkflowEdgeData } from "./types";
import { normalizeWorkflowEdgeData } from "./normalize";

interface MermaidNode {
  id: string;
  data: { label: string; type: NodeType };
}

interface MermaidEdge {
  source: string;
  target: string;
  data?: Partial<WorkflowEdgeData>;
  label?: string;
}

function escapeLabel(label: string): string {
  return label.replace(/"/g, "#quot;").replace(/[[\]{}()|]/g, " ");
}

function wrapNode(id: string, label: string, type: NodeType): string {
  const safe = escapeLabel(label);
  switch (type) {
    case "decision":
      return `${id}{"${safe}"}`;
    case "integration":
      return `${id}[["${safe}"]]`;
    default:
      return `${id}["${safe}"]`;
  }
}

/** Connector data via the shared normalizer; a plain `label` on the edge is used when data has none. */
function edgeData(edge: MermaidEdge): WorkflowEdgeData {
  const normalized = normalizeWorkflowEdgeData(edge.data);
  if (typeof edge.data?.label === "string") return normalized;
  return { ...normalized, label: typeof edge.label === "string" ? edge.label : "" };
}

function connectorFor(data: WorkflowEdgeData): string {
  const hasStart = data.markerStart !== "none";
  const hasEnd = data.markerEnd !== "none";

  if (data.animated) {
    if (hasStart && hasEnd) return "<-.->";
    if (hasStart) return "<-.-";
    if (hasEnd) return "-.->";
    return "-.-";
  }

  if (hasStart && hasEnd) return "<-->";
  if (hasStart) return "<--";
  if (hasEnd) return "-->";
  return "---";
}

export function toMermaid(
  nodes: MermaidNode[],
  edges: MermaidEdge[],
  stepNumbers?: Map<string, string>
): string {
  const lines: string[] = ["flowchart TD"];

  for (const node of nodes) {
    const step = stepNumbers?.get(node.id);
    const label = step ? `${step}. ${node.data.label}` : node.data.label;
    lines.push(`  ${wrapNode(node.id, label, node.data.type)}`);
  }

  lines.push("");

  for (const edge of edges) {
    const data = edgeData(edge);
    const connector = connectorFor(data);
    const label = data.label ?? "";
    if (label) {
      lines.push(`  ${edge.source} ${connector}|${escapeLabel(label)}| ${edge.target}`);
    } else {
      lines.push(`  ${edge.source} ${connector} ${edge.target}`);
    }
  }

  return lines.join("\n");
}
