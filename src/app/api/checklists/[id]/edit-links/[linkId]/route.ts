import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "@/lib/api-auth";
import { regenerateEditLink, renameEditLink, revokeEditLink } from "@/lib/edit-history/links-service";
import { NO_STORE, editLinkError } from "@/lib/edit-history/http";

/**
 * Staff only.
 * PATCH  — { name } renames the link, or { regenerate: true } gives it a new address (same name and history; the old
 *          address stops working at once).
 * DELETE — turns the link off at once. The row is kept so the history can still say who it was.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; linkId: string }> }) {
  try {
    const auth = await requireEditor(request);
    if (auth instanceof NextResponse) return auth;
    const { id, linkId } = await params;
    const body = (await request.json().catch(() => ({}))) as { name?: unknown; regenerate?: unknown };
    if (body.regenerate === true) {
      return NextResponse.json({ link: await regenerateEditLink(id, linkId) }, { headers: NO_STORE });
    }
    if (body.name !== undefined) {
      return NextResponse.json({ link: await renameEditLink(id, linkId, body.name) }, { headers: NO_STORE });
    }
    return NextResponse.json({ error: "Nothing to change." }, { status: 400, headers: NO_STORE });
  } catch (err) {
    return editLinkError(err, "PATCH /api/checklists/[id]/edit-links/[linkId] error:");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; linkId: string }> }) {
  try {
    const auth = await requireEditor(request);
    if (auth instanceof NextResponse) return auth;
    const { id, linkId } = await params;
    return NextResponse.json({ link: await revokeEditLink(id, linkId) }, { headers: NO_STORE });
  } catch (err) {
    return editLinkError(err, "DELETE /api/checklists/[id]/edit-links/[linkId] error:");
  }
}
