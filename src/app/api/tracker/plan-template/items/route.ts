import { NextRequest } from "next/server";
import { authed, readJson } from "@/lib/tracker/route-helpers";
import { createPlanItem } from "@/lib/tracker/plan-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return authed(request, async () => createPlanItem(await readJson(request)), 201);
}
