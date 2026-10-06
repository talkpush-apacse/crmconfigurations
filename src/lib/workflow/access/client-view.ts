/**
 * What a client is allowed to receive. Built on the SERVER, so staff-only content is never sent to the
 * browser and merely hidden there (a hidden element can still be read in the page source and network tab).
 *
 * Removed for clients: steps marked internal (and every connector attached to them), `internalNotes`,
 * `visibility`, and, unless staff switched "Show feasibility to clients" on, `feasibility` / `feasibilityNote`.
 * Kept: label, notes, role, action details, layout.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ClientViewOptions {
  showFeasibility: boolean;
}

interface PageLike {
  id: string;
  name: string;
  nodes: any[];
  edges: any[];
  viewport?: unknown;
}

const STAFF_ONLY_NODE_KEYS = ["internalNotes", "visibility"];
const FEASIBILITY_KEYS = ["feasibility", "feasibilityNote"];

export function isInternalNode(node: any): boolean {
  return node?.data?.visibility === "internal";
}

export function projectNodeForClient(node: any, opts: ClientViewOptions): any {
  const data = { ...(node.data ?? {}) };
  for (const key of STAFF_ONLY_NODE_KEYS) delete data[key];
  if (!opts.showFeasibility) for (const key of FEASIBILITY_KEYS) delete data[key];
  return { ...node, data };
}

export function projectPageForClient<P extends PageLike>(page: P, opts: ClientViewOptions): P {
  const hidden = new Set(page.nodes.filter(isInternalNode).map((n) => n.id));
  return {
    ...page,
    nodes: page.nodes.filter((n) => !hidden.has(n.id)).map((n) => projectNodeForClient(n, opts)),
    edges: page.edges.filter((e) => !hidden.has(e.source) && !hidden.has(e.target)),
  };
}

export function projectPagesForClient<P extends PageLike>(pages: P[], opts: ClientViewOptions): P[] {
  return pages.map((p) => projectPageForClient(p, opts));
}

/** The legacy single-canvas fields, projected the same way (they mirror page 1). */
export function projectLegacyCanvasForClient(
  canvas: { nodes: any[]; edges: any[] },
  opts: ClientViewOptions
): { nodes: any[]; edges: any[] } {
  const page = projectPageForClient({ id: "legacy", name: "", nodes: canvas.nodes, edges: canvas.edges }, opts);
  return { nodes: page.nodes, edges: page.edges };
}

// ---- text check: flag internal identifiers before text reaches a client ---------------------------

export interface SanitizationHit {
  where: string;
  rule: "ticket_number" | "internal_id" | "talkpush_subdomain";
  match: string;
}

const RULES: { rule: SanitizationHit["rule"]; pattern: RegExp }[] = [
  { rule: "ticket_number", pattern: /\b[A-Z]{2,10}-\d{2,6}\b/g }, // SE-3685, ENG-120
  { rule: "internal_id", pattern: /\b(?:c[a-z0-9]{24}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/gi }, // cuid / uuid
  { rule: "talkpush_subdomain", pattern: /\b[a-z0-9-]+\.talkpush\.com\b/gi },
];

/** Finds text a person should look at before a client sees it. It only reports; it never deletes or edits. */
export function lintClientText(text: string, where: string): SanitizationHit[] {
  const hits: SanitizationHit[] = [];
  for (const { rule, pattern } of RULES) {
    for (const m of text.matchAll(pattern)) hits.push({ where, rule, match: m[0] });
  }
  return hits;
}

/** Every client-visible text field on the pages, checked. Staff-only fields are not checked (clients never get them). */
export function lintPagesForClient(pages: PageLike[], opts: ClientViewOptions): SanitizationHit[] {
  const hits: SanitizationHit[] = [];
  for (const page of pages) {
    for (const node of projectPageForClient(page, opts).nodes) {
      const label = node.data?.label ?? node.id;
      for (const key of ["label", "notes", "actorLabel", ...(opts.showFeasibility ? ["feasibilityNote"] : [])]) {
        const value = node.data?.[key];
        if (typeof value === "string") hits.push(...lintClientText(value, `${page.name} / ${label} / ${key}`));
      }
    }
    for (const edge of page.edges) {
      const label = edge.data?.label;
      if (typeof label === "string") hits.push(...lintClientText(label, `${page.name} / connector / label`));
    }
  }
  return hits;
}

// ---- the whole client payload ---------------------------------------------------------------------

export interface ClientWorkflowDto {
  id: string;
  clientName: string;
  workflowName: string;
  description: string | null;
  status: string;
  updatedAt: string | Date;
  nodes: any[];
  edges: any[];
  viewport: unknown;
  pages: PageLike[];
  diagramStyle: "classic" | "process_map";
  /** How the diagram is drawn: "original" (every map before the readability pass) or "readable". */
  look: "original" | "readable";
  /** Latest decision only, without the reviewer's name or comment (other reviewers' details are not for clients). */
  feedback: { action: string; createdAt: string | Date }[];
  pinnedVersion: unknown;
}

/**
 * The one place that decides which fields of a workflow leave the server for a client. It builds a NEW object from
 * an allow-list, so a field added to the database later is never sent by accident.
 */
export function buildClientWorkflowDto(
  workflow: {
    id: string;
    clientName: string;
    workflowName: string;
    description: string | null;
    status: string;
    updatedAt: string | Date;
    nodes: unknown;
    edges: unknown;
    viewport: unknown;
    pages: unknown;
    showFeasibility?: boolean;
    diagramStyle?: string;
    look?: string;
  },
  feedback: { action: string; createdAt: string | Date }[],
  pinnedVersion: unknown,
  opts?: Partial<ClientViewOptions>
): ClientWorkflowDto {
  const view: ClientViewOptions = { showFeasibility: opts?.showFeasibility ?? workflow.showFeasibility === true };
  const pages = Array.isArray(workflow.pages) ? (workflow.pages as PageLike[]) : [];
  const legacy = projectLegacyCanvasForClient(
    { nodes: Array.isArray(workflow.nodes) ? (workflow.nodes as any[]) : [], edges: Array.isArray(workflow.edges) ? (workflow.edges as any[]) : [] },
    view
  );
  const latest = feedback[0];
  return {
    id: workflow.id,
    clientName: workflow.clientName,
    workflowName: workflow.workflowName,
    description: workflow.description,
    status: workflow.status,
    updatedAt: workflow.updatedAt,
    nodes: legacy.nodes,
    edges: legacy.edges,
    viewport: workflow.viewport,
    pages: projectPagesForClient(pages, view),
    diagramStyle: workflow.diagramStyle === "process_map" ? "process_map" : "classic",
    look: workflow.look === "readable" ? "readable" : "original",
    feedback: latest ? [{ action: latest.action, createdAt: latest.createdAt }] : [],
    pinnedVersion,
  };
}
