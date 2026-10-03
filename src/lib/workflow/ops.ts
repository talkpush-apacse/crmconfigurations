/**
 * Changes to a workflow, as a list of small "ops". Both a direct save and a suggestion (suggest-then-accept)
 * use this same list, so the two can never disagree about what a change means.
 *
 * The rule that matters most (spec 12.6.3): a client-side editor never receives staff-only steps or fields.
 * If it saved the whole canvas, it would delete them. So clients send ops, and the SERVER applies them to the
 * FULL canvas, refusing any op that touches a hidden step or a protected field. `applyOps` is a pure function
 * (no database) so that rule is easy to test.
 */

import { sanitizeText } from "./text";
import type { Principal } from "./access/permissions";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface OpPage {
  id: string;
  name: string;
  nodes: any[];
  edges: any[];
  viewport?: unknown;
}

export type Position = { x: number; y: number };

export type WorkflowOp =
  | { op: "addNode"; pageId: string; node: any }
  | { op: "updateNode"; pageId: string; nodeId: string; patch: Record<string, any> }
  | { op: "moveNode"; pageId: string; nodeId: string; position: Position }
  | { op: "deleteNode"; pageId: string; nodeId: string }
  | { op: "addEdge"; pageId: string; edge: any }
  | { op: "updateEdge"; pageId: string; edgeId: string; patch: Record<string, any> }
  | { op: "deleteEdge"; pageId: string; edgeId: string }
  | { op: "addPage"; page: { id: string; name: string } }
  | { op: "renamePage"; pageId: string; name: string }
  | { op: "deletePage"; pageId: string };

export const MAX_OPS_PER_REQUEST = 500;
export const MAX_NODES_PER_PAGE = 500;
export const MAX_PAGES = 30;

/** Fields only staff may set or change. */
export const PROTECTED_NODE_FIELDS = ["internalNotes", "visibility", "feasibility", "feasibilityNote", "customColor"] as const;
export const PROTECTED_EDGE_FIELDS = ["isPrimary"] as const;

export type OpErrorCode = "invalid" | "forbidden" | "not_found" | "limit";

export class OpError extends Error {
  constructor(
    public readonly code: OpErrorCode,
    message: string,
    public readonly opIndex: number
  ) {
    super(message);
    this.name = "OpError";
  }
}

const isStaff = (p: Principal) => p.level === "admin";
const isInternal = (node: any) => node?.data?.visibility === "internal";

function clean(value: unknown): unknown {
  return typeof value === "string" ? sanitizeText(value) : value;
}

function cleanNodeData(data: Record<string, any>): Record<string, any> {
  const out = { ...data };
  for (const key of ["label", "notes", "actorLabel", "internalNotes", "feasibilityNote"]) {
    if (key in out) out[key] = clean(out[key]);
  }
  return out;
}

function assertNoProtected(fields: Record<string, any>, protectedList: readonly string[], index: number, what: string) {
  for (const key of protectedList) {
    if (key in fields) throw new OpError("forbidden", `Only staff can change "${key}" on ${what}.`, index);
  }
}

function findPage(pages: OpPage[], pageId: string, index: number): OpPage {
  const page = pages.find((p) => p.id === pageId);
  if (!page) throw new OpError("not_found", `Page ${pageId} was not found.`, index);
  return page;
}

function findNode(page: OpPage, nodeId: string, principal: Principal, index: number): any {
  const node = page.nodes.find((n) => n.id === nodeId);
  // For a client the hidden steps do not exist at all: same answer as a step that was never there.
  if (!node || (!isStaff(principal) && isInternal(node))) throw new OpError("not_found", `Step ${nodeId} was not found.`, index);
  return node;
}

