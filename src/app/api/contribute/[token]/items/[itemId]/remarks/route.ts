import { NextRequest } from "next/server";
import { contributorRoute } from "@/lib/tracker/contributor-route";
import { addClientRemark } from "@/lib/tracker/contributor-service";

/** PUBLIC write. A client contact adds a shared comment to any item they can see. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string; itemId: string }> }) {
  const { token, itemId } = await params;
  return contributorRoute(request, token, { write: true, status: 201 }, async (ctx, body) => addClientRemark(ctx, itemId, body));
}
