import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "./actor";
import { toJson } from "./activity";
import { DEFAULT_PHASES, type PlanAudience } from "./constants";
import { parseDateOnly, toDateOnly } from "./dates";
import { badRequest, notFound } from "./errors";
import { audienceFields, defaultOwnerPersonId, describeTiming, phaseDates, planDates } from "./plan-schedule";
import { diffPlan, filterLoopEdges, planEdges, templateGraphProblems } from "./plan-selection";
import { STANDARD_ITEMS, STANDARD_TEMPLATE } from "./plan-template-seed";
import { applyPlanSchema, planItemCreateSchema, planItemUpdateSchema } from "./plan-validations";

/**
 * The standard implementation plan: a catalogue of items (the "template") and the
 * rule for turning ticked items into a project's items. Building a plan COPIES items
 * into the project, so later template edits never change a live project.
 */

const SORT_STEP = 10;

export interface PlanTemplateItemDTO {
  id: string;
  key: string;
  phaseName: string;
  groupName: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  audience: PlanAudience;
  isMilestone: boolean;
  defaultIncluded: boolean;
  startDay: number | null;
  endDay: number | null;
  timing: string;
  dependsOnKeys: string[];
  sortOrder: number;
  archived: boolean;
}

type TemplateItemRow = Prisma.TrackerPlanTemplateItemGetPayload<object>;

function asKeys(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function toItemDTO(row: TemplateItemRow): PlanTemplateItemDTO {
  return {
    id: row.id,
    key: row.key,
    phaseName: row.phaseName,
    groupName: row.groupName,
    title: row.title,
    description: row.description,
    type: row.type,
    priority: row.priority,
    audience: row.audience as PlanAudience,
    isMilestone: row.isMilestone,
    defaultIncluded: row.defaultIncluded,
    startDay: row.startDay,
    endDay: row.endDay,
    timing: describeTiming(row.startDay, row.endDay),
    dependsOnKeys: asKeys(row.dependsOnKeys),
    sortOrder: row.sortOrder,
    archived: row.archived,
  };
}

function asPhaseWeeks(value: unknown): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {};
  if (value && typeof value === "object") {
    for (const [name, weeks] of Object.entries(value as Record<string, unknown>)) {
      if (Array.isArray(weeks) && typeof weeks[0] === "number" && typeof weeks[1] === "number") {
        out[name] = [weeks[0], weeks[1]];
      }
    }
  }
  return out;
}

async function currentTemplate() {
  return prisma.trackerPlanTemplate.findFirst({ where: { archived: false }, orderBy: { createdAt: "asc" } });
}

// ------------------------------------------------------------------ the catalogue (staff)

