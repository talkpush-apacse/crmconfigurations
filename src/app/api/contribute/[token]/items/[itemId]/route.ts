import { NextRequest } from "next/server";
import { contributorRoute } from "@/lib/tracker/contributor-route";
import { editClientItem } from "@/lib/tracker/contributor-service";

/** PUBLIC write. A client contact edits any item they can see (title, details, status, priority, dates, owner among client contacts, what it waits for). */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ token: string; itemId: string }> }) {
  const { token, itemId } = await params;
  return contributorRoute(request, token, { write: true }, async (ctx, body) => editClientItem(ctx, itemId, body));
}
