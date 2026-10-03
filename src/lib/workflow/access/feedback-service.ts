import { z } from "zod";
import { prisma } from "@/lib/db";
import { sanitizeText } from "@/lib/workflow/text";
import { actorOf, authorKey, displayNameOf, type ActingAs } from "./actor";
import { recordAudit } from "./audit";
import { badRequest, forbidden, notFound } from "./errors";
import { can } from "./permissions";
import { ensureVersionForCurrentState } from "./versions-service";

export const feedbackSchema = z.object({
  action: z.enum(["approved", "changes_requested"]),
  comment: z.string().trim().max(2000).optional(),
  /** The version the person was looking at. Omitted = they were looking at the live canvas. */
  versionId: z.string().min(1).max(40).optional(),
});

/**
 * Approve / request changes, tied to the exact version the person saw (spec F4/F5).
 * If they were looking at live work, a snapshot is taken first so there is something definite to point at.
 */
export async function submitFeedback(workflowId: string, who: ActingAs, input: z.infer<typeof feedbackSchema>) {
  if (!can(who.principal, "approve")) throw forbidden("You can look at this workflow but not approve it.");
  if (!who.admin && !who.identity.displayName) throw badRequest("Please tell us your name first.");
  const comment = input.comment ? sanitizeText(input.comment) : "";
  if (input.action === "changes_requested" && !comment) throw badRequest("Please say what needs to change.");

  const workflow = await prisma.workflowProject.findUnique({ where: { id: workflowId }, select: { id: true, status: true } });
  if (!workflow) throw notFound("Workflow");

  let versionId = input.versionId;
  let versionNumber: number;
  if (versionId) {
    const v = await prisma.workflowVersion.findFirst({ where: { id: versionId, workflowId }, select: { id: true, versionNumber: true } });
    if (!v) throw notFound("Version");
    versionNumber = v.versionNumber;
  } else {
    const v = await ensureVersionForCurrentState(workflowId, {
      createdByName: displayNameOf(who),
      createdByMemberId: who.identity.memberId,
      detail: input.action === "approved" ? "Approved" : "Changes requested",
    });
    versionId = v.id;
    versionNumber = v.versionNumber;
  }

  const [feedback] = await prisma.$transaction([
    prisma.workflowFeedback.create({
      data: {
        workflowId,
        action: input.action,
        reviewerName: displayNameOf(who),
        comment: comment || null,
        versionId,
        memberId: authorKey(who),
        linkId: who.identity.linkId ?? null,
        adminId: who.admin?.id ?? null,
      },
    }),
    prisma.workflowProject.update({ where: { id: workflowId }, data: { status: input.action } }),
  ]);
  await recordAudit({ workflowId, ...actorOf(who), action: `review.${input.action}`, detail: { feedbackId: feedback.id, versionId, versionNumber } });
  return { id: feedback.id, action: feedback.action, versionNumber, createdAt: feedback.createdAt };
}
