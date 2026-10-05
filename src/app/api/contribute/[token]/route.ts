import { NextRequest } from "next/server";
import { contributorRoute } from "@/lib/tracker/contributor-route";
import { getContributorView } from "@/lib/tracker/contributor-service";

/**
 * PUBLIC. What a client contact sees through their private contributor link: the client-safe
 * project plus the item list they can act on. Read-only; the write routes are siblings below.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return contributorRoute(request, token, {}, async (ctx) => getContributorView(ctx));
}
