import { NextRequest } from "next/server";
import { z } from "zod";
import { readJson, withStaff } from "@/lib/workflow/access/route-helpers";
import { setCommentStatus } from "@/lib/workflow/access/comments-service";

type Ctx = { params: Promise<{ id: string; cid: string }> };
const schema = z.object({ status: z.enum(["open", "resolved"]) });

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id, cid } = await params;
  return withStaff(request, async ({ who }) => {
    await setCommentStatus(id, cid, who, schema.parse(await readJson(request)).status);
    return { ok: true };
  });
}
