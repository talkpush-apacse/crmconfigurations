import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { ChecklistData } from "@/lib/types";
import { getChecklistProgress } from "@/lib/section-status";
import type { Actor } from "./actor";
import { diffFields, logActivity } from "./activity";
import { DEFAULT_PHASES } from "./constants";
import { needsStaffReview } from "./review";
import { parseDateOnly, toDateOnly, todayDateOnly } from "./dates";
import { listPeople } from "./directory-service";
import { badRequest, notFound } from "./errors";
import { listActivity } from "./activity-service";
import { listMetrics } from "./metric-service";
import { serializeItem, serializePhase } from "./serialize";
import { buildSnapshot } from "./snapshot";
import { summarizeProject } from "./summary";
import {
  projectCreateSchema,
  projectUpdateSchema,
  phaseUpdateSchema,
} from "./validations";

type ProjectRow = Prisma.TrackerProjectGetPayload<{
  include: {
    account: { select: { id: true; name: true } };
    sponsor: { select: { id: true; name: true } };
    owner: { select: { id: true; name: true } };
  };
}>;

const PROJECT_INCLUDE = {
  account: { select: { id: true, name: true } },
  sponsor: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } },
} as const;

function serializeProjectBase(p: ProjectRow) {
  return {
    id: p.id,
    accountId: p.accountId,
    accountName: p.account.name,
    title: p.title,
    objective: p.objective,
    status: p.status,
    startDate: toDateOnly(p.startDate),
    targetDate: toDateOnly(p.targetDate),
    originalTargetDate: toDateOnly(p.originalTargetDate),
    goLiveDate: toDateOnly(p.goLiveDate),
    rescheduleCount: p.rescheduleCount,
    healthOverride: p.healthOverride,
    healthOverrideNote: p.healthOverrideNote,
    sponsor: p.sponsor ? { id: p.sponsor.id, name: p.sponsor.name } : null,
    owner: p.owner ? { id: p.owner.id, name: p.owner.name } : null,
    checklistId: p.checklistId,
    archived: p.archived,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** A person may own or sponsor a project only if they are Talkpush staff or belong to its account. */
async function assertPersonAllowed(personId: string | null | undefined, accountId: string, label: string) {
  if (!personId) return;
  const person = await prisma.trackerPerson.findUnique({
    where: { id: personId },
    select: { accountId: true, archived: true },
  });
  if (!person) throw notFound(label);
  if (person.archived) throw badRequest(`${label} is archived.`);
  if (person.accountId !== null && person.accountId !== accountId) {
    throw badRequest(`${label} belongs to a different account.`);
  }
}

async function assertChecklistExists(checklistId: string | null | undefined) {
  if (!checklistId) return;
  const found = await prisma.checklist.findUnique({ where: { id: checklistId }, select: { id: true } });
  if (!found) throw badRequest("The linked CRM checklist does not exist.");
}

function assertDateOrder(start: string | null | undefined, target: string | null | undefined) {
  if (start && target && target < start) throw badRequest("The target date cannot be before the start date.");
}

export async function listPortfolio(opts: { includeArchived?: boolean; accountId?: string } = {}) {
  const projects = await prisma.trackerProject.findMany({
    where: {
      ...(opts.includeArchived ? {} : { archived: false }),
      ...(opts.accountId ? { accountId: opts.accountId } : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      ...PROJECT_INCLUDE,
      items: {
        where: { archived: false },
        select: { title: true, status: true, dueDate: true, isMilestone: true, archived: true, createdVia: true, staffReviewedAt: true },
      },
    },
  });
  const today = todayDateOnly();
  return projects.map((p) => {
    const base = serializeProjectBase(p);
    const summary = summarizeProject(
      {
        status: base.status,
        targetDate: base.targetDate,
        healthOverride: base.healthOverride,
        healthOverrideNote: base.healthOverrideNote,
      },
      p.items.map((i) => ({
        title: i.title,
        status: i.status,
        dueDate: toDateOnly(i.dueDate),
        isMilestone: i.isMilestone,
        archived: i.archived,
        needsReview: needsStaffReview(i),
      })),
      today
    );
    return { ...base, summary };
  });
}

export async function createProject(input: unknown, actor: Actor) {
  const data = projectCreateSchema.parse(input);
  const account = await prisma.trackerAccount.findUnique({
    where: { id: data.accountId },
    select: { id: true, archived: true },
  });
  if (!account) throw notFound("Account");
  if (account.archived) throw badRequest("This account is archived.");
  await assertPersonAllowed(data.sponsorPersonId, data.accountId, "Sponsor");
  await assertPersonAllowed(data.ownerPersonId, data.accountId, "Owner");
  await assertChecklistExists(data.checklistId);
  assertDateOrder(data.startDate, data.targetDate);

  const created = await prisma.$transaction(async (tx) => {
    const project = await tx.trackerProject.create({
      data: {
        accountId: data.accountId,
        title: data.title,
        objective: data.objective ?? null,
        startDate: parseDateOnly(data.startDate),
        targetDate: parseDateOnly(data.targetDate),
        originalTargetDate: parseDateOnly(data.targetDate),
        goLiveDate: parseDateOnly(data.goLiveDate),
        sponsorPersonId: data.sponsorPersonId,
        ownerPersonId: data.ownerPersonId,
        checklistId: data.checklistId,
        phases: { create: DEFAULT_PHASES.map((name, sortOrder) => ({ name, sortOrder })) },
      },
      include: PROJECT_INCLUDE,
    });
    await logActivity(tx, {
      projectId: project.id,
      entityType: "project",
      entityId: project.id,
      action: "project.created",
      after: { title: project.title },
      actor,
    });
    return project;
  });
  return serializeProjectBase(created);
}

export async function updateProject(id: string, input: unknown, actor: Actor) {
  const data = projectUpdateSchema.parse(input);
  const existing = await prisma.trackerProject.findUnique({ where: { id }, include: PROJECT_INCLUDE });
  if (!existing) throw notFound("Project");

  if (data.sponsorPersonId !== undefined) await assertPersonAllowed(data.sponsorPersonId, existing.accountId, "Sponsor");
  if (data.ownerPersonId !== undefined) await assertPersonAllowed(data.ownerPersonId, existing.accountId, "Owner");

  const nextStart = data.startDate !== undefined ? data.startDate : toDateOnly(existing.startDate);
  const nextTarget = data.targetDate !== undefined ? data.targetDate : toDateOnly(existing.targetDate);
  assertDateOrder(nextStart, nextTarget);

  if (data.healthOverride && !data.healthOverrideNote && !existing.healthOverrideNote) {
    throw badRequest("A note is required when you override the project health.");
  }

  const patch: Prisma.TrackerProjectUncheckedUpdateInput = {};
  if (data.title !== undefined) patch.title = data.title;
  if (data.objective !== undefined) patch.objective = data.objective;
  if (data.status !== undefined) patch.status = data.status;
  if (data.startDate !== undefined) patch.startDate = parseDateOnly(data.startDate);
  if (data.goLiveDate !== undefined) patch.goLiveDate = parseDateOnly(data.goLiveDate);
  if (data.sponsorPersonId !== undefined) patch.sponsorPersonId = data.sponsorPersonId;
  if (data.ownerPersonId !== undefined) patch.ownerPersonId = data.ownerPersonId;
  if (data.archived !== undefined) patch.archived = data.archived;

  // Moving the target date counts as a reschedule once a date has been committed to.
  if (data.targetDate !== undefined) {
    const before = toDateOnly(existing.targetDate);
    patch.targetDate = parseDateOnly(data.targetDate);
    if (data.targetDate !== before) {
      if (before !== null) patch.rescheduleCount = existing.rescheduleCount + 1;
      if (existing.originalTargetDate === null) {
        patch.originalTargetDate = parseDateOnly(before ?? data.targetDate);
      }
    }
  }

  // Override: null clears it (and its note); a level sets it.
  if (data.healthOverride !== undefined) {
    patch.healthOverride = data.healthOverride ?? null;
    if (data.healthOverride === null) patch.healthOverrideNote = null;
  }
  if (data.healthOverrideNote !== undefined && data.healthOverride !== null) {
    patch.healthOverrideNote = data.healthOverrideNote;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const project = await tx.trackerProject.update({ where: { id }, data: patch, include: PROJECT_INCLUDE });
    const before = serializeProjectBase(existing) as Record<string, unknown>;
    const after = serializeProjectBase(project) as Record<string, unknown>;
    const diff = diffFields(before, after, [
      "title",
      "objective",
      "status",
      "startDate",
      "targetDate",
      "goLiveDate",
      "healthOverride",
      "healthOverrideNote",
      "archived",
    ]);
    if (diff) {
      await logActivity(tx, {
        projectId: id,
        entityType: "project",
        entityId: id,
        action: "project.updated",
        before: diff.before,
        after: diff.after,
        actor,
      });
    }
    return project;
  });
  return serializeProjectBase(updated);
}

export async function updatePhase(phaseId: string, input: unknown, actor: Actor) {
  const data = phaseUpdateSchema.parse(input);
  const existing = await prisma.trackerPhase.findUnique({ where: { id: phaseId } });
  if (!existing) throw notFound("Phase");
  const start = data.startDate !== undefined ? data.startDate : toDateOnly(existing.startDate);
  const end = data.endDate !== undefined ? data.endDate : toDateOnly(existing.endDate);
  if (start && end && end < start) throw badRequest("A phase cannot end before it starts.");

  const updated = await prisma.$transaction(async (tx) => {
    const phase = await tx.trackerPhase.update({
      where: { id: phaseId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.startDate !== undefined ? { startDate: parseDateOnly(data.startDate) } : {}),
        ...(data.endDate !== undefined ? { endDate: parseDateOnly(data.endDate) } : {}),
        ...(data.exitCriteria !== undefined ? { exitCriteria: data.exitCriteria } : {}),
      },
    });
    const diff = diffFields(
      serializePhase(existing) as Record<string, unknown>,
      serializePhase(phase) as Record<string, unknown>,
      ["name", "startDate", "endDate", "exitCriteria"]
    );
    if (diff) {
      await logActivity(tx, {
        projectId: phase.projectId,
        entityType: "phase",
        entityId: phase.id,
        action: "phase.updated",
        before: diff.before,
        after: diff.after,
        actor,
      });
    }
    return phase;
  });
  return serializePhase(updated);
}

async function linkedChecklistProgress(checklistId: string | null) {
  if (!checklistId) return null;
  const checklist = await prisma.checklist.findUnique({ where: { id: checklistId } });
  if (!checklist) return null;
  const progress = getChecklistProgress(checklist as unknown as ChecklistData, { includeAdminTabs: true });
  return {
    id: checklist.id,
    clientName: checklist.clientName,
    completeCount: progress.completeCount,
    totalCount: progress.totalCount,
    completionPercent: progress.completionPercent,
  };
}

export async function getProjectDetail(id: string, opts: { includeArchived?: boolean } = {}) {
  const project = await prisma.trackerProject.findUnique({
    where: { id },
    include: {
      ...PROJECT_INCLUDE,
      phases: { orderBy: { sortOrder: "asc" } },
      items: {
        where: opts.includeArchived ? {} : { archived: false },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          owner: { select: { id: true, name: true, side: true } },
          phase: { select: { id: true, name: true } },
          blockedBy: { select: { blockedByItemId: true } },
          _count: { select: { remarks: true } },
        },
      },
    },
  });
  if (!project) throw notFound("Project");

  const base = serializeProjectBase(project);
  const items = project.items.map(serializeItem);
  const summary = summarizeProject(
    {
      status: base.status,
      targetDate: base.targetDate,
      healthOverride: base.healthOverride,
      healthOverrideNote: base.healthOverrideNote,
    },
    items.map((i) => ({
      title: i.title,
      status: i.status,
      dueDate: i.dueDate,
      isMilestone: i.isMilestone,
      archived: i.archived,
      needsReview: i.needsReview,
    })),
    todayDateOnly()
  );

  return {
    today: todayDateOnly(),
    project: base,
    phases: project.phases.map(serializePhase),
    items,
    people: await listPeople({ accountId: project.accountId }),
    summary,
    checklist: await linkedChecklistProgress(project.checklistId),
  };
}


/** The full "where are we now" snapshot for one project (used by the MCP summary tool and, later, the exec summary). */
export async function getProjectSnapshot(projectId: string) {
  const detail = await getProjectDetail(projectId);
  const [metrics, activity] = await Promise.all([listMetrics(projectId), listActivity(projectId, { limit: 10 })]);
  return buildSnapshot({
    project: detail.project,
    health: detail.summary.health,
    items: detail.items,
    phases: detail.phases,
    metrics,
    checklist: detail.checklist,
    recentActivity: activity.entries.map((e) => ({
      action: e.action,
      entityTitle: e.entityTitle,
      actorLabel: e.actorLabel,
      via: e.via,
      createdAt: e.createdAt,
    })),
    today: detail.today,
  });
}
