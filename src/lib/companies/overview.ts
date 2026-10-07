import { prisma } from "@/lib/db";
import { getChecklistProgress, type ChecklistProgressSummary } from "@/lib/section-status";
import type { ChecklistData } from "@/lib/types";
import { serializeAccount } from "@/lib/tracker/serialize";
import { notFound } from "@/lib/tracker/errors";
import { groupUnassigned, type UnassignedGroup } from "./unassigned";
import type { CompanyAttention, CompanyCardData } from "./gallery";

/**
 * What the company screens read: the gallery of companies, one company's checklists and workflows, and the
 * "needs a company" holding area. Read-only; filing something under a company is src/lib/accounts/company-link.ts.
 */

const NO_ATTENTION: CompanyAttention = { openComments: 0, pendingSuggestions: 0, openRequests: 0 };

/** Open comments, waiting suggestions and access requests for each of these workflows. */
export async function workflowAttention(workflowIds: string[]): Promise<Map<string, CompanyAttention>> {
  const out = new Map<string, CompanyAttention>();
  if (workflowIds.length === 0) return out;
  const [comments, suggestions, requests] = await Promise.all([
    prisma.workflowComment.groupBy({ by: ["workflowId"], where: { workflowId: { in: workflowIds }, status: "open", parentId: null }, _count: { _all: true } }),
    prisma.workflowSuggestion.groupBy({ by: ["workflowId"], where: { workflowId: { in: workflowIds }, status: "pending" }, _count: { _all: true } }),
    prisma.workflowAccessRequest.groupBy({ by: ["workflowId"], where: { workflowId: { in: workflowIds }, status: "open" }, _count: { _all: true } }),
  ]);
  const slot = (id: string) => {
    let a = out.get(id);
    if (!a) {
      a = { ...NO_ATTENTION };
      out.set(id, a);
    }
    return a;
  };
  for (const r of comments) slot(r.workflowId).openComments = r._count._all;
  for (const r of suggestions) slot(r.workflowId).pendingSuggestions = r._count._all;
  for (const r of requests) slot(r.workflowId).openRequests = r._count._all;
  return out;
}

const latest = (...dates: (Date | null | undefined)[]) => dates.filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0];

export async function listCompanies(): Promise<{ companies: CompanyCardData[]; unassigned: { checklists: number; workflows: number } }> {
  const [accounts, checklistGroups, workflowGroups, projectGroups, linkedWorkflows] = await Promise.all([
    prisma.trackerAccount.findMany({ where: { archived: false }, select: { id: true, name: true, slug: true, notes: true, updatedAt: true } }),
    prisma.checklist.groupBy({ by: ["accountId"], _count: { _all: true }, _max: { updatedAt: true } }),
    prisma.workflowProject.groupBy({ by: ["accountId"], _count: { _all: true }, _max: { updatedAt: true } }),
    prisma.trackerProject.groupBy({ by: ["accountId"], where: { archived: false }, _count: { _all: true }, _max: { updatedAt: true } }),
    prisma.workflowProject.findMany({ where: { accountId: { not: null } }, select: { id: true, accountId: true } }),
  ]);

  const attention = await workflowAttention(linkedWorkflows.map((w) => w.id));
  const perAccount = new Map<string, CompanyAttention>();
  for (const w of linkedWorkflows) {
    const a = attention.get(w.id);
    if (!a || !w.accountId) continue;
    const sum = perAccount.get(w.accountId) ?? { ...NO_ATTENTION };
    sum.openComments += a.openComments;
    sum.pendingSuggestions += a.pendingSuggestions;
    sum.openRequests += a.openRequests;
    perAccount.set(w.accountId, sum);
  }

  const by = <T extends { accountId: string | null }>(rows: T[]) => new Map(rows.filter((r) => r.accountId).map((r) => [r.accountId as string, r]));
  const checklists = by(checklistGroups);
  const workflows = by(workflowGroups);
  const projects = by(projectGroups);

  const companies: CompanyCardData[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    slug: a.slug,
    notes: a.notes,
    checklistCount: checklists.get(a.id)?._count._all ?? 0,
    workflowCount: workflows.get(a.id)?._count._all ?? 0,
    projectCount: projects.get(a.id)?._count._all ?? 0,
    attention: perAccount.get(a.id) ?? { ...NO_ATTENTION },
    lastActivityAt: (latest(a.updatedAt, checklists.get(a.id)?._max.updatedAt, workflows.get(a.id)?._max.updatedAt, projects.get(a.id)?._max.updatedAt) ?? a.updatedAt).toISOString(),
  }));

  return {
    companies,
    unassigned: {
      checklists: checklistGroups.find((g) => g.accountId === null)?._count._all ?? 0,
      workflows: workflowGroups.find((g) => g.accountId === null)?._count._all ?? 0,
    },
  };
}

export interface CompanyChecklistItem {
  id: string;
  slug: string;
  clientName: string;
  updatedAt: string;
  completionSummary: ChecklistProgressSummary;
}

export interface CompanyWorkflowItem {
  id: string;
  clientName: string;
  workflowName: string;
  status: string;
  currentVersion: number;
  updatedAt: string;
  attention: CompanyAttention;
}

export async function getCompany(id: string) {
  const account = await prisma.trackerAccount.findUnique({ where: { id } });
  if (!account) throw notFound("Company");
  const [checklistRows, workflowRows] = await Promise.all([
    prisma.checklist.findMany({ where: { accountId: id }, orderBy: { updatedAt: "desc" } }),
    prisma.workflowProject.findMany({
      where: { accountId: id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, clientName: true, workflowName: true, status: true, currentVersion: true, updatedAt: true },
    }),
  ]);
  const attention = await workflowAttention(workflowRows.map((w) => w.id));
  const contacts = await prisma.trackerPerson.count({ where: { accountId: id, archived: false } });

  const checklists: CompanyChecklistItem[] = checklistRows.map((c) => ({
    id: c.id,
    slug: c.slug,
    clientName: c.clientName,
    updatedAt: c.updatedAt.toISOString(),
    completionSummary: getChecklistProgress(c as unknown as ChecklistData, { includeAdminTabs: true }),
  }));
  const workflows: CompanyWorkflowItem[] = workflowRows.map((w) => ({
    id: w.id,
    clientName: w.clientName,
    workflowName: w.workflowName,
    status: w.status,
    currentVersion: w.currentVersion,
    updatedAt: w.updatedAt.toISOString(),
    attention: attention.get(w.id) ?? { ...NO_ATTENTION },
  }));
  return { company: serializeAccount(account), contacts, checklists, workflows };
}

/** Everything not filed under a company yet, grouped by the client name typed on it. */
export async function getUnassigned(): Promise<{ groups: UnassignedGroup[]; accounts: { id: string; name: string }[] }> {
  const [checklists, workflows, accounts] = await Promise.all([
    prisma.checklist.findMany({ where: { accountId: null }, select: { id: true, clientName: true, slug: true, updatedAt: true }, orderBy: { updatedAt: "desc" } }),
    prisma.workflowProject.findMany({ where: { accountId: null }, select: { id: true, clientName: true, workflowName: true, status: true, updatedAt: true }, orderBy: { updatedAt: "desc" } }),
    prisma.trackerAccount.findMany({ where: { archived: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const groups = groupUnassigned(
    checklists.map((c) => ({ ...c, updatedAt: c.updatedAt.toISOString() })),
    workflows.map((w) => ({ ...w, updatedAt: w.updatedAt.toISOString() })),
    accounts
  );
  return { groups, accounts };
}
