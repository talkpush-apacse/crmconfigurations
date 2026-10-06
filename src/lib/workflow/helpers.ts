import type { Edge, Node } from "@xyflow/react";
import { laneNameFor } from "./process-map/lane-mode";
import { moveStepLabel } from "./process-map/inline-text";
import { nanoid } from "@/lib/workflow/ids";
import type { Prisma } from "@/generated/prisma/client";
import { AsyncLocalStorage } from "node:async_hooks";
import { normalizeWorkflowEdgeData as normalizeEdgeData } from "@/lib/workflow/normalize";
import { isActionType, type EndKind, type NoteKind } from "@/lib/workflow/process-map/tokens";
import {
  ACTOR_CONFIG,
  DEFAULT_TABLE_DATA,
  type ActorType,
  type FeasibilityLevel,
  type NodeCustomColor,
  type WorkflowEdgeData,
  type WorkflowNodeData,
  type WorkflowNodeType,
} from "@/lib/workflow/types";

export { normalizeEdgeData };
export type FlowNode = Node<WorkflowNodeData>;
export type FlowEdge = Edge<WorkflowEdgeData>;

export const VALID_NODE_TYPES: WorkflowNodeType[] = [
  "source",
  "stage",
  "decision",
  "communication",
  "integration",
  "parallel",
  "wait",
  "manual_action",
  "table",
  "terminator",
  "jump",
  "note",
];

const VALID_ACTORS: ActorType[] = [
  "automated",
  "manual",
  "integration",
  "candidate",
  "source",
];

const VALID_FEASIBILITY: FeasibilityLevel[] = [
  "confirmed",
  "likely",
  "needs_review",
];

type StoredWorkflow = {
  nodes: unknown;
  edges: unknown;
  viewport: unknown;
  pages: unknown;
};

type StoredPage = {
  id?: string;
  name?: string;
  nodes?: unknown;
  edges?: unknown;
  viewport?: unknown;
};

type WorkflowJsonUpdate = Pick<
  Prisma.WorkflowProjectUpdateInput,
  "nodes" | "edges" | "viewport" | "pages" | "revision"
>;

export function jsonClone<T>(value: T): T {
  return structuredClone(value) as T;
}

export function isWorkflowNodeType(value: unknown): value is WorkflowNodeType {
  return typeof value === "string" && VALID_NODE_TYPES.includes(value as WorkflowNodeType);
}

export function isActorType(value: unknown): value is ActorType {
  return typeof value === "string" && VALID_ACTORS.includes(value as ActorType);
}

export function normalizeFeasibility(value: unknown): FeasibilityLevel {
  return typeof value === "string" && VALID_FEASIBILITY.includes(value as FeasibilityLevel)
    ? (value as FeasibilityLevel)
    : "confirmed";
}

export function normalizeCustomColor(value: unknown): NodeCustomColor | null | undefined {
  if (value === null) return null;
  if (!value || typeof value !== "object") return undefined;
  const color = value as Partial<NodeCustomColor>;
  if (typeof color.background !== "string" || typeof color.border !== "string") {
    return undefined;
  }
  return {
    name: typeof color.name === "string" ? color.name : undefined,
    background: color.background,
    border: color.border,
  };
}

/**
 * Which page of the workflow a tool call is working on. Tools take an optional `page` (a page id, a page name, or a
 * number like "2"); the call dispatcher sets it here for the duration of the call, so every canvas helper below
 * reads and writes the same page without each tool having to pass it along. (AsyncLocalStorage keeps concurrent
 * calls apart.)
 */
export const pageContext = new AsyncLocalStorage<{ page?: string }>();

/** The index of the page a reference points at; the first page when no reference is given. Throws a friendly error if it matches nothing. */
export function resolvePageIndex(pages: StoredPage[], ref?: string | null): number {
  if (!ref || pages.length === 0) return 0;
  const wanted = ref.trim();
  const byId = pages.findIndex((p) => p.id === wanted);
  if (byId >= 0) return byId;
  const byName = pages.findIndex((p) => String(p.name ?? "").trim().toLowerCase() === wanted.toLowerCase());
  if (byName >= 0) return byName;
  if (/^\d+$/.test(wanted) && Number(wanted) >= 1 && Number(wanted) <= pages.length) return Number(wanted) - 1;
  throw new Error(`Page "${ref}" was not found. Use list_pages to see the pages.`);
}

export function getCanvas(workflow: StoredWorkflow) {
  const storedPages = Array.isArray(workflow.pages)
    ? (workflow.pages as StoredPage[])
    : [];
  const pageIndex = resolvePageIndex(storedPages, pageContext.getStore()?.page);
  const firstPage = storedPages[pageIndex] ?? null;
  const nodes = (Array.isArray(firstPage?.nodes)
    ? firstPage?.nodes
    : Array.isArray(workflow.nodes)
    ? workflow.nodes
    : []) as FlowNode[];
  const edges = (Array.isArray(firstPage?.edges)
    ? firstPage?.edges
    : Array.isArray(workflow.edges)
    ? workflow.edges
    : []) as FlowEdge[];
  const viewport =
    firstPage?.viewport ?? workflow.viewport ?? { x: 0, y: 0, zoom: 1 };

  return {
    pageIndex,
    pages: storedPages,
    nodes,
    edges: edges.map((edge) => ({ ...edge, data: normalizeEdgeData(edge.data) })),
    viewport,
  };
}

