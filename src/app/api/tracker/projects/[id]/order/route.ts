import { NextRequest } from "next/server";
import { authed, readJson } from "@/lib/tracker/route-helpers";
import { reorderItems } from "@/lib/tracker/item-service";

export const dynamic = "force-dynamic";

/** PUT { "itemIds": [...] } sets the project-wide item order (used by the Kanban board). */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return authed(request, async () => reorderItems(id, await readJson(request)));
}
