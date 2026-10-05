import { NextRequest } from "next/server";
import { authed } from "@/lib/tracker/route-helpers";
import { markAllReviewed } from "@/lib/tracker/review-service";

export const dynamic = "force-dynamic";

/** Staff: mark every unreviewed client-added item in the project as reviewed. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return authed(request, async (actor) => markAllReviewed(id, actor));
}
