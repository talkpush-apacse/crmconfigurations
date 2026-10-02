import { NextRequest } from "next/server";
import { authed, readJson } from "@/lib/tracker/route-helpers";
import { updateItem } from "@/lib/tracker/item-service";

export const dynamic = "force-dynamic";

/** Items are never hard-deleted: PATCH { "archived": true } hides one. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return authed(request, async (actor) => updateItem(id, await readJson(request), actor));
}
