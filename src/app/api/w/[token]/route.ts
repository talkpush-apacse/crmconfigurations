import { NextRequest } from "next/server";
import { withToken } from "@/lib/workflow/access/route-helpers";
import { buildClientPagePayload } from "@/lib/workflow/access/client-payload";
import { recordAudit } from "@/lib/workflow/access/audit";
import { actorOf } from "@/lib/workflow/access/actor";

type Ctx = { params: Promise<{ token: string }> };

/** The client page's data for ONE visitor: client-safe diagram, what they may do, comments, suggestions. */
export async function GET(request: NextRequest, { params }: Ctx) {
  const { token } = await params;
  return withToken(request, token, async ({ access, who }) => {
    const payload = await buildClientPagePayload(access.workflowId, who, { needsName: access.needsName, pinnedVersionId: access.pinnedVersionId });
    if (!payload) return null;
    // Opening a page is worth one audit line per visitor per hour at most; keep the trail readable.
    if (request.headers.get("x-wf-first-load") === "1") {
      await recordAudit({ workflowId: access.workflowId, ...actorOf(who), action: "link.opened", detail: { via: access.source.type } });
    }
    return payload;
  });
}
