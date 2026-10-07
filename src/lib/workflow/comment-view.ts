import { buildOutline } from "./outline";
import { computeStepNumbers } from "./numbering";
import { computeDecimalNumbers } from "./numbering-decimal";
import { stripInline } from "./process-map/inline-text";

/**
 * Reading comments in context: which step a comment is about, grouped by step and ordered the way the diagram reads.
 * Pure functions, no screen code, so the Review panel and the pins on the diagram agree on the same numbers and names.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export type CommentFilter = "open" | "resolved" | "all";

/** The few fields these helpers need; the real comment has more. */
export interface CommentLike {
  id: string;
  pageId: string;
  nodeId: string | null;
  edgeId: string | null;
  parentId: string | null;
  status: string;
  createdAt: Date | string;
}

/** One page of the workflow, with the step numbers shown on it. */
export interface PageInfo {
  id: string;
  name: string;
  nodes: any[];
  edges: any[];
  stepNumbers: Map<string, string>;
}

export interface CommentThreadData<T> {
  root: T;
  replies: T[];
}

export interface CommentGroup<T> {
  key: string;
  pageId: string;
  pageName: string;
  /** page: not tied to a step. missing: the step, connector or page it pointed to was deleted. */
  kind: "page" | "step" | "connector" | "missing";
  nodeId: string | null;
  edgeId: string | null;
  /** "3a", or "" for a step without a number. */
  number: string;
  title: string;
  /** Threads that pass the filter. */
  threads: CommentThreadData<T>[];
  /** Every thread in the group, whatever the filter says. */
  openCount: number;
  resolvedCount: number;
}

/** The plain-language name of a step, connector or page a comment points at. */
export function describeCommentTarget(pages: PageInfo[], ref: { pageId: string; nodeId: string | null; edgeId: string | null }) {
  const t = targetOf(ref, pages.find((p) => p.id === ref.pageId));
  return { kind: t.kind, title: t.title, pageName: t.pageName };
}

const KIND_RANK = { page: 0, step: 1, connector: 2, missing: 3 } as const;

/** Step numbers for a page, the way the editor shows them for that diagram style. */
export function stepNumbersFor(nodes: any[], edges: any[], isProcessMap: boolean): Map<string, string> {
  return isProcessMap ? computeDecimalNumbers(nodes, edges).stepNumbers : computeStepNumbers(nodes as any, edges as any).stepNumbers;
}

/**
 * Every page with its step numbers. The page being edited uses the live nodes, edges and numbers the editor already
 * has; the other pages are worked out from their saved copy.
 */
export function buildPageInfos(
  pages: { id: string; name: string; nodes: any[]; edges: any[] }[],
  active: { id: string; nodes: any[]; edges: any[]; stepNumbers: Map<string, string> },
  isProcessMap: boolean
): PageInfo[] {
  return pages.map((p) =>
    p.id === active.id
      ? { id: p.id, name: p.name, nodes: active.nodes, edges: active.edges, stepNumbers: active.stepNumbers }
      : { id: p.id, name: p.name, nodes: p.nodes ?? [], edges: p.edges ?? [], stepNumbers: stepNumbersFor(p.nodes ?? [], p.edges ?? [], isProcessMap) }
  );
}

/** How many threads (a comment with its replies) are open, resolved, or either. */
export function countThreads(comments: CommentLike[]): { open: number; resolved: number; all: number } {
  let open = 0;
  let resolved = 0;
  for (const c of comments) {
    if (c.parentId) continue;
    if (c.status === "resolved") resolved++;
    else open++;
  }
  return { open, resolved, all: open + resolved };
}

/** Open threads per step on one page: the numbers shown on the pins. */
export function openCountsByNode(comments: CommentLike[], pageId: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of comments) {
    if (c.parentId || c.status === "resolved" || c.pageId !== pageId || !c.nodeId) continue;
    out.set(c.nodeId, (out.get(c.nodeId) ?? 0) + 1);
  }
  return out;
}

function stepName(page: PageInfo | undefined, nodeId: string): string {
  const node = page?.nodes.find((n) => n.id === nodeId);
  const number = page?.stepNumbers.get(nodeId) ?? "";
  const label = stripInline(String(node?.data?.label ?? "")).trim();
  if (number && label) return `${number} · ${label}`;
  return number || label || "Untitled step";
}