/** The catalogue with all its items, or null until the standard plan has been loaded. */
export async function getPlanTemplate(opts: { includeArchived?: boolean } = {}) {
  const template = await currentTemplate();
  if (!template) return { template: null, items: [] as PlanTemplateItemDTO[], standardItemCount: STANDARD_ITEMS.length };
  const rows = await prisma.trackerPlanTemplateItem.findMany({
    where: { templateId: template.id, ...(opts.includeArchived ? {} : { archived: false }) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return {
    template: { id: template.id, name: template.name, description: template.description, version: template.version },
    items: rows.map(toItemDTO),
    standardItemCount: STANDARD_ITEMS.length,
  };
}

/**
 * Load the standard Talkpush plan. Only adds what is missing (by key); an item that
 * staff have edited or archived is never touched. Safe to run again.
 */
export async function loadStandardPlan() {
  const existing = await currentTemplate();
  const template =
    existing ??
    (await prisma.trackerPlanTemplate.create({
      data: {
        name: STANDARD_TEMPLATE.name,
        description: STANDARD_TEMPLATE.description,
        phaseWeeks: toJson(STANDARD_TEMPLATE.phaseWeeks) ?? {},
      },
    }));
  const have = new Set(
    (await prisma.trackerPlanTemplateItem.findMany({ where: { templateId: template.id }, select: { key: true } })).map((r) => r.key)
  );
  const missing = STANDARD_ITEMS.map((item, index) => ({ item, index })).filter(({ item }) => !have.has(item.key));
  if (missing.length > 0) {
    await prisma.trackerPlanTemplateItem.createMany({
      data: missing.map(({ item, index }) => ({
        templateId: template.id,
        key: item.key,
        phaseName: item.phaseName,
        groupName: item.groupName,
        title: item.title,
        description: item.description ?? null,
        type: item.type,
        priority: item.priority,
        audience: item.audience,
        isMilestone: item.isMilestone,
        defaultIncluded: item.defaultIncluded,
        startDay: item.startDay,
        endDay: item.endDay,
        dependsOnKeys: toJson(item.dependsOnKeys) ?? [],
        sortOrder: index * SORT_STEP,
      })),
      skipDuplicates: true,
    });
  }
  return { created: missing.length, alreadyThere: STANDARD_ITEMS.length - missing.length };
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function assertGraphStaysSound(
  templateId: string,
  change: { key: string; dependsOnKeys: string[] } | { remove: string }
) {
  const rows = await prisma.trackerPlanTemplateItem.findMany({
    where: { templateId, archived: false },
    select: { key: true, dependsOnKeys: true },
  });
  const graph = rows
    .filter((r) => !("remove" in change) || r.key !== change.remove)
    .map((r) => ({ key: r.key, dependsOnKeys: "key" in change && r.key === change.key ? change.dependsOnKeys : asKeys(r.dependsOnKeys) }));
  if ("key" in change && !graph.some((g) => g.key === change.key)) graph.push({ key: change.key, dependsOnKeys: change.dependsOnKeys });
  const problems = templateGraphProblems(graph);
  if (problems.length > 0) throw badRequest(problems[0]);
}

export async function createPlanItem(input: unknown) {
  const data = planItemCreateSchema.parse(input);
  const template = await currentTemplate();
  if (!template) throw badRequest("Load the standard plan first.");
  const key = `custom-${slug(data.title) || "item"}-${randomUUID().slice(0, 6)}`;
  await assertGraphStaysSound(template.id, { key, dependsOnKeys: data.dependsOnKeys });
  const last = await prisma.trackerPlanTemplateItem.aggregate({ where: { templateId: template.id }, _max: { sortOrder: true } });
  const row = await prisma.trackerPlanTemplateItem.create({
    data: {
      templateId: template.id,
      key,
      phaseName: data.phaseName,
      groupName: data.groupName,
      title: data.title,
      description: data.description ?? null,
      type: data.type,
      priority: data.priority,
      audience: data.audience,
      isMilestone: data.isMilestone,
      defaultIncluded: data.defaultIncluded,
      startDay: data.startDay,
      endDay: data.endDay,
      dependsOnKeys: toJson(data.dependsOnKeys) ?? [],
      sortOrder: (last._max.sortOrder ?? 0) + SORT_STEP,
    },
  });
  return toItemDTO(row);
}

export async function updatePlanItem(id: string, input: unknown) {
  const data = planItemUpdateSchema.parse(input);
  const existing = await prisma.trackerPlanTemplateItem.findUnique({ where: { id } });
  if (!existing) throw notFound("Plan item");

  const nextStart = data.startDay !== undefined ? data.startDay : existing.startDay;
  const nextEnd = data.endDay !== undefined ? data.endDay : existing.endDay;
  if (nextStart !== null && nextEnd !== null && nextEnd < nextStart) throw badRequest("The end day cannot be before the start day.");

  if (data.dependsOnKeys !== undefined) {
    await assertGraphStaysSound(existing.templateId, { key: existing.key, dependsOnKeys: data.dependsOnKeys });
  }
  const patch: Prisma.TrackerPlanTemplateItemUncheckedUpdateInput = {};
  if (data.phaseName !== undefined) patch.phaseName = data.phaseName;
  if (data.groupName !== undefined) patch.groupName = data.groupName;
  if (data.title !== undefined) patch.title = data.title;
  if (data.description !== undefined) patch.description = data.description;
  if (data.type !== undefined) patch.type = data.type;
  if (data.priority !== undefined) patch.priority = data.priority;
  if (data.audience !== undefined) patch.audience = data.audience;
  if (data.isMilestone !== undefined) patch.isMilestone = data.isMilestone;
  if (data.defaultIncluded !== undefined) patch.defaultIncluded = data.defaultIncluded;
  if (data.startDay !== undefined) patch.startDay = data.startDay;
  if (data.endDay !== undefined) patch.endDay = data.endDay;
  if (data.dependsOnKeys !== undefined) patch.dependsOnKeys = toJson(data.dependsOnKeys) ?? [];
  if (data.archived !== undefined) patch.archived = data.archived;
  const row = await prisma.trackerPlanTemplateItem.update({ where: { id }, data: patch });
  return toItemDTO(row);
}

// ------------------------------------------------------------------ a project's plan

export interface ProjectPlanItemDTO extends PlanTemplateItemDTO {
  /** The project already has an active item made from this plan item. */
  inProject: boolean;
  /** An earlier plan item was archived in this project; ticking it again restores it. */
  archivedInProject: boolean;
  /** Status of the project's item, when there is one. */
  status: string | null;
  itemId: string | null;
}

export async function getProjectPlan(projectId: string) {
  const project = await prisma.trackerProject.findUnique({
    where: { id: projectId },
    select: { id: true, title: true, startDate: true, ownerPersonId: true, archived: true },
  });
  if (!project) throw notFound("Project");
  const { template, items } = await getPlanTemplate();
  if (!template) return { template: null, project: null, items: [] as ProjectPlanItemDTO[], projectHasPlanItems: false };

  const existing = await prisma.trackerItem.findMany({
    where: { projectId, templateItemKey: { not: null } },
    select: { id: true, templateItemKey: true, archived: true, status: true },
  });
  const byKey = new Map(existing.map((e) => [e.templateItemKey as string, e]));
  return {
    template,
    project: {
      id: project.id,
      title: project.title,
      startDate: toDateOnly(project.startDate),
      hasOwner: project.ownerPersonId !== null,
      archived: project.archived,
    },
    projectHasPlanItems: existing.length > 0,
    items: items.map<ProjectPlanItemDTO>((i) => {
      const have = byKey.get(i.key);
      return {
        ...i,
        inProject: !!have && !have.archived,
        archivedInProject: !!have && have.archived,
        status: have?.status ?? null,
        itemId: have?.id ?? null,
      };
    }),
  };
}

export interface ApplyPlanResult {
  created: number;
  restored: number;
  archived: number;
  kept: number;
  /** Plan dependencies that could not be created, in plain words. */
  droppedDependencies: string[];
  hasStartDate: boolean;
}

/** Make the project's plan items match the ticked set. Nothing is ever hard-deleted. */
export async function applyProjectPlan(projectId: string, input: unknown, actor: Actor): Promise<ApplyPlanResult> {
  const data = applyPlanSchema.parse(input);
  const project = await prisma.trackerProject.findUnique({
    where: { id: projectId },
    select: { id: true, archived: true, startDate: true, ownerPersonId: true },
  });
  if (!project) throw notFound("Project");
  if (project.archived) throw badRequest("This project is archived.");

  const template = await currentTemplate();
  if (!template) throw badRequest("Load the standard plan first.");
  const templateItems = await prisma.trackerPlanTemplateItem.findMany({
    where: { templateId: template.id, archived: false },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const known = new Set(templateItems.map((t) => t.key));
  const selected = new Set(data.selectedKeys);
  for (const key of selected) {
    if (!known.has(key)) throw badRequest("Some selected items are no longer in the standard plan. Reload the page and try again.");
  }
  const startDate = toDateOnly(project.startDate);
  const phaseWeeks = asPhaseWeeks(template.phaseWeeks);

  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.trackerItem.findMany({
        where: { projectId, templateItemKey: { not: null } },
        select: { id: true, templateItemKey: true, archived: true, status: true, title: true },
      });
      const diff = diffPlan(
        templateItems.map((t) => t.key),
        selected,
        existing.map((e) => ({ id: e.id, templateItemKey: e.templateItemKey as string, archived: e.archived, status: e.status, title: e.title }))
      );
      if (diff.startedToArchive.length > 0 && !data.allowStarted) {
        const names = diff.startedToArchive.slice(0, 3).map((i) => `"${i.title}"`).join(", ");
        throw badRequest(`Work has already started on ${names}${diff.startedToArchive.length > 3 ? " and others" : ""}. Confirm to remove them from the plan.`);
      }

      // Phases the new items need, by name. Create any the project lacks; fill empty phase dates.
      const phases = await tx.trackerPhase.findMany({ where: { projectId } });
      const phaseByName = new Map(phases.map((p) => [p.name, p]));
      const needed = new Set(
        templateItems.filter((t) => diff.create.includes(t.key) || diff.restore.includes(t.key)).map((t) => t.phaseName)
      );
      let nextPhaseOrder = phases.reduce((m, p) => Math.max(m, p.sortOrder), -1) + 1;
      for (const name of needed) {
        if (!phaseByName.has(name)) {
          const order = (DEFAULT_PHASES as readonly string[]).indexOf(name);
          const created = await tx.trackerPhase.create({ data: { projectId, name, sortOrder: order >= 0 ? order : nextPhaseOrder++ } });
          phaseByName.set(name, created);
        }
      }
      for (const name of needed) {
        const phase = phaseByName.get(name);
        const weeks = phaseWeeks[name];
        if (phase && weeks && !phase.startDate && !phase.endDate) {
          const dates = phaseDates(startDate, weeks);
          if (dates.startDate && dates.endDate) {
            await tx.trackerPhase.update({
              where: { id: phase.id },
              data: { startDate: parseDateOnly(dates.startDate), endDate: parseDateOnly(dates.endDate) },
            });
          }
        }
      }

      // Create the new items in one insert.
      const templateByKey = new Map(templateItems.map((t) => [t.key, t]));
      const last = await tx.trackerItem.aggregate({ where: { projectId }, _max: { sortOrder: true } });
      let sort = (last._max.sortOrder ?? -1) + 1;
      const newIds = new Map<string, string>();
      const toCreate: Prisma.TrackerItemCreateManyInput[] = [];
      for (const key of diff.create) {
        const t = templateByKey.get(key)!;
        const audience = t.audience as PlanAudience;
        const dates = planDates(startDate, t.startDay, t.endDay);
        const id = randomUUID();
        newIds.set(key, id);
        toCreate.push({
          id,
          projectId,
          phaseId: phaseByName.get(t.phaseName)?.id ?? null,
          title: t.title,
          description: t.description,
          type: t.type,
          priority: t.priority,
          status: "not_started",
          visibility: audienceFields(audience).visibility,
          isMilestone: t.isMilestone,
          ownerPersonId: defaultOwnerPersonId(audience, project.ownerPersonId),
          startDate: parseDateOnly(dates.startDate),
          dueDate: parseDateOnly(dates.dueDate),
          sortOrder: sort++,
          createdVia: actor.via,
          templateItemKey: key,
        });
      }
      if (toCreate.length > 0) await tx.trackerItem.createMany({ data: toCreate });

      const existingByKey = new Map(existing.map((e) => [e.templateItemKey as string, e]));
      const restoreIds = diff.restore.map((k) => existingByKey.get(k)!.id);
      if (restoreIds.length > 0) await tx.trackerItem.updateMany({ where: { id: { in: restoreIds } }, data: { archived: false } });

      const archiveIds = diff.archive.map((i) => i.id);
      if (archiveIds.length > 0) {
        await tx.trackerItem.updateMany({ where: { id: { in: archiveIds } }, data: { archived: true } });
        // An archived item can no longer hold anything up.
        await tx.trackerItemDependency.deleteMany({ where: { blockedByItemId: { in: archiveIds } } });
      }

      // Dependency links.
      const idByKey = new Map<string, string>();
      for (const e of existing) idByKey.set(e.templateItemKey as string, e.id);
      for (const [k, id] of newIds) idByKey.set(k, id);
      const keyById = new Map([...idByKey].map(([k, id]) => [id, k]));
      const activeKeys = new Set([...diff.keep, ...diff.create, ...diff.restore]);
      const freshKeys = new Set([...diff.create, ...diff.restore]);
      const projectEdges = await tx.trackerItemDependency.findMany({
        where: { item: { projectId } },
        select: { itemId: true, blockedByItemId: true },
      });
      const existingPairs = new Set<string>();
      for (const e of projectEdges) {
        const a = keyById.get(e.itemId);
        const b = keyById.get(e.blockedByItemId);
        if (a && b) existingPairs.add(`${a}>${b}`);
      }
      const edgePlan = planEdges(
        templateItems.map((t) => ({ key: t.key, dependsOnKeys: asKeys(t.dependsOnKeys) })),
        activeKeys,
        freshKeys,
        existingPairs
      );
      const candidates = edgePlan.add.map((e) => ({ itemId: idByKey.get(e.itemKey)!, blockedByItemId: idByKey.get(e.blockedByKey)! }));
      const { ok, loops } = filterLoopEdges(candidates, projectEdges);
      if (ok.length > 0) await tx.trackerItemDependency.createMany({ data: ok, skipDuplicates: true });

      const dropped = [
        ...edgePlan.dropped.map((d) => `"${templateByKey.get(d.itemKey)?.title ?? d.itemKey}" will not wait on "${templateByKey.get(d.blockedByKey)?.title ?? d.blockedByKey}" because ${d.reason}.`),
        ...loops.map((l) => `A link to "${templateByKey.get(keyById.get(l.blockedByItemId) ?? "")?.title ?? "an item"}" was left out because it would make items wait on each other.`),
      ];

      // Activity: one row per item change, plus one summary row for the project.
      const activity: Prisma.TrackerActivityCreateManyInput[] = [];
      const base = { projectId, actorLabel: actor.label, via: actor.via };
      for (const row of toCreate) {
        activity.push({ ...base, entityType: "item", entityId: row.id as string, action: "item.created", after: toJson({ title: row.title, status: "not_started", fromPlan: true }) });
      }
      for (const key of diff.restore) {
        const e = existingByKey.get(key)!;
        activity.push({ ...base, entityType: "item", entityId: e.id, action: "item.updated", before: toJson({ title: e.title, archived: true }), after: toJson({ archived: false }) });
      }
      for (const e of diff.archive) {
        activity.push({ ...base, entityType: "item", entityId: e.id, action: "item.updated", before: toJson({ title: e.title, archived: false }), after: toJson({ archived: true }) });
      }
      activity.push({
        ...base,
        entityType: "project",
        entityId: projectId,
        action: "project.plan_applied",
        after: toJson({ created: diff.create.length, restored: diff.restore.length, archived: diff.archive.length, kept: diff.keep.length }),
      });
      await tx.trackerActivity.createMany({ data: activity });

      return {
        created: diff.create.length,
        restored: diff.restore.length,
        archived: diff.archive.length,
        kept: diff.keep.length,
        droppedDependencies: dropped,
        hasStartDate: startDate !== null,
      };
    },
    { timeout: 30_000, maxWait: 10_000 }
  );
}
