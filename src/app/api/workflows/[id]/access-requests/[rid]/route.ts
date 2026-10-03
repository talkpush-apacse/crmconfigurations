import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJson, withStaff } from "@/lib/workflow/access/route-helpers";
import { notFound } from "@/lib/workflow/access/errors";

type Ctx = { params: Promise<{ id: string; rid: string }> };
const schema = z.object({ status: z.enum(["open", "handled"]) });

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id, rid } = await params;
  return withStaff(request, async () => {
    const { status } = schema.parse(await readJson(request));
    const row = await prisma.workflowAccessRequest.findFirst({ where: { id: rid, workflowId: id } });
    if (!row) throw notFound("Request");
    await prisma.workflowAccessRequest.update({ where: { id: rid }, data: { status } });
    return { ok: true };
  });
}
