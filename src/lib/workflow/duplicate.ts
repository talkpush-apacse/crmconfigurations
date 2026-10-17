import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { nanoid } from "@/lib/workflow/ids";
import { jsonClone, normalizeEdgeData, type FlowEdge, type FlowNode } from "@/lib/workflow/helpers";
import type { WorkflowNodeData } from "@/lib/workflow/types";

/**
 * Copies a diagram with a new id on every step and connector. Settings inside a step that point at another
 * step (a jump marker's target, a note's "attached to") are pointed at the copy, so the copy is self-contained.
 * Connectors whose ends are not in the copied steps are dropped.
 */
export function cloneGraphWithFreshIds(sourceNodes: FlowNode[], sourceEdges: FlowEdge[]) {
  const idMap = new Map<string, string>();
  const edgeIdMap: Record<string, string> = {};

  const nodes = sourceNodes.map((node) => {
    const nextId = `node_${nanoid(8)}`;
    idMap.set(node.id, nextId);
    return {
      ...jsonClone(node),
      id: nextId,
      selected: false,
      data: jsonClone(node.data) as WorkflowNodeData,
    } satisfies FlowNode;
  });

  for (const node of nodes) {
    const data = node.data as unknown as Record<string, unknown>;
    for (const key of ["jumpToNodeId", "attachTo"]) {
      const target = data[key];
      if (typeof target === "string" && idMap.has(target)) data[key] = idMap.get(target);
    }
  }

  const edges = sourceEdges.flatMap((edge) => {
    const source = idMap.get(edge.source);
    const target = idMap.get(edge.target);
    if (!source || !target) return [];
    const nextId = `edge_${nanoid(8)}`;
    edgeIdMap[edge.id] = nextId;
    return [
      {
        ...jsonClone(edge),
        id: nextId,
        source,
        target,
        selected: false,
        type: "custom",
        data: normalizeEdgeData(edge.data),
      } satisfies FlowEdge,
    ];
  });

  return { nodes, edges, nodeIdMap: Object.fromEntries(idMap), edgeIdMap };
}

type SourcePage = { id?: unknown; name?: unknown; nodes?: unknown; edges?: unknown; viewport?: unknown };

const asNodes = (v: unknown) => (Array.isArray(v) ? (v as FlowNode[]) : []);
const asEdges = (v: unknown) => (Array.isArray(v) ? (v as FlowEdge[]) : []);

export interface DuplicateWorkflowOverrides {
  workflowName?: string;
  clientName?: string;
  description?: string;
}

/**
 * Copies a workflow into a new draft: every page, the Process Map style, numbering and look, the company it is
 * filed under and the template it started from. Steps and connectors get new ids.
 * Not copied, because they belong to the original's life and not to its design: share links and invites, comments,
 * suggestions, version history, scoping notes, the audit trail and any published version. The copy starts private.
 * Returns null when the source workflow does not exist.
 */
export async function duplicateWorkflowProject(sourceId: string, overrides: DuplicateWorkflowOverrides = {}) {
  const source = await prisma.workflowProject.findUnique({ where: { id: sourceId } });
  if (!source) return null;

  const storedPages = Array.isArray(source.pages) ? (source.pages as SourcePage[]) : [];
  // A workflow saved before pages existed has only the single canvas.
  const sourcePages: SourcePage[] = storedPages.length
    ? storedPages
    : [{ name: "Page 1", nodes: source.nodes, edges: source.edges, viewport: source.viewport }];

  const nodeIdMap: Record<string, string> = {};
  const edgeIdMap: Record<string, string> = {};
  const pages = sourcePages.map((page, index) => {
    const cloned = cloneGraphWithFreshIds(asNodes(page.nodes), asEdges(page.edges));
    Object.assign(nodeIdMap, cloned.nodeIdMap);
    Object.assign(edgeIdMap, cloned.edgeIdMap);
    return {
      id: `page_${nanoid(8)}`,
      name: typeof page.name === "string" && page.name.trim() ? page.name : `Page ${index + 1}`,
      nodes: cloned.nodes,
      edges: cloned.edges,
      viewport: page.viewport ?? { x: 0, y: 0, zoom: 1 },
    };
  });
  const first = pages[0];
  const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

  const copy = await prisma.workflowProject.create({
    data: {
      clientName: overrides.clientName ?? source.clientName,
      accountId: source.accountId,
      workflowName: overrides.workflowName ?? `${source.workflowName} (Copy)`,
      description: overrides.description ?? source.description,
      templateId: source.templateId,
      diagramStyle: source.diagramStyle,
      numberingScheme: source.numberingScheme,
      look: source.look,
      showFeasibility: source.showFeasibility,
      // The old single-canvas columns always mirror the first page.
      nodes: json(first.nodes),
      edges: json(first.edges),
      viewport: json(first.viewport),
      pages: json(pages),
    },
    select: { id: true },
  });

  return { id: copy.id, pageCount: pages.length, nodeIdMap, edgeIdMap };
}
