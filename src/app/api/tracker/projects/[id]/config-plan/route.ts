import { NextRequest } from "next/server";
import { getProjectConfigPlan } from "@/lib/config-plan/service";
import { authed } from "@/lib/tracker/route-helpers";

export const dynamic = "force-dynamic";

/** Staff only, read only: the configuration plan for a project's linked checklist and a chosen workflow. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = request.nextUrl.searchParams;
  const version = q.get("version") === "current" ? "current" : q.get("version") === "published" ? "published" : null;
  return authed(request, async () => getProjectConfigPlan(id, { workflow: q.get("workflow"), version }));
}
