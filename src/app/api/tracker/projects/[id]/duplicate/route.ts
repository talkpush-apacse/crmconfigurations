import { NextRequest } from "next/server";
import { authed } from "@/lib/tracker/route-helpers";
import { duplicateProject } from "@/lib/tracker/project-service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Copy a project's plan into a new project. The body is optional: { title?, accountId? }. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return authed(request, async (actor) => duplicateProject(id, await request.json().catch(() => ({})), actor), 201);
}
