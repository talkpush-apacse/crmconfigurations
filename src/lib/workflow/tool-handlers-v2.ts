import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { applyLayout, layoutDiagram } from "@/lib/workflow/process-map/diagram-layout";
import { lintLayout } from "@/lib/workflow/process-map/lint";
import { buildScene } from "@/lib/workflow/process-map/scene";
import { deriveFlowTable, flowTableCsv } from "@/lib/workflow/process-map/flow-table";
import { chooseLayout, graphFromFlowTable, type FlowRowInput } from "@/lib/workflow/flow-table-import";
import { computeLaneGrid } from "@/lib/workflow/process-map/lanes";
import { assignLanes, stripLanes } from "@/lib/workflow/process-map/lane-edit";
import { runGapCheck, summarizeGaps } from "@/lib/workflow/gap-check";
import { diffPages, type DiffPage } from "@/lib/workflow/diff";
import { describeOps } from "@/lib/workflow/suggestion-overlay";
import { projectPageForClient } from "@/lib/workflow/access/client-view";
import { createScopingArtifact } from "@/lib/workflow/scoping";
import { normalizeWorkflowEdgeData } from "@/lib/workflow/normalize";
import { nanoid } from "@/lib/workflow/ids";
import { pageContext, resolvePageIndex } from "@/lib/workflow/helpers";
import { staffActing, type ActingAs } from "@/lib/workflow/access/actor";
import { ADMIN } from "@/lib/workflow/access/permissions";
import {
  createLink,
  createMember,
  disableLink,
  getAccessOverview,
  linkCreateSchema,
  memberCreateSchema,
  revokeMember,
} from "@/lib/workflow/access/links-service";
import { acceptSuggestion, createSuggestion, listSuggestions, rejectSuggestion } from "@/lib/workflow/access/suggestions-service";
import { listComments } from "@/lib/workflow/access/comments-service";
import { publishVersion } from "@/lib/workflow/access/versions-service";
import { renderSceneSvg } from "@/lib/workflow/render-server";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Args = Record<string, unknown>;
export interface V2Context {
  origin: string;
  actor?: string;
}
export interface V2Helpers {
  createFromSpec: (args: Args, context: V2Context) => Promise<unknown>;
  Input: new (message: string) => Error;
}

const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => str(x)).filter((x): x is string => Boolean(x)) : []);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

async function load(workflowId: unknown, Input: V2Helpers["Input"]) {
  const id = str(workflowId);
  if (!id) throw new Input("workflowId is required");
  const wf = await prisma.workflowProject.findUnique({ where: { id } });
  if (!wf) throw new Input("Workflow not found");
  return wf;
}

/**
 * "Never shared": a draft that nobody outside the team has ever been given a way to see or comment on. Claude may only
 * delete these. The same conditions are used to explain a refusal (sharedEvidence) and to guard the delete itself.
 */
function neverSharedWhere(id: string): Prisma.WorkflowProjectWhereInput {
  return {
    id,
    status: "draft",
    shareToken: null,
    publishedVersionId: null,
    shareVersionId: null,
    generalAccess: "restricted",
    links: { none: {} },
    members: { none: {} },
    comments: { none: {} },
    suggestions: { none: {} },
    accessRequests: { none: {} },
    feedback: { none: {} },
    versions: { none: { status: { not: "draft" } } },
  };
}

async function sharedEvidence(wf: { id: string; status: string; shareToken: string | null; publishedVersionId: string | null; shareVersionId: string | null; generalAccess: string }): Promise<string[]> {
  const [links, members, comments, suggestions, accessRequests, feedback, versions] = await Promise.all([
    prisma.workflowLink.count({ where: { workflowId: wf.id } }),
    prisma.workflowMember.count({ where: { workflowId: wf.id } }),
    prisma.workflowComment.count({ where: { workflowId: wf.id } }),
    prisma.workflowSuggestion.count({ where: { workflowId: wf.id } }),
    prisma.workflowAccessRequest.count({ where: { workflowId: wf.id } }),
    prisma.workflowFeedback.count({ where: { workflowId: wf.id } }),
    prisma.workflowVersion.count({ where: { workflowId: wf.id, status: { not: "draft" } } }),
  ]);
  const out: string[] = [];
  if (wf.status !== "draft") out.push(`its status is "${wf.status}"`);
  if (wf.shareToken || wf.generalAccess !== "restricted") out.push("it has a public link");
  if (links) out.push(`${links} review link${links === 1 ? "" : "s"} created`);
  if (members) out.push(`${members} named ${members === 1 ? "person" : "people"} invited`);
  if (wf.publishedVersionId || wf.shareVersionId || versions) out.push("a version was published or approved");
  if (comments) out.push(`${comments} comment${comments === 1 ? "" : "s"}`);
  if (suggestions) out.push(`${suggestions} suggested change${suggestions === 1 ? "" : "s"}`);
  if (accessRequests) out.push("an access request");
  if (feedback) out.push("client feedback");
  return out;
}

