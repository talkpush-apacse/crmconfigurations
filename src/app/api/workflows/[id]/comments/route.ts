import { NextRequest } from "next/server";
import { readJson, withStaff } from "@/lib/workflow/access/route-helpers";
import { commentCreateSchema, createComment } from "@/lib/workflow/access/comments-service";

type Ctx = { params: Promise<{ id: string }> };

/** Staff comment or reply. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withStaff(request, async ({ who }) => createComment(id, who, commentCreateSchema.parse(await readJson(request))), 201);
}