function shortStepName(page: PageInfo | undefined, nodeId: string): string {
  const number = page?.stepNumbers.get(nodeId) ?? "";
  if (number) return number;
  const node = page?.nodes.find((n) => n.id === nodeId);
  return stripInline(String(node?.data?.label ?? "")).trim() || "a step";
}

interface Target {
  key: string;
  kind: CommentGroup<unknown>["kind"];
  nodeId: string | null;
  edgeId: string | null;
  number: string;
  title: string;
  pageName: string;
}

function targetOf(c: Pick<CommentLike, "pageId" | "nodeId" | "edgeId">, page: PageInfo | undefined): Target {
  if (!page) return { key: `${c.pageId}:missing`, kind: "missing", nodeId: null, edgeId: null, number: "", title: "A page that was deleted", pageName: "Deleted page" };
  if (c.nodeId) {
    if (!page.nodes.some((n) => n.id === c.nodeId)) {
      return { key: `${c.pageId}:missing`, kind: "missing", nodeId: null, edgeId: null, number: "", title: "A step that is no longer on the diagram", pageName: page.name };
    }
    return { key: `${c.pageId}:step:${c.nodeId}`, kind: "step", nodeId: c.nodeId, edgeId: null, number: page.stepNumbers.get(c.nodeId) ?? "", title: stepName(page, c.nodeId), pageName: page.name };
  }
  if (c.edgeId) {
    const edge = page.edges.find((e) => e.id === c.edgeId);
    if (!edge) {
      return { key: `${c.pageId}:missing`, kind: "missing", nodeId: null, edgeId: null, number: "", title: "A connector that is no longer on the diagram", pageName: page.name };
    }
    const label = String(edge.data?.label ?? edge.label ?? "").trim();
    const title = `Connector ${shortStepName(page, edge.source)} → ${shortStepName(page, edge.target)}${label ? ` (“${label}”)` : ""}`;
    return { key: `${c.pageId}:edge:${c.edgeId}`, kind: "connector", nodeId: null, edgeId: c.edgeId, number: "", title, pageName: page.name };
  }
  return { key: `${c.pageId}:page`, kind: "page", nodeId: null, edgeId: null, number: "", title: "Whole page", pageName: page.name };
}

/**
 * Comments grouped by what they are about, in reading order: pages in their order; on each page the whole-page
 * comments first, then steps as the outline lists them, then connectors, then comments whose target was deleted.
 */
export function groupComments<T extends CommentLike>(comments: T[], pages: PageInfo[], filter: CommentFilter): CommentGroup<T>[] {
  const replies = new Map<string, T[]>();
  for (const c of comments) if (c.parentId) replies.set(c.parentId, [...(replies.get(c.parentId) ?? []), c]);

  const groups = new Map<string, CommentGroup<T>>();
  for (const root of comments) {
    if (root.parentId) continue;
    const page = pages.find((p) => p.id === root.pageId);
    const t = targetOf(root, page);
    let g = groups.get(t.key);
    if (!g) {
      g = { key: t.key, pageId: root.pageId, pageName: t.pageName, kind: t.kind, nodeId: t.nodeId, edgeId: t.edgeId, number: t.number, title: t.title, threads: [], openCount: 0, resolvedCount: 0 };
      groups.set(t.key, g);
    }
    if (root.status === "resolved") g.resolvedCount++;
    else g.openCount++;
    if (filter === "all" || (filter === "open" ? root.status !== "resolved" : root.status === "resolved")) {
      g.threads.push({ root, replies: replies.get(root.id) ?? [] });
    }
  }

  const pageIndex = (id: string) => {
    const i = pages.findIndex((p) => p.id === id);
    return i === -1 ? pages.length : i;
  };
  const stepIndex = new Map<string, number>();
  for (const p of pages) buildOutline(p.nodes, p.stepNumbers).forEach((item, i) => stepIndex.set(`${p.id}:${item.nodeId}`, i));

  return [...groups.values()]
    .filter((g) => g.threads.length > 0)
    .sort((a, b) => {
      if (pageIndex(a.pageId) !== pageIndex(b.pageId)) return pageIndex(a.pageId) - pageIndex(b.pageId);
      if (KIND_RANK[a.kind] !== KIND_RANK[b.kind]) return KIND_RANK[a.kind] - KIND_RANK[b.kind];
      if (a.kind === "step") return (stepIndex.get(`${a.pageId}:${a.nodeId}`) ?? 0) - (stepIndex.get(`${b.pageId}:${b.nodeId}`) ?? 0);
      return a.title.localeCompare(b.title);
    });
}
