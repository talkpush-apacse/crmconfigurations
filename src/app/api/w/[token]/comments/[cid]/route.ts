import { NextRequest } from "next/server";
import { z } from "zod";
import { limiters, readJson, withToken } from "@/lib/workflow/access/route-helpers";
import { setCommentStatus } from "@/lib/workflow/access/comments-service";

type Ctx = { params: Promise<{ token: string; cid: string }> };
const schema = z.object({ status: z.enum(["open", "resolved"]) });

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { token, cid } = await params;
  return withToken(
    request,
    token,
    async ({ access, who }) => {
      await setCommentStatus(access.workflowId, cid, who, schema.parse(await readJson(request)).status);
      return { ok: true };
    },
    { limit: limiters.writes }
  );
}
