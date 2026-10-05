import { prisma } from "@/lib/db";
import type { Actor } from "./actor";
import { logActivity } from "./activity";
import { notFound } from "./errors";

/** Staff: mark an item a client added as reviewed, so it counts toward project health from now on. */
export async function markItemReviewed(itemId: string, actor: Actor) {
  const item = await prisma.trackerItem.findUnique({
    where: { id: itemId },
    select: { id: true, projectId: true, title: true, createdVia: true, staffReviewedAt: true },
  });
  if (!item) throw notFound("Item");
  if (item.createdVia !== "client" || item.staffReviewedAt) return { reviewed: 0 };
  await prisma.$transaction(async (tx) => {
    await tx.trackerItem.update({ where: { id: itemId }, data: { staffReviewedAt: new Date() } });
    await logActivity(tx, {
      projectId: item.projectId,
      entityType: "item",
      entityId: itemId,
      action: "item.reviewed",
      before: { title: item.title },
      after: { reviewed: true },
      actor,
    });
  });
  return { reviewed: 1 };
}

/** Staff: mark every unreviewed client-added item in a project as reviewed. */
export async function markAllReviewed(projectId: string, actor: Actor) {
  const project = await prisma.trackerProject.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw notFound("Project");
  const pending = await prisma.trackerItem.findMany({
    where: { projectId, createdVia: "client", staffReviewedAt: null, archived: false },
    select: { id: true, title: true },
  });
  if (pending.length === 0) return { reviewed: 0 };
  await prisma.$transaction(async (tx) => {
    await tx.trackerItem.updateMany({ where: { id: { in: pending.map((p) => p.id) } }, data: { staffReviewedAt: new Date() } });
    for (const p of pending) {
      await logActivity(tx, {
        projectId,
        entityType: "item",
        entityId: p.id,
        action: "item.reviewed",
        before: { title: p.title },
        after: { reviewed: true },
        actor,
      });
    }
  });
  return { reviewed: pending.length };
}
