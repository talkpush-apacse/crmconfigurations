import { NextRequest } from "next/server";
import { authed } from "@/lib/tracker/route-helpers";
import { getUnassigned } from "@/lib/companies/overview";

export const dynamic = "force-dynamic";

/** The "needs a company" holding area: checklists and workflows not filed under a company, grouped by client name. */
export async function GET(request: NextRequest) {
  return authed(request, async () => getUnassigned());
}
