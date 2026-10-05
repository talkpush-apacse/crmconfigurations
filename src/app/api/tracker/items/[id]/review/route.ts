import { NextRequest } from "next/server";
import { authed } from "@/lib/tracker/route-helpers";
import { markItemReviewed } from "@/lib/tracker/review-service";

export const dynamic = "force-dynamic";

/** Staff: mark an item a client added as reviewed. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return authed(request, async (actor) => markItemReviewed(id, actor));
}
