import { NextRequest } from "next/server";
import { authed } from "@/lib/tracker/route-helpers";
import { listCompanies } from "@/lib/companies/overview";

export const dynamic = "force-dynamic";

/** The gallery: every company with how many checklists, workflows and trackers it has, and what needs attention. */
export async function GET(request: NextRequest) {
  return authed(request, async () => listCompanies());
}
