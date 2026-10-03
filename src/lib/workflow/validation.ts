import type { Edge, Node } from "@xyflow/react";
import { computeStepNumbers } from "./numbering";
import type {
  WorkflowEdgeData,
  WorkflowNodeData,
  WorkflowValidationFinding,
} from "./types";

type FlowNode = Node<WorkflowNodeData>;
type FlowEdge = Edge<WorkflowEdgeData>;

const TERMINAL_LABELS = [
  "hired",
  "rejected",
  "withdrawn",
  "disqualified",
  "not selected",
  "complete",
  "completed",
  "closed",
];

export function validateWorkflow(
  nodes: Node[],
  edges: Edge[]
): WorkflowValidationFinding[] {
  // Exclude annotation nodes — they carry no workflow logic
  const flowNodes = (nodes as FlowNode[]).filter((n) => !(n.data as { isAnnotation?: boolean })?.isAnnotation);
  const flowEdges = edges as FlowEdge[];
  const findings: WorkflowValidationFinding[] = [];
  const nodeIds = new Set(flowNodes.map((node) => node.id));
  const outgoing = new Map<string, FlowEdge[]>();
  const incoming = new Map<string, FlowEdge[]>();

  for (const edge of flowEdges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      findings.push({
        code: "dangling_edge",
        severity: "high",
        message: "Connector points to a node that no longer exists.",
        edgeId: edge.id,
        recommendation: "Delete the connector or reconnect it to an existing node.",
      });
      continue;
    }
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge]);
  }

  if (flowNodes.length > 0 && !flowNodes.some((node) => node.type === "source")) {
    findings.push({
      code: "missing_source",
      severity: "high",
      message: "Workflow has no source node.",
      recommendation: "Add a source node that describes how candidates enter the process.",
    });
  }

  for (const node of flowNodes) {
    const nodeIncoming = incoming.get(node.id) ?? [];
    const nodeOutgoing = outgoing.get(node.id) ?? [];
    const data = node.data;
    const metadata = data.data ?? {};
    const label = data.label?.trim() || node.id;

    if (flowNodes.length > 1 && nodeIncoming.length === 0 && nodeOutgoing.length === 0) {
      findings.push({
        code: "orphan_node",
        severity: "medium",
        message: `"${label}" is not connected to the workflow.`,
        nodeId: node.id,
        recommendation: "Connect it to the process or remove it.",
      });
    }

    if (node.type === "decision" || node.type === "parallel") {
      if (nodeOutgoing.length < 2) {
        findings.push({
          code: "branching_node_too_few_paths",
          severity: "medium",
          message: `"${label}" should have at least two outgoing paths.`,
          nodeId: node.id,
          recommendation: "Add the missing branch or change the node type.",
        });
      }
      if (
        nodeOutgoing.length >= 2 &&
        !nodeOutgoing.some((edge) => edge.data?.isHappyPath || edge.data?.isPrimary)
      ) {
        findings.push({
          code: "missing_happy_or_primary_path",
          severity: "high",
          message: `"${label}" has no happy or primary path marked.`,
          nodeId: node.id,
          recommendation: "Mark the positive or main forward path.",
        });
      }

      for (const edge of nodeOutgoing) {
        if (edge.data?.isHappyPath || edge.data?.isPrimary || edge.data?.isRecovery) {
          continue;
        }
        if (!branchTerminatesOrRejoins(edge, outgoing, flowNodes)) {
          findings.push({
            code: "branch_does_not_terminate_or_rejoin",
            severity: "medium",
            message: `A branch from "${label}" does not clearly terminate or rejoin the main flow.`,
            edgeId: edge.id,
            nodeId: node.id,
            recommendation:
              "End the branch in a terminal stage or connect it back with a recovery path.",
          });
        }
      }
    }

    if (node.type === "wait" && !stringValue(metadata.waitDuration)) {
      findings.push({
        code: "wait_missing_duration",
        severity: "medium",
        message: `"${label}" is missing a wait duration.`,
        nodeId: node.id,
        recommendation: "Specify the SLA or hold duration, such as 24 hours.",
      });
    }

    if (node.type === "communication" && !hasCommunicationMetadata(metadata)) {
      findings.push({
        code: "communication_missing_metadata",
        severity: "medium",
        message: `"${label}" is missing channel or template metadata.`,
        nodeId: node.id,
        recommendation: "Add the channel, template name, or Talkpush send action.",
      });
    }

    if (
      node.type === "integration" &&
      (!stringValue(metadata.integrationSystem) ||
        !stringValue(metadata.integrationDirection))
    ) {
      findings.push({
        code: "integration_missing_metadata",
        severity: "high",
        message: `"${label}" is missing integration system or direction.`,
        nodeId: node.id,
        recommendation: "Specify the system and whether data is pushed, pulled, or bidirectional.",
      });
    }

    if (
      node.type === "manual_action" &&
      !stringValue(data.actorLabel) &&
      !stringValue(metadata.ownerRole)
    ) {
      findings.push({
        code: "manual_action_missing_owner",
        severity: "medium",
        message: `"${label}" is missing a manual owner.`,
        nodeId: node.id,
        recommendation: "Add the recruiter, hiring manager, HR, or other owner role.",
      });
    }

    if (
      (data.feasibility === "likely" || data.feasibility === "needs_review") &&
      !stringValue(data.feasibilityNote)
    ) {
      findings.push({
        code: "feasibility_missing_note",
        severity: data.feasibility === "needs_review" ? "high" : "medium",
        message: `"${label}" needs a feasibility note.`,
        nodeId: node.id,
        recommendation: "Explain the dependency, assumption, or implementation risk.",
      });
    }
  }

  const labelCounts = new Map<string, FlowNode[]>();
  for (const node of flowNodes) {
    const label = node.data.label?.trim().toLowerCase();
    if (!label) continue;
    labelCounts.set(label, [...(labelCounts.get(label) ?? []), node]);
  }
  for (const [label, duplicates] of labelCounts) {
    if (duplicates.length > 1) {
      findings.push({
        code: "duplicate_node_label",
        severity: "low",
        message: `Multiple nodes use the label "${label}".`,
        nodeId: duplicates[0].id,
        recommendation:
          "Make labels more specific so implementation and customer review are unambiguous.",
      });
    }
  }

  const { stepNumbers } = computeStepNumbers(flowNodes, flowEdges);
  for (const edge of flowEdges) {
    if (edge.data?.isRecovery && !stepNumbers.has(edge.target)) {
      findings.push({
        code: "recovery_target_not_numbered",
        severity: "high",
        message: "Recovery connector points to a target without a computed step number.",
        edgeId: edge.id,
        recommendation: "Reconnect it to a numbered main-flow node.",
      });
    }
  }

  return findings;
}

function branchTerminatesOrRejoins(
  startEdge: FlowEdge,
  outgoing: Map<string, FlowEdge[]>,
  nodes: FlowNode[]
): boolean {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const visited = new Set<string>();
  const queue = [startEdge.target];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) return false;
    if (isTerminalNode(node)) return true;

    const nextEdges = outgoing.get(nodeId) ?? [];
    if (nextEdges.length === 0) return true;
    if (nextEdges.some((edge) => edge.data?.isRecovery)) return true;

    for (const edge of nextEdges) {
      queue.push(edge.target);
    }
  }

  return false;
}

function isTerminalNode(node: FlowNode): boolean {
  // An explicit end state or jump marker (Process Map style) is a real ending; no guessing from the words needed.
  if (node.type === "terminator" || node.type === "jump") return true;
  const label = node.data.label?.toLowerCase() ?? "";
  return TERMINAL_LABELS.some((terminal) => label.includes(terminal));
}

function hasCommunicationMetadata(metadata: WorkflowNodeData["data"]): boolean {
  const action = stringValue(metadata.talkpushAction);
  return Boolean(
    stringValue(metadata.channel) ||
      stringValue(metadata.messageTemplate) ||
      action?.startsWith("send_") ||
      action === "voice_ai_call"
  );
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
