import type { Edge, Node } from "@xyflow/react";
import { normalizeWorkflowEdgeData } from "@/lib/workflow/normalize";

const edgeData = (edge: Edge) => normalizeWorkflowEdgeData(edge.data);

function isSplitNode(node: Node | undefined): boolean {
  return node?.type === "decision" || node?.type === "parallel";
}

/**
 * Returns the depth of a step label:
 *   1 = main path whole number  e.g. "3"
 *   2 = branch letter           e.g. "3a", "3r"
 *   3 = branch sub-step         e.g. "3a.1", "3a.r"
 */
function getStepDepth(step: string): number {
  if (/^\d+$/.test(step)) return 1;        // "3"
  if (/^\d+[a-z]$/.test(step)) return 2;  // "3a", "3r"
  if (/^\d+[a-z]\.\d+$/.test(step)) return 3;  // "3a.1"
  if (/^\d+[a-z]\.r$/.test(step)) return 3;    // "3a.r"
  return 99;
}

function isOnMainPath(step: string): boolean {
  return /^\d+$/.test(step);
}

/** "3" → "4" */
function nextMainStep(step: string): string {
  return String(Number.parseInt(step, 10) + 1);
}

/**
 * Next sequential step in a branch or sub-step sequence.
 *   "3a"   → "3a.1"  (first sub-step)
 *   "3a.1" → "3a.2"  (next sub-step)
 *   Returns null when no further continuation is valid (depth limit reached).
 */
function nextSeqStep(step: string): string | null {
  const depth = getStepDepth(step);
  if (depth === 2 && !/r/.test(step)) {
    return step + ".1"; // "3a" → "3a.1"
  }
  if (depth === 3 && /^\d+[a-z]\.\d+$/.test(step)) {
    const dot = step.lastIndexOf(".");
    const prefix = step.slice(0, dot);
    const n = Number.parseInt(step.slice(dot + 1), 10);
    return `${prefix}.${n + 1}`; // "3a.1" → "3a.2"
  }
  return null; // can't continue deeper
}

/**
 * Recovery step label off a given step.
 *   "3"  → "3r"   (recovery off main)
 *   "3a" → "3a.r" (recovery off branch)
 *   Returns null when depth would exceed 3.
 */
function recoveryStepLabel(step: string): string | null {
  const depth = getStepDepth(step);
  if (depth === 1) return step + "r";             // "3" → "3r"
  if (depth === 2 && !/r/.test(step)) return step + ".r"; // "3a" → "3a.r"
  return null; // depth 3 recovery would be depth 4 → overflow
}

/**
 * Find the primary outgoing edge for a node with multiple outgoing edges.
 *
 * Priority:
 *  1. An edge with isPrimary === true
 *  2. An edge with isHappyPath === true (backward compat)
 *  3. null — no primary identified
 */
function findPrimaryEdge(outgoing: Edge[]): Edge | null {
  return (
    outgoing.find((e) => edgeData(e).isPrimary === true) ??
    outgoing.find((e) => edgeData(e).isHappyPath === true) ??
    null
  );
}