const pagesOf = (wf: { pages: unknown }): any[] => (Array.isArray(wf.pages) ? (wf.pages as any[]) : []);
const staffFor = (context: V2Context): ActingAs => staffActing({ id: "mcp", label: context.actor ?? "Claude (MCP)" }, ADMIN);

/** The page a call is about (see pageContext), as {index, page}. */
function currentPage(wf: { pages: unknown }, ref: unknown) {
  const pages = pagesOf(wf);
  const index = resolvePageIndex(pages, str(ref) ?? pageContext.getStore()?.page);
  return { index, page: pages[index], pages };
}

async function savePages(id: string, pages: any[]) {
  const first = pages[0];
  await prisma.workflowProject.update({
    where: { id },
    data: {
      pages: structuredCloneJson(pages),
      nodes: structuredCloneJson(first?.nodes ?? []),
      edges: structuredCloneJson(first?.edges ?? []),
      viewport: structuredCloneJson(first?.viewport ?? { x: 0, y: 0, zoom: 1 }),
      revision: { increment: 1 },
    },
  });
}
const structuredCloneJson = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

/** Returns undefined when `name` is not one of the version 2 tools. */
export async function callV2Tool(name: string, input: Args, context: V2Context, h: V2Helpers): Promise<unknown | undefined> {
  const Input = h.Input;
  switch (name) {
    // ---------------------------------------------------------------- pages
    case "list_pages": {
      const wf = await load(input.workflowId, Input);
      return { pages: pagesOf(wf).map((p, i) => ({ id: p.id, name: p.name, number: i + 1, steps: (p.nodes ?? []).length, connectors: (p.edges ?? []).length })) };
    }
    case "add_page": {
      const wf = await load(input.workflowId, Input);
      const pages = pagesOf(wf);
      if (pages.length >= 30) throw new Input("A workflow can have at most 30 pages.");
      const page = { id: `page_${nanoid(8)}`, name: str(input.name) ?? `Page ${pages.length + 1}`, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
      await savePages(wf.id, [...pages, page]);
      return { pageId: page.id, name: page.name };
    }
    case "rename_page": {
      const wf = await load(input.workflowId, Input);
      const { index, pages } = currentPage(wf, input.page);
      const name = str(input.name);
      if (!name) throw new Input("name is required");
      pages[index] = { ...pages[index], name };
      await savePages(wf.id, pages);
      return { success: true };
    }
    case "delete_page": {
      const wf = await load(input.workflowId, Input);
      const { index, pages } = currentPage(wf, input.page);
      if (pages.length <= 1) throw new Input("A workflow needs at least one page.");
      const [removed] = pages.splice(index, 1);
      await savePages(wf.id, pages);
      return { success: true, removed: removed.name, note: "A snapshot was taken just before, so this can be undone with restore_version." };
    }

    // ---------------------------------------------------------------- deleting a whole workflow
    case "delete_workflow": {
      const wf = await load(input.workflowId, Input);
      const confirmName = str(input.confirmName);
      if (confirmName !== wf.workflowName) {
        throw new Input(`To delete this workflow, ask the user to confirm its name, then pass confirmName exactly as it is: "${wf.workflowName}".`);
      }
      const blockers = await sharedEvidence(wf);
      if (blockers.length) {
        throw new Input(`This workflow cannot be deleted through Claude because it has been shared or reviewed (${blockers.join("; ")}). Delete it from the workflows list in the staff site instead.`);
      }
      // The same conditions again inside the delete itself, so a link created a moment ago cannot slip past the check above.
      const result = await prisma.workflowProject.deleteMany({ where: neverSharedWhere(wf.id) });
      if (result.count !== 1) throw new Input("The workflow changed while it was being deleted (it may have just been shared), so nothing was deleted. Check it and try again.");
      // The audit trail lives with the workflow and goes with it, so leave one line in the server log.
      console.log(`[workflow-mcp] deleted workflow ${wf.id} ("${wf.workflowName}", client "${wf.clientName}") by ${context.actor ?? "Claude (MCP)"}`);
      return { deleted: true, workflowId: wf.id, workflowName: wf.workflowName, clientName: wf.clientName, note: "Permanently deleted. This cannot be undone." };
    }

    // ---------------------------------------------------------------- connectors
    case "update_edge":
    case "delete_edge": {
      const wf = await load(input.workflowId, Input);
      const { index, pages } = currentPage(wf, input.page);
      const edgeId = str(input.edgeId);
      const edges: any[] = pages[index].edges ?? [];
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge) throw new Input("Connector not found");
      if (name === "delete_edge") {
        pages[index] = { ...pages[index], edges: edges.filter((e) => e.id !== edgeId) };
      } else {
        const data = normalizeWorkflowEdgeData(edge.data);
        const next: any = { ...data };
        if (typeof input.label === "string") next.label = input.label.slice(0, 40);
        if (["happy", "failure", "recovery", "neutral"].includes(String(input.pathSemantic))) {
          next.pathSemantic = input.pathSemantic;
          next.isHappyPath = input.pathSemantic === "happy";
          next.isRecovery = input.pathSemantic === "recovery";
        }
        if (["step", "smoothstep", "straight", "bezier"].includes(String(input.lineType))) next.lineType = input.lineType;
        if (typeof input.isPrimary === "boolean") next.isPrimary = input.isPrimary;
        if (input.resetWaypoints === true) delete next.waypoints;
        pages[index] = { ...pages[index], edges: edges.map((e) => (e.id === edgeId ? { ...e, data: next } : e)) };
      }
      await savePages(wf.id, pages);
      return { success: true };
    }

    // ---------------------------------------------------------------- flow table
    case "get_flow_table": {
      const wf = await load(input.workflowId, Input);
      const { page } = currentPage(wf, input.page);
      const table = deriveFlowTable(page?.nodes ?? [], page?.edges ?? []);
      return { columns: table.columns, rows: table.rows, unusualActors: table.unusualActors, csv: input.format === "csv" ? flowTableCsv(table) : undefined };
    }
    case "create_workflow_from_flow_table": {
      if (input.approved !== true) {
        throw new Input("Show the flow table to the person first and ask whether to build it. Only call this with approved: true after they say yes.");
      }
      const rows = (Array.isArray(input.rows) ? input.rows : []) as FlowRowInput[];
      if (rows.length === 0) throw new Input("rows must list at least one step");
      // Lanes or the single row: asked for, or chosen from the table (3+ actors, an outside system, or stages).
      const choice = chooseLayout(rows, { layout: str(input.layout), externalLanes: strList(input.externalLanes), laneOrder: strList(input.laneOrder) });
      const graph = graphFromFlowTable(rows, choice);
      if (graph.problems.length) throw new Input(`The table cannot be built yet: ${graph.problems.join(" ")}`);
      // One entry shape per channel ("Facebook ad", "Careers page"), each leading to the first step. entryLabel stays for a single one.
      const listed = (Array.isArray(input.entryLabels) ? input.entryLabels : []).map((x: unknown) => str(x)).filter((x: string | undefined): x is string => Boolean(x));
      const entries = listed.length ? listed : [str(input.entryLabel) ?? "Candidate enters"];
      const entryIds = entries.map((_, i) => (i === 0 ? "entry" : `entry${i + 1}`));
      const built = await h.createFromSpec(
        {
          clientName: input.clientName,
          account: input.account,
          workflowName: input.workflowName,
          description: input.description,
          nodes: [...entries.map((label, i) => ({ tempId: entryIds[i], type: "source", label, actor: "source" })), ...graph.nodes],
          edges: [...entryIds.map((id) => ({ sourceTempId: id, targetTempId: graph.nodes[0].tempId })), ...graph.edges],
          artifacts: input.artifacts,
          summary: input.summary,
          diagramStyle: "process_map",
          look: input.look === "original" ? "original" : "readable",
        },
        context
      );
      // Say which layout was used and why, so the person is told.
      return {
        ...(built as Record<string, unknown>),
        layout: choice.layout,
        layoutReason: choice.reason,
        ...(choice.layout === "lanes" ? { lanes: choice.lanes, stages: choice.stages, externalLanes: choice.externalLanes } : {}),
        ...(choice.unusedExternal.length ? { warning: `externalLanes names ${choice.unusedExternal.map((n) => `"${n}"`).join(", ")}, but no step sits in ${choice.unusedExternal.length > 1 ? "those lanes" : "that lane"}, so no outside-system lane is drawn. Add a step in it (what that system does) or drop the name.` } : {}),
      };
    }
    case "propose_changes": {
      const wf = await load(input.workflowId, Input);
      const ops = Array.isArray(input.ops) ? input.ops : [];
      if (ops.length === 0) throw new Input("ops must list at least one change");
      const { page } = currentPage(wf, input.page);
      // Fill in the page id so the caller does not have to know it.
      const withPage = ops.map((o: any) => (o && typeof o === "object" && !("pageId" in o) && !String(o.op).includes("Page") ? { ...o, pageId: page?.id } : o));
      const who: ActingAs = {
        principal: { kind: "link", level: "editor", editMode: "suggest_only", canApprove: false, canComment: true, canAcceptSuggestions: false },
        identity: { displayName: context.actor ?? "Claude (MCP)", verified: true },
      };
      const s = await createSuggestion(wf.id, who, { baseRevision: wf.revision, ops: withPage, summary: str(input.summary) });
      return { suggestionId: s.id, status: s.status, inPlainLanguage: describeOps(withPage), message: "Nothing on the diagram changed. The owner can accept or reject this in Review." };
    }

    // ---------------------------------------------------------------- quality
    case "run_gap_check": {
      const wf = await load(input.workflowId, Input);
      const { page } = currentPage(wf, input.page);
      const findings = runGapCheck(page?.nodes ?? [], page?.edges ?? []);
      let saved = 0;
      if (input.saveAsArtifacts === true) {
        for (const f of findings) {
          await createScopingArtifact(wf.id, {
            kind: f.tier === "blocker" ? "risk" : f.tier === "assumption" ? "assumption" : "open_question",
            title: f.message.slice(0, 120),
            detail: f.assumption ?? f.message,
            status: "open",
            severity: f.tier === "blocker" ? "high" : f.tier === "assumption" ? "medium" : "low",
            source: "validation",
            metadata: { code: f.code, group: f.group, confidence: f.confidence },
          });
          saved += 1;
        }
      }
      return { summary: summarizeGaps(findings), findings, savedAsArtifacts: saved, note: "Blockers: list them and stop. Assumptions: state what you assumed. Never put these in a diagram shape." };
    }
    case "lint_layout":
    case "render_preview": {
      const wf = await load(input.workflowId, Input);
      if (wf.diagramStyle !== "process_map") throw new Input("This workflow uses the Classic style. Switch it with set_diagram_style first.");
      const { page } = currentPage(wf, input.page);
      const client = name === "render_preview" && input.audience === "client";
      const view = client ? projectPageForClient({ id: page.id, name: page.name, nodes: page.nodes ?? [], edges: page.edges ?? [] }, { showFeasibility: wf.showFeasibility }) : page;
      const scene = buildScene(view.nodes ?? [], view.edges ?? [], { clientName: wf.clientName, workflowName: wf.workflowName, versionLabel: wf.currentVersion ? `v${wf.currentVersion}` : "Draft", date: new Date().toISOString().slice(0, 10), author: "Talkpush", look: wf.look });
      const findings = lintLayout(scene);
      if (name === "lint_layout") return { findings, counts: { high: findings.filter((f) => f.severity === "high").length, medium: findings.filter((f) => f.severity === "medium").length, low: findings.filter((f) => f.severity === "low").length } };
      if (input.format === "png") throw new Input("PNG previews need a rendering library that has not been approved yet. Use format \"svg\" (it is the exact drawing a client sees) and read the layout findings.");
      return { format: "svg", audience: client ? "client" : "internal", width: Math.round(scene.bounds.w), height: Math.round(scene.bounds.h), svg: renderSceneSvg(scene), layoutFindings: findings, note: "Never trust a success message: look at the drawing and the findings after every change." };
    }

    // ---------------------------------------------------------------- versions and style
    case "diff_versions": {
      const wf = await load(input.workflowId, Input);
      const pick = async (ref: unknown): Promise<DiffPage[]> => {
        const r = String(ref ?? "current");
        if (r === "current") return pagesOf(wf);
        const v = await prisma.workflowVersion.findFirst({
          where: { workflowId: wf.id, ...(/^\d+$/.test(r) ? { versionNumber: Number(r) } : { id: r }) },
        });
        if (!v) throw new Input(`Version ${r} not found. Use list_versions.`);
        return (Array.isArray(v.pages) ? v.pages : [{ id: "page_1", name: "Page 1", nodes: v.nodes, edges: v.edges }]) as DiffPage[];
      };
      const d = diffPages(await pick(input.a), await pick(input.b ?? "current"));
      return { identical: d.identical, inPlainLanguage: d.lines, added: d.added, removed: d.removed, changed: d.changed, moved: d.moved };
    }
    case "publish_version": {
      const wf = await load(input.workflowId, Input);
      const v = await publishVersion(wf.id, { id: "mcp", label: context.actor ?? "Claude (MCP)" }, str(input.label));
      return { versionId: v.id, versionNumber: v.versionNumber, message: "Clients with a link now see this version by default." };
    }
    case "set_diagram_layout": {
      const wf = await load(input.workflowId, Input);
      if (wf.diagramStyle !== "process_map") throw new Input("Lanes and the single-row layout belong to the Process Map style. Switch with set_diagram_style first.");
      const want = input.layout === "lanes" ? "lanes" : input.layout === "spine" ? "spine" : null;
      if (!want) throw new Input('layout must be "lanes" or "spine".');
      const { index, pages } = currentPage(wf, input.page);
      const page = pages[index];
      const switched = want === "lanes" ? assignLanes(page.nodes ?? [], strList(input.externalLanes)) : stripLanes(page.nodes ?? []);
      const nodes = switched.nodes;
      const touched = switched.touched;
      const laid = applyLayout(nodes, page.edges ?? [], layoutDiagram(nodes, page.edges ?? [], wf.look));
      pages[index] = { ...page, nodes: laid.nodes, edges: laid.edges };
      await savePages(wf.id, pages);
      const grid = want === "lanes" ? computeLaneGrid(laid.nodes, laid.edges) : null;
      return {
        layout: want,
        stepsUpdated: touched,
        ...(grid ? { lanes: grid.laneOrder, stages: grid.stages.map((s) => s.title).filter(Boolean), externalLanes: grid.laneOrder.filter((l) => grid.externalLanes.has(l.toLowerCase())) } : {}),
        note: want === "lanes"
          ? "Each step without a lane took one from its role. A snapshot was taken just before this change."
          : "Lanes and stages were removed from the steps and the map is back to a single row. A snapshot was taken just before this change; restore_version brings the lanes back.",
      };
    }
    case "set_diagram_style": {
      const wf = await load(input.workflowId, Input);
      const style = input.style === "classic" ? "classic" : "process_map";
      const pages = pagesOf(wf).map((p) => {
        if (style !== "process_map") return p;
        const laid = applyLayout(p.nodes ?? [], p.edges ?? [], layoutDiagram(p.nodes ?? [], p.edges ?? [], wf.look));
        return { ...p, nodes: laid.nodes, edges: laid.edges };
      });
      const first = pages[0];
      await prisma.workflowProject.update({
        where: { id: wf.id },
        data: {
          diagramStyle: style,
          numberingScheme: style === "process_map" ? "decimal" : "letters",
          pages: structuredCloneJson(pages),
          nodes: structuredCloneJson(first?.nodes ?? []),
          edges: structuredCloneJson(first?.edges ?? []),
          revision: { increment: 1 },
        },
      });
      return { style, arranged: style === "process_map", note: "A snapshot was taken just before this change." };
    }

    case "set_diagram_look": {
      const wf = await load(input.workflowId, Input);
      if (input.look !== "original" && input.look !== "readable") throw new Input('look must be "original" or "readable".');
      if (wf.diagramStyle !== "process_map") throw new Input("The look belongs to the Process Map style. Switch with set_diagram_style first.");
      // Sizes change with the look, so every page is arranged again in the new look.
      const pages = pagesOf(wf).map((p) => {
        const laid = applyLayout(p.nodes ?? [], p.edges ?? [], layoutDiagram(p.nodes ?? [], p.edges ?? [], String(input.look)));
        return { ...p, nodes: laid.nodes, edges: laid.edges };
      });
      const first = pages[0];
      await prisma.workflowProject.update({
        where: { id: wf.id },
        data: { look: input.look, pages: structuredCloneJson(pages), nodes: structuredCloneJson(first?.nodes ?? []), edges: structuredCloneJson(first?.edges ?? []), revision: { increment: 1 } },
      });
      return { look: input.look, note: "Every page was arranged again for the new look. A snapshot was taken just before this change; restore_version brings back the earlier arrangement." };
    }

    // ---------------------------------------------------------------- sharing and review (explicit instruction only)
    case "list_access": {
      const wf = await load(input.workflowId, Input);
      return getAccessOverview(wf.id);
    }
    case "create_link": {
      const wf = await load(input.workflowId, Input);
      const parsed = linkCreateSchema.parse({ level: input.level, editMode: input.editMode, canApprove: input.canApprove, passcode: input.passcode ?? undefined, expiresAt: input.expiresAt });
      const link = await createLink(wf.id, "mcp", parsed);
      return { level: link.level, editMode: link.editMode, expiresAt: link.expiresAt, url: `${context.origin}/w/${link.token}`, note: "Give this address to the person to copy and send themselves. It is shown once; a new call replaces it and the old address stops working." };
    }
    case "disable_link": {
      const wf = await load(input.workflowId, Input);
      await disableLink(wf.id, "mcp", String(input.linkId));
      return { success: true };
    }
    case "invite_person": {
      const wf = await load(input.workflowId, Input);
      const parsed = memberCreateSchema.parse({ displayName: input.displayName, email: input.email, level: input.level, editMode: input.editMode, canApprove: input.canApprove, canComment: input.canComment, canAcceptSuggestions: input.canAcceptSuggestions, expiresAt: input.expiresAt });
      const m = await createMember(wf.id, "mcp", parsed);
      return { personId: m.id, displayName: m.displayName, level: m.level, url: `${context.origin}/w/${m.token}`, note: "Nothing is emailed. The owner copies this address and sends it." };
    }
    case "revoke_person": {
      const wf = await load(input.workflowId, Input);
      await revokeMember(wf.id, "mcp", String(input.personId));
      return { success: true };
    }
    case "list_suggestions": {
      const wf = await load(input.workflowId, Input);
      const statuses = input.status ? [String(input.status)] : ["pending", "stale"];
      return { items: await listSuggestions(wf.id, staffFor(context), statuses) };
    }
    case "accept_suggestion":
    case "reject_suggestion": {
      const wf = await load(input.workflowId, Input);
      const who = staffFor(context);
      const id = String(input.suggestionId);
      return name === "accept_suggestion" ? acceptSuggestion(wf.id, id, who) : rejectSuggestion(wf.id, id, who);
    }
    case "list_comments": {
      const wf = await load(input.workflowId, Input);
      const all = await listComments(wf.id, staffFor(context));
      return { items: input.status ? all.filter((c) => c.status === input.status) : all };
    }
    default:
      return undefined;
  }
}

export const V2_TOOL_NAMES = [
  "list_pages", "add_page", "rename_page", "delete_page", "update_edge", "delete_edge", "get_flow_table",
  "create_workflow_from_flow_table", "propose_changes", "run_gap_check", "lint_layout", "render_preview", "diff_versions",
  "publish_version", "set_diagram_style", "list_access", "create_link", "disable_link", "invite_person", "revoke_person",
  "list_suggestions", "accept_suggestion", "reject_suggestion", "list_comments", "delete_workflow", "set_diagram_layout", "set_diagram_look",
] as const;
