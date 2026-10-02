import { NextRequest } from "next/server";
import { authed } from "@/lib/tracker/route-helpers";
import { revokeShareLink } from "@/lib/tracker/share-service";

export const dynamic = "force-dynamic";

/** DELETE revokes (it never removes the row, so the history stays). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return authed(request, async (actor) => revokeShareLink(id, actor));
}
