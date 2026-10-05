import { NextRequest } from "next/server";
import { authed } from "@/lib/tracker/route-helpers";
import { getPlanTemplate, loadStandardPlan } from "@/lib/tracker/plan-service";

export const dynamic = "force-dynamic";

/** The standard plan catalogue. `?archived=1` includes archived items. */
export async function GET(request: NextRequest) {
  const includeArchived = request.nextUrl.searchParams.get("archived") === "1";
  return authed(request, async () => getPlanTemplate({ includeArchived }));
}

/** Load the standard Talkpush plan. Only adds what is missing, so it is safe to repeat. */
export async function POST(request: NextRequest) {
  return authed(request, async () => loadStandardPlan(), 201);
}
