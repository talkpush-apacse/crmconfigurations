import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withStaff } from "@/lib/workflow/access/route-helpers";
import { listComments } from "@/lib/workflow/access/comments-service";
import { listSuggestions } from "@/lib/workflow/access/suggestions-service";

type Ctx = { params: Promise<{ id: string }> };

/** Everything staff review for one workflow: comments, suggestions, decisions, access requests and recent activity. */
export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withStaff(request, async ({ who }) => {
    const [comments, suggestions, feedback, accessRequests, audit, workflow] = await Promise.all([
      listComments(id, who),
      listSuggestions(id, who, ["pending", "stale"]),
      prisma.workflowFeedback.findMany({ where: { workflowId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.workflowAccessRequest.findMany({ where: { workflowId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.workflowAuditEvent.findMany({ where: { workflowId: id }, orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.workflowProject.findUnique({ where: { id }, select: { status: true, revision: true, publishedVersionId: true } }),
    ]);
    const versionIds = [...new Set(feedback.map((f) => f.versionId).filter((v): v is string => Boolean(v)))];
    const versions = versionIds.length
      ? await prisma.workflowVersion.findMany({ where: { id: { in: versionIds } }, select: { id: true, versionNumber: true } })
      : [];
    const numberOf = new Map(versions.map((v) => [v.id, v.versionNumber]));
    return {
      status: workflow?.status ?? null,
      revision: workflow?.revision ?? 0,
      comments,
      suggestions,
      feedback: feedback.map((f) => ({ id: f.id, action: f.action, reviewerName: f.reviewerName, comment: f.comment, createdAt: f.createdAt, versionNumber: f.versionId ? (numberOf.get(f.versionId) ?? null) : null })),
      accessRequests,
      audit: audit.map((a) => ({ id: a.id, actorType: a.actorType, actorName: a.actorName, action: a.action, detail: a.detail, createdAt: a.createdAt })),
    };
  });
}
