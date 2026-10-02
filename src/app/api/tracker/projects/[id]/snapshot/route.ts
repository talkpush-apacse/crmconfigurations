import { NextRequest } from "next/server";
import { authed } from "@/lib/tracker/route-helpers";
import { getProjectSnapshot } from "@/lib/tracker/project-service";

export const dynamic = "force-dynamic";

/** The internal "where are we now" snapshot (staff only). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return authed(request, async () => getProjectSnapshot(id));
}
