import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "./actor";
import { diffFields, logActivity, toJson } from "./activity";
import { validateDependencySet } from "./dependencies";
import { parseDateOnly } from "./dates";
import { alertAfterResponse } from "@/lib/comment-alerts/deliver";
import { shouldAlertTrackerRemark, trackerAuthorName } from "@/lib/comment-alerts/rules";
import { badRequest, notFound } from "./errors";
import { serializeItem, serializeRemark, type ItemWithRelations } from "./serialize";
import { planStatusChange } from "./status";
import {
  itemCreateSchema,
  itemUpdateSchema,
  orderSchema,
  remarkCreateSchema,
} from "./validations";

const ITEM_INCLUDE = {
  owner: { select: { id: true, name: true, side: true } },
  phase: { select: { id: true, name: true } },
  blockedBy: { select: { blockedByItemId: true } },
  _count: { select: { remarks: true } },
} as const;

const AUDITED_FIELDS = [
  "title",
  "description",
  "type",
  "priority",
  "status",
  "visibility",
  "isMilestone",
  "phaseId",
  "ownerPersonId",
  "startDate",
  "dueDate",
  "blockerReason",
  "waitingOn",
  "externalDependency",
  "checklistTabSlug",
  "archived",
  "blockedByItemIds",
] as const;

async function loadProject(projectId: string) {
  const project = await prisma.trackerProject.findUnique({
    where: { id: projectId },
    select: { id: true, accountId: true, archived: true },
  });
  if (!project) throw notFound("Project");
  return project;
}

async function assertPhaseInProject(phaseId: string | null | undefined, projectId: string) {
  if (!phaseId) return;
  const phase = await prisma.trackerPhase.findUnique({ where: { id: phaseId }, select: { projectId: true } });
  if (!phase || phase.projectId !== projectId) throw badRequest("That phase is not part of this project.");
}

async function assertOwnerAllowed(personId: string | null | undefined, accountId: string) {
  if (!personId) return;
  const person = await prisma.trackerPerson.findUnique({
    where: { id: personId },
    select: { accountId: true, archived: true },
  });
  if (!person) throw notFound("Owner");
  if (person.archived) throw badRequest("That person is archived.");
  if (person.accountId !== null && person.accountId !== accountId) {
    throw badRequest("That person belongs to a different account.");
  }
}

function assertItemDates(start: string | null | undefined, due: string | null | undefined) {
  if (start && due && due < start) throw badRequest("The due date cannot be before the start date.");
}

async function projectEdgesExcluding(tx: Prisma.TransactionClient, projectId: string, itemId: string | null) {
  const edges = await tx.trackerItemDependency.findMany({
    where: { item: { projectId }, ...(itemId ? { NOT: { itemId } } : {}) },
    select: { itemId: true, blockedByItemId: true },
  });
  const items = await tx.trackerItem.findMany({ where: { projectId }, select: { id: true } });
  return { edges, known: new Set(items.map((i) => i.id)) };
}

function auditSnapshot(item: ItemWithRelations): Record<string, unknown> {
  return serializeItem(item) as unknown as Record<string, unknown>;
}

export async function createItem(projectId: string, input: unknown, actor: Actor) {
  const data = itemCreateSchema.parse(input);
  const project = await loadProject(projectId);
  if (project.archived) throw badRequest("This project is archived.");
  await assertPhaseInProject(data.phaseId, projectId);
  await assertOwnerAllowed(data.ownerPersonId, project.accountId);
  assertItemDates(data.startDate, data.dueDate);

  const status = planStatusChange(
    { status: "not_started", blockerReason: null, completedAt: null },
    data.status,
    { blockerReason: data.blockerReason }
  );
  if (!status.ok) throw badRequest(status.error);

  const created = await prisma.$transaction(async (tx) => {
    const requested = data.blockedByItemIds ?? [];
    // The new item has no id yet, so it cannot be part of a loop; only check the targets are in this project.
    if (requested.length > 0) {
      const { known } = await projectEdgesExcluding(tx, projectId, null);
      for (const id of requested) {
        if (!known.has(id)) throw badRequest("A dependency points at an item outside this project.");
      }
    }

    const last = await tx.trackerItem.aggregate({ where: { projectId }, _max: { sortOrder: true } });
    const item = await tx.trackerItem.create({
      data: {
        projectId,
        phaseId: data.phaseId,
        title: data.title,
        description: data.description ?? null,
        type: data.type,
        priority: data.priority,
        status: status.patch.status,
        visibility: data.visibility,
        isMilestone: data.isMilestone,
        ownerPersonId: data.ownerPersonId,
        startDate: parseDateOnly(data.startDate),
        dueDate: parseDateOnly(data.dueDate),
        completedAt: status.patch.completedAt,
        blockerReason: status.patch.blockerReason,
        waitingOn: data.waitingOn ?? null,
        externalDependency: data.externalDependency ?? null,
        links: toJson(data.links ?? []) ?? [],
        checklistTabSlug: data.checklistTabSlug ?? null,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
        createdVia: actor.via,
        blockedBy: { create: Array.from(new Set(requested)).map((blockedByItemId) => ({ blockedByItemId })) },
      },
      include: ITEM_INCLUDE,
    });
    await logActivity(tx, {
      projectId,
      entityType: "item",
      entityId: item.id,
      action: "item.created",
      after: { title: item.title, status: item.status },
      actor,
    });
    return item;
  });
  return serializeItem(created);
}

