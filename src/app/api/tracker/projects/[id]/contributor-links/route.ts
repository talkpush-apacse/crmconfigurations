import { NextRequest } from "next/server";
import { authed, readJson } from "@/lib/tracker/route-helpers";
import { createContributorLink } from "@/lib/tracker/contributor-service";

export const dynamic = "force-dynamic";

/** Staff: create a contributor link for one client contact. The token is returned once. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return authed(request, async (actor) => createContributorLink(id, await readJson(request), actor), 201);
}
