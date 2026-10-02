import { prisma } from "@/lib/db";
import type { Actor } from "./actor";
import { logActivity } from "./activity";
import { parseDateOnly, toDateOnly, todayDateOnly } from "./dates";
import { notFound } from "./errors";
import { metricCreateSchema, metricUpdateSchema, readingCreateSchema } from "./validations";

type MetricRow = NonNullable<Awaited<ReturnType<typeof prisma.trackerMetric.findUnique>>>;

export function serializeMetric(m: MetricRow) {
  return {
    id: m.id,
    projectId: m.projectId,
    name: m.name,
    unit: m.unit,
    direction: m.direction,
    baselineValue: m.baselineValue,
    baselineDate: toDateOnly(m.baselineDate),
    targetValue: m.targetValue,
    currentValue: m.currentValue,
    currentAsOf: toDateOnly(m.currentAsOf),
    source: m.source,
    visibility: m.visibility,
    sortOrder: m.sortOrder,
    archived: m.archived,
  };
}

export async function listMetrics(projectId: string) {
  const metrics = await prisma.trackerMetric.findMany({
    where: { projectId, archived: false },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return metrics.map(serializeMetric);
}

export async function createMetric(projectId: string, input: unknown, actor: Actor) {
  const data = metricCreateSchema.parse(input);
  const project = await prisma.trackerProject.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw notFound("Project");
  const last = await prisma.trackerMetric.aggregate({ where: { projectId }, _max: { sortOrder: true } });

  const metric = await prisma.$transaction(async (tx) => {
    const created = await tx.trackerMetric.create({
      data: {
        projectId,
        name: data.name,
        unit: data.unit,
        direction: data.direction,
        baselineValue: data.baselineValue,
        baselineDate: parseDateOnly(data.baselineDate),
        targetValue: data.targetValue,
        currentValue: data.currentValue,
        currentAsOf: parseDateOnly(data.currentAsOf),
        source: data.source ?? null,
        visibility: data.visibility,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
      },
    });
    await logActivity(tx, {
      projectId,
      entityType: "metric",
      entityId: created.id,
      action: "metric.created",
      after: { name: created.name, unit: created.unit, baseline: created.baselineValue, target: created.targetValue },
      actor,
    });
    return created;
  });
  return serializeMetric(metric);
}

/** Record a measurement. The metric's "current" value follows the newest reading. */
export async function recordReading(metricId: string, input: unknown, actor: Actor) {
  const data = readingCreateSchema.parse(input);
  const metric = await prisma.trackerMetric.findUnique({ where: { id: metricId } });
  if (!metric) throw notFound("Metric");
  const asOfString = data.asOf ?? todayDateOnly();
  const asOf = parseDateOnly(asOfString) as Date;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.trackerMetricReading.create({
      data: { metricId, value: data.value, asOf, note: data.note ?? null, createdVia: actor.via },
    });
    const isNewest = !metric.currentAsOf || asOf.getTime() >= metric.currentAsOf.getTime();
    const next = isNewest
      ? await tx.trackerMetric.update({ where: { id: metricId }, data: { currentValue: data.value, currentAsOf: asOf } })
      : metric;
    await logActivity(tx, {
      projectId: metric.projectId,
      entityType: "metric",
      entityId: metricId,
      action: "metric.reading_recorded",
      before: { name: metric.name, current: metric.currentValue },
      after: { value: data.value, asOf: asOfString },
      actor,
    });
    return next;
  });
  return serializeMetric(updated);
}

export async function updateMetric(metricId: string, input: unknown, actor: Actor) {
  const data = metricUpdateSchema.parse(input);
  const existing = await prisma.trackerMetric.findUnique({ where: { id: metricId } });
  if (!existing) throw notFound("Metric");
  const updated = await prisma.$transaction(async (tx) => {
    const metric = await tx.trackerMetric.update({
      where: { id: metricId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.unit !== undefined ? { unit: data.unit } : {}),
        ...(data.direction !== undefined ? { direction: data.direction } : {}),
        ...(data.baselineValue !== undefined ? { baselineValue: data.baselineValue } : {}),
        ...(data.baselineDate !== undefined ? { baselineDate: parseDateOnly(data.baselineDate) } : {}),
        ...(data.targetValue !== undefined ? { targetValue: data.targetValue } : {}),
        ...(data.source !== undefined ? { source: data.source } : {}),
        ...(data.visibility !== undefined ? { visibility: data.visibility } : {}),
        ...(data.archived !== undefined ? { archived: data.archived } : {}),
      },
    });
    await logActivity(tx, {
      projectId: existing.projectId,
      entityType: "metric",
      entityId: metricId,
      action: "metric.updated",
      before: { name: existing.name },
      after: Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
      actor,
    });
    return metric;
  });
  return serializeMetric(updated);
}

export async function listReadings(metricId: string) {
  const metric = await prisma.trackerMetric.findUnique({ where: { id: metricId }, select: { id: true } });
  if (!metric) throw notFound("Metric");
  const readings = await prisma.trackerMetricReading.findMany({ where: { metricId }, orderBy: { asOf: "asc" } });
  return readings.map((r) => ({ id: r.id, value: r.value, asOf: toDateOnly(r.asOf), note: r.note, createdVia: r.createdVia }));
}

/** Readings for every live metric of a project in one query, for the history charts. */
export async function listProjectReadings(projectId: string) {
  const readings = await prisma.trackerMetricReading.findMany({
    where: { metric: { projectId, archived: false } },
    orderBy: { asOf: "asc" },
    select: { metricId: true, value: true, asOf: true },
  });
  const byMetric: Record<string, { asOf: string; value: number }[]> = {};
  for (const r of readings) (byMetric[r.metricId] ??= []).push({ asOf: toDateOnly(r.asOf) as string, value: r.value });
  return byMetric;
}
