import { NextRequest } from "next/server";
import { contributorRoute } from "@/lib/tracker/contributor-route";
import { addClientItem } from "@/lib/tracker/contributor-service";

/** PUBLIC write. A client contact adds an item. Allow-listed fields only; owned by them; needs staff review. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return contributorRoute(request, token, { write: true, status: 201 }, async (ctx, body) => addClientItem(ctx, body));
}
