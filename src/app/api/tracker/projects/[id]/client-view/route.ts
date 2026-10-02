import { NextRequest } from "next/server";
import { authed } from "@/lib/tracker/route-helpers";
import { getClientViewForProject } from "@/lib/tracker/client-view-service";

export const dynamic = "force-dynamic";

/**
 * STAFF-ONLY preview of exactly what a client would see ("View as client").
 * It calls the same function a client link will use, so the preview cannot drift.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return authed(request, async () => getClientViewForProject(id));
}