export async function updateItem(itemId: string, input: unknown, actor: Actor) {
  const data = itemUpdateSchema.parse(input);
  const existing = await prisma.trackerItem.findUnique({ where: { id: itemId }, include: ITEM_INCLUDE });
  if (!existing) throw notFound("Item");
  const project = await loadProject(existing.projectId);

  if (data.phaseId !== undefined) await assertPhaseInProject(data.phaseId, existing.projectId);
  if (data.ownerPersonId !== undefined) await assertOwnerAllowed(data.ownerPersonId, project.accountId);

  const nextStart = data.startDate !== undefined ? data.startDate : existing.startDate?.toISOString().slice(0, 10);
  const nextDue = data.dueDate !== undefined ? data.dueDate : existing.dueDate?.toISOString().slice(0, 10);
  assertItemDates(nextStart, nextDue);

  const statusPlan = planStatusChange(
    { status: existing.status, blockerReason: existing.blockerReason, completedAt: existing.completedAt },
    data.status ?? existing.status,
    { blockerReason: data.blockerReason }
  );
  if (!statusPlan.ok) throw badRequest(statusPlan.error);

  const patch: Prisma.TrackerItemUncheckedUpdateInput = {
    status: statusPlan.patch.status,
    blockerReason: statusPlan.patch.blockerReason,
    completedAt: statusPlan.patch.completedAt,
  };
  if (data.title !== undefined) patch.title = data.title;
  if (data.description !== undefined) patch.description = data.description;
  if (data.type !== undefined) patch.type = data.type;
  if (data.priority !== undefined) patch.priority = data.priority;
  if (data.visibility !== undefined) patch.visibility = data.visibility;
  if (data.isMilestone !== undefined) patch.isMilestone = data.isMilestone;
  if (data.phaseId !== undefined) patch.phaseId = data.phaseId;
  if (data.ownerPersonId !== undefined) patch.ownerPersonId = data.ownerPersonId;
  if (data.startDate !== undefined) patch.startDate = parseDateOnly(data.startDate);
  if (data.dueDate !== undefined) patch.dueDate = parseDateOnly(data.dueDate);
  if (data.waitingOn !== undefined) patch.waitingOn = data.waitingOn;
  if (data.externalDependency !== undefined) patch.externalDependency = data.externalDependency;
  if (data.links !== undefined) patch.links = toJson(data.links) ?? [];
  if (data.checklistTabSlug !== undefined) patch.checklistTabSlug = data.checklistTabSlug;
  if (data.sortOrder !== undefined) patch.sortOrder = data.sortOrder;
  if (data.archived !== undefined) patch.archived = data.archived;

  const updated = await prisma.$transaction(async (tx) => {
    if (data.blockedByItemIds !== undefined) {
      const { edges, known } = await projectEdgesExcluding(tx, existing.projectId, itemId);
      const result = validateDependencySet(edges, itemId, data.blockedByItemIds, known);
      if (!result.ok) throw badRequest(result.error);
      await tx.trackerItemDependency.deleteMany({ where: { itemId } });
      if (result.blockedBy.length > 0) {
        await tx.trackerItemDependency.createMany({
          data: result.blockedBy.map((blockedByItemId) => ({ itemId, blockedByItemId })),
        });
      }
    }
    const item = await tx.trackerItem.update({ where: { id: itemId }, data: patch, include: ITEM_INCLUDE });
    const diff = diffFields(auditSnapshot(existing), auditSnapshot(item), AUDITED_FIELDS);
    if (diff) {
      const statusChanged = "status" in diff.after;
      await logActivity(tx, {
        projectId: existing.projectId,
        entityType: "item",
        entityId: itemId,
        action: statusChanged ? "item.status_changed" : "item.updated",
        before: { title: existing.title, ...diff.before },
        after: diff.after,
        actor,
      });
    }
    return item;
  });
  return serializeItem(updated);
}

export async function listRemarks(itemId: string) {
  const item = await prisma.trackerItem.findUnique({ where: { id: itemId }, select: { id: true } });
  if (!item) throw notFound("Item");
  const remarks = await prisma.trackerRemark.findMany({
    where: { itemId },
    orderBy: { createdAt: "desc" },
  });
  return remarks.map(serializeRemark);
}

export async function addRemark(itemId: string, input: unknown, actor: Actor) {
  const data = remarkCreateSchema.parse(input);
  const item = await prisma.trackerItem.findUnique({ where: { id: itemId }, select: { projectId: true } });
  if (!item) throw notFound("Item");

  const remark = await prisma.$transaction(async (tx) => {
    const created = await tx.trackerRemark.create({
      data: {
        itemId,
        body: data.body,
        visibility: data.visibility,
        authorLabel: actor.label,
        createdVia: actor.via,
      },
    });
    await logActivity(tx, {
      projectId: item.projectId,
      entityType: "remark",
      entityId: created.id,
      action: "remark.added",
      after: { itemId, visibility: data.visibility },
      actor,
    });
    return created;
  });
  // Email the super admin about shared comments from a client or Claude. Runs after the response and can never fail the comment.
  if (shouldAlertTrackerRemark({ via: actor.via, visibility: data.visibility })) {
    alertAfterResponse({ kind: "tracker", itemId, authorName: trackerAuthorName(actor.label, actor.via), body: data.body });
  }
  return serializeRemark(remark);
}

/**
 * Persist a new project-wide item order (used by the Kanban board).
 * `itemIds` is the desired order of the listed items; their sortOrder becomes
 * their position. Items not listed keep their value.
 */
export async function reorderItems(projectId: string, input: unknown) {
  const { itemIds } = orderSchema.parse(input);
  const unique = Array.from(new Set(itemIds));
  const owned = await prisma.trackerItem.findMany({ where: { projectId, id: { in: unique } }, select: { id: true } });
  if (owned.length !== unique.length) throw badRequest("Some items are not part of this project.");
  await prisma.$transaction(
    unique.map((id, index) => prisma.trackerItem.update({ where: { id }, data: { sortOrder: index } }))
  );
  return { ok: true };
}
