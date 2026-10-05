import { prisma } from "@/lib/db";
import { badRequest, notFound } from "@/lib/tracker/errors";
import { matchByName } from "@/lib/tracker/match";
import { buildConfigPlan } from "./build";
import { renderPlanMarkdown } from "./markdown";
import { readChecklist, type ChecklistInput } from "./from-checklist";
import { readWorkflow } from "./from-workflow";
import { normalizeName } from "./names";
import type { ConfigPlan } from "./types";

/**
 * Loads a checklist and a workflow and builds the plan. Reads only; nothing here writes.
 * Every query names its columns. adminSettings (it holds telephony credentials) is deliberately never selected.
 */

export type PlanVersion = "published" | "current";

const CHECKLIST_SELECT = {
  id: true,
  slug: true,
  clientName: true,
  version: true,
  attributes: true,
  labels: true,
  folders: true,
  documents: true,
  messaging: true,
  prescreening: true,
  autoflows: true,
  campaigns: true,
  sites: true,
  users: true,
  sources: true,
  rejectionReasons: true,
  integrations: true,
  atsIntegrations: true,
  fbWhatsapp: true,
  aiCallFaqs: true,
  companyInfo: true,
  communicationChannels: true,
} as const;

async function resolveWorkflow(ref: string) {
  const wanted = ref.trim();
  const byId = await prisma.workflowProject.findUnique({
    where: { id: wanted },
    select: { id: true, clientName: true, workflowName: true, pages: true, nodes: true, edges: true, publishedVersionId: true },
  });
  if (byId) return byId;
  const all = await prisma.workflowProject.findMany({ select: { id: true, clientName: true, workflowName: true }, orderBy: { updatedAt: "desc" }, take: 500 });
  const match = matchByName(all, wanted, (w) => `${w.clientName}: ${w.workflowName}`);
  if (match.kind === "one") {
    return prisma.workflowProject.findUniqueOrThrow({
      where: { id: match.value.id },
      select: { id: true, clientName: true, workflowName: true, pages: true, nodes: true, edges: true, publishedVersionId: true },
    });
  }
  if (match.kind === "many") {
    throw badRequest(`More than one workflow matches "${ref}": ${match.candidates.slice(0, 6).map((w) => `${w.clientName}: ${w.workflowName} (${w.id})`).join("; ")}. Use the id.`);
  }
  throw notFound(`Workflow "${ref}"`);
}

export async function loadConfigPlan(opts: { checklist: string; workflow?: string | null; version?: PlanVersion | null }): Promise<ConfigPlan> {
  const ref = opts.checklist.trim();
  if (!ref) throw badRequest("Say which checklist (its slug or id).");
  const checklist = await prisma.checklist.findFirst({ where: { OR: [{ slug: ref }, { id: ref }] }, select: CHECKLIST_SELECT });
  if (!checklist) throw notFound(`Checklist "${ref}"`);

  const warnings: string[] = [];
  let workflowFindings = null;
  let workflowMeta: ConfigPlan["workflow"] = null;

  if (opts.workflow && opts.workflow.trim()) {
    const wf = await resolveWorkflow(opts.workflow);
    let source: { pages: unknown; nodes: unknown; edges: unknown } = wf;
    let used: PlanVersion = "current";
    const wantsCurrent = opts.version === "current";
    if (!wantsCurrent) {
      if (wf.publishedVersionId) {
        const version = await prisma.workflowVersion.findUnique({
          where: { id: wf.publishedVersionId },
          select: { pages: true, nodes: true, edges: true },
        });
        if (version) {
          source = version;
          used = "published";
        }
      }
      if (used !== "published") warnings.push("This workflow has no published version, so the plan uses the current draft. It may not be the version the client signed off.");
    }
    workflowFindings = readWorkflow(source);
    workflowMeta = { id: wf.id, name: wf.workflowName, version: used, stepCount: workflowFindings.stepCount };
    if (normalizeName(wf.clientName) !== normalizeName(checklist.clientName)) {
      warnings.push(`The workflow is for "${wf.clientName}" but the checklist is for "${checklist.clientName}". Check you picked the right pair.`);
    }
    if (workflowFindings.stepCount === 0) warnings.push("The workflow has no readable steps.");
  }

  return buildConfigPlan({
    checklist: readChecklist(checklist as unknown as ChecklistInput),
    workflow: workflowFindings,
    meta: {
      client: checklist.clientName,
      checklist: { slug: checklist.slug, clientName: checklist.clientName, version: checklist.version },
      workflow: workflowMeta,
      warnings,
    },
  });
}

/** Workflows that look like they belong to this client, for the screen's picker. */
export async function workflowsForClient(clientName: string) {
  const rows = await prisma.workflowProject.findMany({
    where: { clientName: { equals: clientName, mode: "insensitive" } },
    select: { id: true, workflowName: true, status: true, publishedVersionId: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows.map((r) => ({ id: r.id, name: r.workflowName, status: r.status, published: r.publishedVersionId !== null, updatedAt: r.updatedAt.toISOString() }));
}

/**
 * The plan for a tracker project: its linked checklist, plus the workflow the person picked. When nothing is
 * picked and the client has exactly one workflow, that one is used; otherwise the plan is checklist-only and the
 * candidates are returned so the screen can offer a choice.
 */
export async function getProjectConfigPlan(projectId: string, opts: { workflow?: string | null; version?: PlanVersion | null } = {}) {
  const project = await prisma.trackerProject.findUnique({ where: { id: projectId }, select: { id: true, checklistId: true } });
  if (!project) throw notFound("Project");
  if (!project.checklistId) throw badRequest("This project is not linked to a CRM checklist yet. Link one in the project's settings.");
  const checklist = await prisma.checklist.findUnique({ where: { id: project.checklistId }, select: { id: true, clientName: true } });
  if (!checklist) throw notFound("The linked checklist");

  const candidates = await workflowsForClient(checklist.clientName);
  const chosen = opts.workflow?.trim() ? opts.workflow.trim() : candidates.length === 1 ? candidates[0].id : null;
  const plan = await loadConfigPlan({ checklist: checklist.id, workflow: chosen, version: opts.version });
  return { plan, markdown: renderPlanMarkdown(plan), candidates, selectedWorkflowId: plan.workflow?.id ?? null };
}
