import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { clientIp, errorResponse, json, limiters, readJson } from "@/lib/workflow/access/route-helpers";
import { resolveAccess } from "@/lib/workflow/access/resolve";
import { sanitizeText } from "@/lib/workflow/text";
import { recordAudit } from "@/lib/workflow/access/audit";

type Ctx = { params: Promise<{ token: string }> };
const schema = z.object({ name: z.string().trim().min(1).max(80), email: z.string().trim().email().max(120).optional().or(z.literal("")), message: z.string().trim().max(1000).optional() });

/**
 * "Request access" from a link that no longer works. No email is sent anywhere: the request shows up in the
 * staff inbox, and a person there decides whether to share a new link.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    if (!limiters.accessRequests.hit(clientIp(request))) return json({ error: "Too many requests. Please try again later." }, 429);
    const { token } = await params;
    const input = schema.parse(await readJson(request));
    const result = await resolveAccess({ token });
    // Only a link that used to be ours can attach a request to a workflow. Anything else gets the same polite answer.
    if (!result.ok && result.workflowId) {
      await prisma.workflowAccessRequest.create({
        data: { workflowId: result.workflowId, name: sanitizeText(input.name), email: input.email || null, message: input.message ? sanitizeText(input.message) : null },
      });
      await recordAudit({ workflowId: result.workflowId, actorType: "guest", actorName: input.name, action: "access.requested" });
    }
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
