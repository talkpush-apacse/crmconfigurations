import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withToken } from "@/lib/workflow/access/route-helpers";
import { othersPresent } from "@/lib/workflow/access/presence";

type Ctx = { params: Promise<{ token: string }> };

/** Cheap poll: "has anything changed?" plus who else is here. Editors call this every ~10 seconds. */
export async function GET(request: NextRequest, { params }: Ctx) {
  const { token } = await params;
  return withToken(request, token, async ({ access, who }) => {
    const [workflow, pendingSuggestions, openComments] = await Promise.all([
      prisma.workflowProject.findUnique({ where: { id: access.workflowId }, select: { revision: true, status: true, publishedVersionId: true } }),
      prisma.workflowSuggestion.count({ where: { workflowId: access.workflowId, status: "pending" } }),
      prisma.workflowComment.count({ where: { workflowId: access.workflowId, status: "open" } }),
    ]);
    const key = who.identity.memberId ?? who.identity.guestId ?? access.source.id;
    return { revision: workflow?.revision ?? 0, status: workflow?.status, publishedVersionId: workflow?.publishedVersionId ?? null, pendingSuggestions, openComments, others: othersPresent(access.workflowId, key) };
  });
}
