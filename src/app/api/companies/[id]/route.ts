import { NextRequest } from "next/server";
import { authed } from "@/lib/tracker/route-helpers";
import { getCompany } from "@/lib/companies/overview";

export const dynamic = "force-dynamic";

/** One company with its checklists and workflows (its trackers come from /api/tracker/projects?accountId=). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return authed(request, async () => getCompany(id));
}
