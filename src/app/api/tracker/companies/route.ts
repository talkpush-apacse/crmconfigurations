import { NextRequest } from "next/server";
import { authed } from "@/lib/tracker/route-helpers";
import { listCompanies } from "@/lib/tracker/directory-service";

export const dynamic = "force-dynamic";

/** The client companies, each with the geos it already has an account for. Feeds the "New account" form. */
export async function GET(request: NextRequest) {
  return authed(request, async () => ({ companies: await listCompanies() }));
}