/** Returns a new pages array; the input is not modified. Throws OpError on the first op that is not allowed. */
export function applyOps(inputPages: OpPage[], ops: WorkflowOp[], principal: Principal): OpPage[] {
  if (ops.length > MAX_OPS_PER_REQUEST) throw new OpError("limit", `At most ${MAX_OPS_PER_REQUEST} changes per save.`, 0);
  const pages: OpPage[] = structuredClone(inputPages);

  ops.forEach((op, i) => {
    switch (op.op) {
      case "addNode": {
        const page = findPage(pages, op.pageId, i);
        if (!op.node?.id || typeof op.node.id !== "string") throw new OpError("invalid", "A new step needs an id.", i);
        if (page.nodes.some((n) => n.id === op.node.id)) throw new OpError("invalid", `Step id ${op.node.id} already exists.`, i);
        if (page.nodes.length >= MAX_NODES_PER_PAGE) throw new OpError("limit", `A page can hold at most ${MAX_NODES_PER_PAGE} steps.`, i);
        const node = structuredClone(op.node);
        node.data = cleanNodeData(node.data ?? {});
        if (!isStaff(principal)) assertNoProtected(node.data, PROTECTED_NODE_FIELDS, i, "a step");
        page.nodes.push(node);
        break;
      }
      case "updateNode": {
        const page = findPage(pages, op.pageId, i);
        const node = findNode(page, op.nodeId, principal, i);
        const patch = op.patch ?? {};
        const { position, style, ...dataPatch } = patch;
        if (!isStaff(principal)) assertNoProtected(dataPatch, PROTECTED_NODE_FIELDS, i, "a step");
        if (position) node.position = position;
        if (style) node.style = { ...(node.style ?? {}), ...style };
        node.data = { ...node.data, ...cleanNodeData(dataPatch) };
        break;
      }
      case "moveNode": {
        const page = findPage(pages, op.pageId, i);
        const node = findNode(page, op.nodeId, principal, i);
        node.position = op.position;
        break;
      }
      case "deleteNode": {
        const page = findPage(pages, op.pageId, i);
        findNode(page, op.nodeId, principal, i);
        page.nodes = page.nodes.filter((n) => n.id !== op.nodeId);
        // Connectors attached to the removed step go with it (hidden steps themselves are never touched).
        page.edges = page.edges.filter((e) => e.source !== op.nodeId && e.target !== op.nodeId);
        break;
      }
      case "addEdge": {
        const page = findPage(pages, op.pageId, i);
        const edge = structuredClone(op.edge);
        if (!edge?.id || !edge.source || !edge.target) throw new OpError("invalid", "A connector needs an id, a source and a target.", i);
        if (page.edges.some((e) => e.id === edge.id)) throw new OpError("invalid", `Connector id ${edge.id} already exists.`, i);
        findNode(page, edge.source, principal, i);
        findNode(page, edge.target, principal, i);
        edge.data = { ...(edge.data ?? {}) };
        if ("label" in edge.data) edge.data.label = clean(edge.data.label);
        if (!isStaff(principal)) assertNoProtected(edge.data, PROTECTED_EDGE_FIELDS, i, "a connector");
        page.edges.push(edge);
        break;
      }
      case "updateEdge": {
        const page = findPage(pages, op.pageId, i);
        const edge = page.edges.find((e) => e.id === op.edgeId);
        if (!edge) throw new OpError("not_found", `Connector ${op.edgeId} was not found.`, i);
        findNode(page, edge.source, principal, i); // a connector to a hidden step is hidden too
        findNode(page, edge.target, principal, i);
        const patch = { ...(op.patch ?? {}) };
        if (!isStaff(principal)) assertNoProtected(patch, PROTECTED_EDGE_FIELDS, i, "a connector");
        if ("label" in patch) patch.label = clean(patch.label);
        edge.data = { ...(edge.data ?? {}), ...patch };
        break;
      }
      case "deleteEdge": {
        const page = findPage(pages, op.pageId, i);
        const edge = page.edges.find((e) => e.id === op.edgeId);
        if (!edge) throw new OpError("not_found", `Connector ${op.edgeId} was not found.`, i);
        findNode(page, edge.source, principal, i);
        findNode(page, edge.target, principal, i);
        page.edges = page.edges.filter((e) => e.id !== op.edgeId);
        break;
      }
      case "addPage": {
        if (pages.length >= MAX_PAGES) throw new OpError("limit", `A workflow can have at most ${MAX_PAGES} pages.`, i);
        if (!op.page?.id || pages.some((p) => p.id === op.page.id)) throw new OpError("invalid", "A new page needs a unique id.", i);
        pages.push({ id: op.page.id, name: sanitizeText(op.page.name || `Page ${pages.length + 1}`), nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } });
        break;
      }
      case "renamePage": {
        findPage(pages, op.pageId, i).name = sanitizeText(op.name);
        break;
      }
      case "deletePage": {
        const page = findPage(pages, op.pageId, i);
        if (pages.length <= 1) throw new OpError("invalid", "A workflow needs at least one page.", i);
        // Deleting a page would also delete any staff-only steps on it, which a client must never be able to do.
        if (!isStaff(principal) && page.nodes.some(isInternal)) throw new OpError("forbidden", "This page cannot be deleted.", i);
        pages.splice(pages.indexOf(page), 1);
        break;
      }
      default:
        throw new OpError("invalid", `Unknown change type.`, i);
    }
  });
  return pages;
}

/** The pages with legacy-column mirrors ready to save: the first page is copied into nodes/edges/viewport. */
export function mirrorFirstPage(pages: OpPage[]) {
  const first = pages[0];
  return {
    nodes: first?.nodes ?? [],
    edges: first?.edges ?? [],
    viewport: (first?.viewport as object | undefined) ?? { x: 0, y: 0, zoom: 1 },
  };
}
