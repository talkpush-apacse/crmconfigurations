import { NextRequest } from "next/server";
import { readJson, withStaff } from "@/lib/workflow/access/route-helpers";
import { commentCreateSchema, createComment, listComments } from "@/lib/workflow/access/comments-service";

type Ctx = { params: Promise<{ id: string }> };

/** Every comment on the workflow, for the pins on the diagram and the Review panel. */
export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withStaff(request, async ({ who }) => ({ comments: await listComments(id, who) }));
}

/** Staff comment or reply. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withStaff(request, async ({ who }) => createComment(id, who, commentCreateSchema.parse(await readJson(request))), 201);
}
