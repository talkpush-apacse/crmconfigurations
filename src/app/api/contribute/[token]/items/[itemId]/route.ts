import { NextRequest } from "next/server";
import { contributorRoute } from "@/lib/tracker/contributor-route";
import { updateClientItemStatus } from "@/lib/tracker/contributor-service";

/** PUBLIC write. A client contact sets the status of an item they own (in progress, waiting on client, done). */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ token: string; itemId: string }> }) {
  const { token, itemId } = await params;
  return contributorRoute(request, token, { write: true }, async (ctx, body) => updateClientItemStatus(ctx, itemId, body));
}
