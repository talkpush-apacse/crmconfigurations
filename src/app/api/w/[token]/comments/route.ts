import { NextRequest } from "next/server";
import { limiters, readJson, withToken } from "@/lib/workflow/access/route-helpers";
import { commentCreateSchema, createComment, listComments } from "@/lib/workflow/access/comments-service";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const { token } = await params;
  return withToken(request, token, async ({ access, who }) => ({ items: await listComments(access.workflowId, who) }));
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const { token } = await params;
  return withToken(
    request,
    token,
    async ({ access, who }) => createComment(access.workflowId, who, commentCreateSchema.parse(await readJson(request))),
    { limit: limiters.writes }
  );
}