export function computeStepNumbers(
  nodes: Node[],
  edges: Edge[]
): {
  stepNumbers: Map<string, string>;
  recoveryEdges: Map<string, string>;
  warnings: Set<string>;
  overflowNodes: Set<string>;
  mergeNodes: Set<string>;
} {
  const stepNumbers = new Map<string, string>();
  const recoveryEdges = new Map<string, string>();
  const warnings = new Set<string>();
  const overflowNodes = new Set<string>();
  const mergeNodes = new Set<string>();

  // Exclude annotation nodes (canvas-only), source channel nodes, and dangling endpoint nodes
  const filteredNodes = nodes.filter(
    (n) =>
      !(n.data as { isAnnotation?: boolean })?.isAnnotation &&
      n.type !== "source" &&
      n.type !== "dangling_endpoint"
  );

  if (filteredNodes.length === 0) {
    return { stepNumbers, recoveryEdges, warnings, overflowNodes, mergeNodes };
  }

  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));

  // Only include edges between non-source, non-annotation nodes so that
  // nodes connected solely from a source channel still register as entry points
  const filteredEdges = edges.filter(
    (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
  );

  const nodesById = new Map(filteredNodes.map((node) => [node.id, node]));
  const incomingByTarget = new Map<string, Edge[]>();
  const outgoingBySource = new Map<string, Edge[]>();

  for (const edge of filteredEdges) {
    const incoming = incomingByTarget.get(edge.target) ?? [];
    incoming.push(edge);
    incomingByTarget.set(edge.target, incoming);

    const outgoing = outgoingBySource.get(edge.source) ?? [];
    outgoing.push(edge);
    outgoingBySource.set(edge.source, outgoing);
  }

  // First non-source node with no incoming edges is the workflow entry point (step 1)
  const source =
    filteredNodes.find((node) => !incomingByTarget.get(node.id)?.length) ??
    filteredNodes[0];

  function getNodeX(nodeId: string): number {
    return nodesById.get(nodeId)?.position.x ?? 0;
  }

  /** Count non-recovery incoming edges for merge detection */
  function normalIncomingCount(nodeId: string): number {
    return (incomingByTarget.get(nodeId) ?? []).filter(
      (e) => !edgeData(e).isRecovery
    ).length;
  }

  function markRecovery(edge: Edge, targetNodeId: string) {
    const targetStep = stepNumbers.get(targetNodeId);
    if (!targetStep) return;
    recoveryEdges.set(edge.id, `↩ Returns to Step ${targetStep}`);
  }

  /**
   * Visit a node and assign it a step label.
   *
   * @param nodeId        The node to visit
   * @param step          The step label to assign
   * @param parentMain    The main-path step that spawned the current branch
   *                      (null when on the main path itself)
   */
  function visit(
    nodeId: string,
    step: string,
    parentMain: string | null
  ) {
    if (stepNumbers.has(nodeId)) {
      mergeNodes.add(nodeId);
      return;
    }

    const node = nodesById.get(nodeId);
    if (!node) return;

    stepNumbers.set(nodeId, step);

    const allOutgoing = outgoingBySource.get(nodeId) ?? [];

    // Separate recovery-tagged edges from normal edges
    const recovEdges = allOutgoing.filter((e) => edgeData(e).isRecovery);
    const normalEdges = allOutgoing.filter((e) => !edgeData(e).isRecovery);

    // ── Recovery outgoing edges ──────────────────────────────────────────────
    for (const edge of recovEdges) {
      if (stepNumbers.has(edge.target)) {
        // Cycle back to already-numbered node
        markRecovery(edge, edge.target);
        continue;
      }
      const rLabel = recoveryStepLabel(step);
      if (rLabel === null) {
        overflowNodes.add(edge.target);
      } else {
        visit(edge.target, rLabel, parentMain);
      }
    }

    // ── Normal outgoing edges ────────────────────────────────────────────────
    if (normalEdges.length === 0) return;

    const depth = getStepDepth(step);
    const isMain = isOnMainPath(step);

    if (normalEdges.length === 1) {
      const targetId = normalEdges[0].target;

      if (stepNumbers.has(targetId)) {
        // Cycle detection — not tagged isRecovery but points back
        markRecovery(normalEdges[0], targetId);
        return;
      }

      // Detect merge point: multiple non-recovery incoming edges, reached from a branch
      if (normalIncomingCount(targetId) > 1 && parentMain !== null && !isMain) {
        // Resume main-path sequence at the merge node
        const mergeStep = nextMainStep(parentMain);
        if (!stepNumbers.has(targetId)) {
          visit(targetId, mergeStep, null);
        } else {
          mergeNodes.add(targetId);
        }
        return;
      }

      if (isMain) {
        visit(targetId, nextMainStep(step), null);
      } else {
        const next = nextSeqStep(step);
        if (next === null) {
          overflowNodes.add(targetId);
        } else {
          visit(targetId, next, parentMain);
        }
      }
      return;
    }

    // ── Multiple outgoing normal edges ───────────────────────────────────────

    if (!isMain) {
      // On branch / sub-step path — further splits exceed max depth
      if (isSplitNode(node)) warnings.add(nodeId);
      for (const edge of normalEdges) {
        if (!stepNumbers.has(edge.target)) {
          overflowNodes.add(edge.target);
        }
      }
      return;
    }

    // On main path with multiple normal outgoing edges
    const primaryEdge = findPrimaryEdge(normalEdges);

    if (!primaryEdge && isSplitNode(node)) {
      warnings.add(nodeId);
    }

    if (primaryEdge) {
      // Primary continues the whole-number main path
      if (!stepNumbers.has(primaryEdge.target)) {
        visit(primaryEdge.target, nextMainStep(step), null);
      } else {
        mergeNodes.add(primaryEdge.target);
      }

      // Non-primary edges → branch letters, sorted left-to-right by target x-pos
      const branchEdges = normalEdges
        .filter((e) => e.id !== primaryEdge.id)
        .sort((a, b) => getNodeX(a.target) - getNodeX(b.target));

      let charCode = 97; // 'a'
      for (const edge of branchEdges) {
        if (stepNumbers.has(edge.target)) {
          mergeNodes.add(edge.target);
          continue;
        }
        const branchStep = step + String.fromCharCode(charCode); // "3a", "3b"
        visit(edge.target, branchStep, step);
        charCode++;
      }
    } else {
      // No primary — assign all as branch letters, sorted left-to-right by x-pos
      const sortedEdges = [...normalEdges].sort(
        (a, b) => getNodeX(a.target) - getNodeX(b.target)
      );
      let charCode = 97; // 'a'
      for (const edge of sortedEdges) {
        if (stepNumbers.has(edge.target)) {
          mergeNodes.add(edge.target);
          continue;
        }
        const branchStep = step + String.fromCharCode(charCode);
        visit(edge.target, branchStep, step);
        charCode++;
      }
    }
  }

  visit(source.id, "1", null);

  // Assign "U1", "U2", … to any disconnected nodes
  let disconnectedIndex = 1;
  for (const node of filteredNodes) {
    if (stepNumbers.has(node.id)) continue;
    while (stepNumbersHasValue(stepNumbers, `U${disconnectedIndex}`)) {
      disconnectedIndex++;
    }
    visit(node.id, `U${disconnectedIndex}`, null);
  }

  return { stepNumbers, recoveryEdges, warnings, overflowNodes, mergeNodes };
}

function stepNumbersHasValue(stepNumbers: Map<string, string>, value: string) {
  for (const step of stepNumbers.values()) {
    if (step === value) return true;
  }
  return false;
}
