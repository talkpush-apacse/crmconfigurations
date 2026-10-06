import { NextRequest } from "next/server";
import { getClientActivity } from "@/lib/tracker/client-activity-service";
import { contributorRoute } from "@/lib/tracker/contributor-route";

/**
 * PUBLIC, read-only. The activity trail for a contributor link, for the whole project or for one item (?item=<id>).
 * The same allow-list as the view-only link (client-activity.ts).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const itemId = request.nextUrl.searchParams.get("item")?.slice(0, 64) || undefined;
  return contributorRoute(request, token, {}, async (ctx) => ({ entries: await getClientActivity(ctx.projectId, { itemId }) }));
}
