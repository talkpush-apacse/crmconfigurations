import { NextRequest } from "next/server";
import { authed, readJson } from "@/lib/tracker/route-helpers";
import { getProjectDetail, updateProject } from "@/lib/tracker/project-service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "true";
  return authed(request, async () => getProjectDetail(id, { includeArchived }));
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return authed(request, async (actor) => updateProject(id, await readJson(request), actor));
}
