import { NextRequest } from "next/server";
import { z } from "zod";
import { json, limiters, readJson, withToken } from "@/lib/workflow/access/route-helpers";
import { badRequest, forbidden } from "@/lib/workflow/access/errors";
import { can } from "@/lib/workflow/access/permissions";
import { saveOps } from "@/lib/workflow/access/ops-service";
import { recordAudit } from "@/lib/workflow/access/audit";
import { actorOf } from "@/lib/workflow/access/actor";
import type { WorkflowOp } from "@/lib/workflow/ops";

type Ctx = { params: Promise<{ token: string }> };
const schema = z.object({ baseRevision: z.number().int().min(0), ops: z.array(z.record(z.string(), z.unknown())).min(1).max(500) });

/** A direct edit by an Editor. The server applies it to the FULL canvas and refuses anything touching staff-only content. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { token } = await params;
  return withToken(
    request,
    token,
    async ({ access, who }) => {
      if (!can(who.principal, "canvas.edit")) throw forbidden("Your link does not allow direct edits.");
      if (!who.identity.displayName) throw badRequest("Please tell us your name first.");
      const input = schema.parse(await readJson(request));
      const result = await saveOps({ workflowId: access.workflowId, baseRevision: input.baseRevision, ops: input.ops as unknown as WorkflowOp[], principal: who.principal });
      if (!result.ok) {
        if (result.reason === "conflict") return json({ error: "This workflow changed since you opened it.", code: "conflict", latestRevision: result.latestRevision }, 409);
        if (result.reason === "forbidden") throw forbidden();
        return json({ error: "Workflow not found", code: "not_found" }, 404);
      }
      await recordAudit({ workflowId: access.workflowId, ...actorOf(who), action: "canvas.edited", detail: { ops: input.ops.length, revision: result.revision } });
      return { ok: true, revision: result.revision };
    },
    { limit: limiters.writes }
  );
}
