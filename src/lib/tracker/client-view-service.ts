import { prisma } from "@/lib/db";
import { toDateOnly, todayDateOnly } from "./dates";
import { notFound } from "./errors";
import { buildClientView } from "./client-view";

/**
 * Loads exactly the columns the client view needs (an explicit `select`, never a
 * whole row) and hands them to the pure, tested builder. Both the staff
 * "View as client" preview and any future public link call this one function,
 * so the preview is always identical to what a client sees.
 */
export async function getClientViewForProject(projectId: string) {
  const project = await prisma.trackerProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      objective: true,
      status: true,
      startDate: true,
      targetDate: true,
      originalTargetDate: true,
      goLiveDate: true,
      rescheduleCount: true,
      healthOverride: true,
      archived: true,
      account: { select: { name: true } },
      owner: { select: { name: true } },
      sponsor: { select: { name: true } },
      phases: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true } },
      items: {
        where: { archived: false, visibility: "client_visible" },
        orderBy: [{ sortOrder: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          visibility: true,
          isMilestone: true,
          phaseId: true,
          dueDate: true,
          completedAt: true,
          waitingOn: true,
          archived: true,
          owner: { select: { name: true, side: true } },
        },
      },
      metrics: {
        where: { archived: false, visibility: "client_visible" },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          unit: true,
          direction: true,
          baselineValue: true,
          targetValue: true,
          currentValue: true,
          currentAsOf: true,
          visibility: true,
          archived: true,
        },
      },
    },
  });
  if (!project || project.archived) throw notFound("Project");

  const itemIds = project.items.map((i) => i.id);
  const remarks = itemIds.length
    ? await prisma.trackerRemark.findMany({
        where: { itemId: { in: itemIds }, visibility: "shared" },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, itemId: true, body: true, visibility: true, authorLabel: true, createdVia: true, createdAt: true },
      })
    : [];

  return buildClientView({
    project: {
      id: project.id,
      title: project.title,
      objective: project.objective,
      status: project.status,
      startDate: toDateOnly(project.startDate),
      targetDate: toDateOnly(project.targetDate),
      originalTargetDate: toDateOnly(project.originalTargetDate),
      goLiveDate: toDateOnly(project.goLiveDate),
      rescheduleCount: project.rescheduleCount,
      accountName: project.account.name,
      healthOverride: project.healthOverride,
      owner: project.owner,
      sponsor: project.sponsor,
    },
    items: project.items.map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description,
      status: i.status,
      visibility: i.visibility,
      isMilestone: i.isMilestone,
      phaseId: i.phaseId,
      dueDate: toDateOnly(i.dueDate),
      completedAt: i.completedAt ? i.completedAt.toISOString() : null,
      waitingOn: i.waitingOn,
      archived: i.archived,
      ownerName: i.owner?.name ?? null,
      ownerSide: i.owner?.side ?? null,
      blockerReason: null,
    })),
    phases: project.phases,
    metrics: project.metrics.map((m) => ({ ...m, currentAsOf: toDateOnly(m.currentAsOf) })),
    remarks: remarks.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    today: todayDateOnly(),
  });
}