export function updateFirstPage(
  workflow: StoredWorkflow,
  nodes: FlowNode[],
  edges: FlowEdge[],
  viewport?: unknown
): WorkflowJsonUpdate {
  const current = getCanvas(workflow);
  const nextViewport = viewport ?? current.viewport ?? { x: 0, y: 0, zoom: 1 };
  const pages = [...current.pages];
  const index = current.pageIndex;
  const target = pages[index] ?? {
    id: `page_${nanoid(8)}`,
    name: "Page 1",
  };

  pages[index] = {
    ...target,
    nodes,
    edges,
    viewport: nextViewport,
  };

  // The old single-canvas columns always mirror the FIRST page.
  const first = pages[0] as StoredPage;
  return {
    nodes: jsonClone(index === 0 ? nodes : (first.nodes ?? [])) as unknown as Prisma.InputJsonValue,
    edges: jsonClone(index === 0 ? edges : (first.edges ?? [])) as unknown as Prisma.InputJsonValue,
    viewport: jsonClone(index === 0 ? nextViewport : (first.viewport ?? { x: 0, y: 0, zoom: 1 })) as Prisma.InputJsonValue,
    pages: jsonClone(pages) as Prisma.InputJsonValue,
    // Every canvas change moves the revision on, so anyone editing from an older copy is told about it.
    revision: { increment: 1 },
  };
}

const END_KINDS = ["success", "failure", "neutral", "soft"] as const;
const NOTE_KINDS = ["info", "rejection", "needs_input", "out_of_scope"] as const;

/**
 * The Process Map settings of a step, taken from a tool call and checked. Anything not recognised is dropped, so a
 * typo can never put a strange value on a step. `null` for actionType means "no tag".
 */
export function processMapFields(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (isActionType(raw.actionType)) out.actionType = raw.actionType;
  else if (raw.actionType === null || raw.actionType === "none") out.actionType = null;
  if (typeof raw.personActs === "boolean") out.personActs = raw.personActs;
  if (END_KINDS.includes(raw.endKind as EndKind)) out.endKind = raw.endKind;
  if (NOTE_KINDS.includes(raw.noteKind as NoteKind)) out.noteKind = raw.noteKind;
  if (typeof raw.jumpToNodeId === "string") out.jumpToNodeId = raw.jumpToNodeId;
  if (typeof raw.attachTo === "string" && raw.attachTo) out.attachTo = raw.attachTo;
  if (typeof raw.timing === "string") out.timing = raw.timing.trim().slice(0, 80);
  // Lanes and stages (empty text clears them). `external: true` marks the step's lane as another system.
  if (typeof raw.lane === "string") out.lane = laneNameFor(raw.lane.trim()).slice(0, 60);
  if (typeof raw.stage === "string") out.stage = raw.stage.trim().slice(0, 60);
  if (raw.external === true || raw.laneKind === "external") out.laneKind = "external";
  else if (raw.external === false || raw.laneKind === "") out.laneKind = "";
  if (typeof raw.laneRank === "number" && Number.isFinite(raw.laneRank)) out.laneRank = raw.laneRank;
  if (raw.shapeKind === "display" || raw.shapeKind === "document") out.shapeKind = raw.shapeKind;
  if (typeof raw.internalNotes === "string") out.internalNotes = raw.internalNotes;
  if (raw.visibility === "client" || raw.visibility === "internal") out.visibility = raw.visibility;
  return out;
}

/** A step's label with the Move wording applied when the step is a Move; any other step's label is returned as it is. */
export function moveWordingFor(label: string, actionType: unknown): string {
  return actionType === "move" ? moveStepLabel(label) : label;
}

export function createWorkflowNode(input: {
  type: WorkflowNodeType;
  label: string;
  actor?: ActorType;
  actorLabel?: string;
  notes?: string;
  feasibility?: FeasibilityLevel;
  feasibilityNote?: string;
  customColor?: NodeCustomColor | null;
  data?: WorkflowNodeData["data"];
  position?: { x: number; y: number };
  /** Process Map settings (see processMapFields). */
  extra?: Record<string, unknown>;
}): FlowNode {
  const actorConfig = input.actor ? ACTOR_CONFIG[input.actor] : null;
  const tableData =
    input.type === "table"
      ? (jsonClone(DEFAULT_TABLE_DATA) as typeof DEFAULT_TABLE_DATA)
      : null;
  return {
    id: `node_${nanoid(8)}`,
    type: input.type,
    position: input.position ?? { x: 0, y: 0 },
    data: {
      ...(tableData ?? {}),
      // A Move step always reads "Moves to **Folder name** Folder/Stage".
      label: moveWordingFor(input.label, input.extra?.actionType),
      type: input.type,
      actor: input.type === "table" ? undefined : input.actor,
      actorLabel:
        input.type === "table" ? "" : input.actorLabel ?? actorConfig?.label ?? "",
      notes: input.notes ?? "",
      feasibility: input.feasibility ?? "confirmed",
      feasibilityNote: input.feasibilityNote,
      customColor: input.customColor,
      data: input.data ?? {},
      ...(input.extra ?? {}),
    },
  };
}

export function createWorkflowEdge(input: {
  source: string;
  target: string;
  isHappyPath?: boolean;
  isRecovery?: boolean;
  label?: string;
  recoveryLabel?: string;
  isPrimary?: boolean;
  pathSemantic?: import("@/lib/workflow/types").PathSemantic;
  data?: Partial<WorkflowEdgeData>;
}): FlowEdge {
  const data = normalizeEdgeData({
    ...(input.data ?? {}),
    label: input.label ?? "",
    isHappyPath: input.isHappyPath === true,
    isRecovery: input.isRecovery === true,
    recoveryLabel: input.recoveryLabel,
    isPrimary: input.isPrimary,
    pathSemantic: input.pathSemantic,
  });
  return {
    id: `edge_${nanoid(8)}`,
    source: input.source,
    target: input.target,
    sourceHandle: "bottom",
    targetHandle: "top",
    type: "custom",
    data,
  };
}
