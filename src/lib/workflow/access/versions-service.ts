import { prisma } from "@/lib/db";
import { createVersionSnapshot } from "@/lib/workflow/versioning";
import { notFound } from "./errors";
import { recordAudit } from "./audit";

/**
 * Versions as a review tool: an approval belongs to one exact version, and "published" means the version
 * clients see by default.
 */

/**
 * The version that matches the workflow exactly as it is now. Reuses the newest version when nothing changed
 * since it was taken; otherwise takes a new snapshot. Approvals bind to this.
 */
export async function ensureVersionForCurrentState(
  workflowId: string,
  opts: { createdByName?: string; createdByMemberId?: string; detail: string }
) {
  const workflow = await prisma.workflowProject.findUnique({ where: { id: workflowId }, select: { revision: true } });
  if (!workflow) throw notFound("Workflow");
  const latest = await prisma.workflowVersion.findFirst({
    where: { workflowId },
    orderBy: { versionNumber: "desc" },
    select: { id: true, versionNumber: true, revision: true },
  });
  if (latest && latest.revision === workflow.revision) return latest;
  const created = await createVersionSnapshot({
    workflowId,
    triggeredBy: "manual",
    triggerDetail: opts.detail,
    createdByName: opts.createdByName,
    createdByMemberId: opts.createdByMemberId,
  });
  return { id: created.id, versionNumber: created.versionNumber, revision: created.revision };
}

/** Takes a snapshot and makes it the version clients see by default. */
export async function publishVersion(workflowId: string, admin: { id: string; label: string }, label?: string) {
  const version = await createVersionSnapshot({
    workflowId,
    triggeredBy: "manual",
    triggerDetail: "Published",
    createdByName: admin.label,
    label: label?.trim() || undefined,
  });
  await prisma.workflowProject.update({ where: { id: workflowId }, data: { publishedVersionId: version.id } });
  await recordAudit({
    workflowId,
    actorType: "admin",
    actorId: admin.id,
    actorName: admin.label,
    action: "version.published",
    detail: { versionId: version.id, versionNumber: version.versionNumber, label: label ?? null },
  });
  return { id: version.id, versionNumber: version.versionNumber };
}

/** Clients see the live canvas again instead of a published version. */
export async function unpublish(workflowId: string, admin: { id: string; label: string }) {
  await prisma.workflowProject.update({ where: { id: workflowId }, data: { publishedVersionId: null } });
  await recordAudit({ workflowId, actorType: "admin", actorId: admin.id, actorName: admin.label, action: "version.unpublished" });
}
