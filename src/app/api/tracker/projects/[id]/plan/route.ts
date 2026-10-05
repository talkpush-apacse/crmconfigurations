import { NextRequest } from "next/server";
import { authed, readJson } from "@/lib/tracker/route-helpers";
import { applyProjectPlan, getProjectPlan } from "@/lib/tracker/plan-service";

export const dynamic = "force-dynamic";

/** The standard plan with, for each item, whether this project already has it. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return authed(request, async () => getProjectPlan(id));
}

/** Make the project's plan items match the ticked set (create, restore, archive). */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return authed(request, async (actor) => applyProjectPlan(id, await readJson(request), actor));
}
