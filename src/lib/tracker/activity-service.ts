import { prisma } from "@/lib/db";
import { notFound } from "./errors";

/** Newest first. `before` is an ISO timestamp cursor for paging. */
export async function listActivity(projectId: string, opts: { limit?: number; before?: string } = {}) {
  const exists = await prisma.trackerProject.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!exists) throw notFound("Project");
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const before = opts.before ? new Date(opts.before) : null;
  const rows = await prisma.trackerActivity.findMany({
    where: { projectId, ...(before && !Number.isNaN(before.getTime()) ? { createdAt: { lt: before } } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  const itemIdFor = (r: (typeof page)[number]): string | null => {
    if (r.entityType === "item") return r.entityId;
    if (r.entityType === "remark") {
      const after = r.after as { itemId?: unknown } | null;
      return typeof after?.itemId === "string" ? after.itemId : null;
    }
    return null;
  };
  const entityIds = Array.from(new Set(page.map(itemIdFor).filter((v): v is string => !!v)));
  const items = entityIds.length
    ? await prisma.trackerItem.findMany({ where: { id: { in: entityIds } }, select: { id: true, title: true } })
    : [];
  const titleById = new Map(items.map((i) => [i.id, i.title]));
  return {
    entries: page.map((r) => ({
      id: r.id,
      entityType: r.entityType,
      entityId: r.entityId,
      entityTitle: titleById.get(itemIdFor(r) ?? "") ?? null,
      action: r.action,
      before: r.before,
      after: r.after,
      actorLabel: r.actorLabel,
      via: r.via,
      createdAt: r.createdAt.toISOString(),
    })),
    hasMore: rows.length > limit,
    nextBefore: rows.length > limit ? page[page.length - 1].createdAt.toISOString() : null,
  };
}
