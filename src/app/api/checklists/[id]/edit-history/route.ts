import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getHistoryOverview, listEditEvents } from "@/lib/edit-history/history-service";

/**
 * Staff only. GET — one page of recorded changes, newest first.
 *   ?person=link:<id> | admin:<email> | type:slug | type:legacy_link | type:mcp
 *   ?tab=<tabKey>      ?cursor=<from the previous page>      ?limit=50
 * The first page (no cursor) also carries the filter lists and the notes about what is and is not recorded.
 * Before/after text is NOT in the list; open one change with /edit-history/<id>.
 */
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const q = request.nextUrl.searchParams;
    const cursor = q.get("cursor");
    const limit = Number(q.get("limit")) || undefined;
    const page = await listEditEvents({ checklistId: id, person: q.get("person"), tab: q.get("tab"), cursor, limit });
    const overview = cursor ? null : await getHistoryOverview(id);
    return NextResponse.json({ ...page, overview }, { headers: NO_STORE });
  } catch (err) {
    console.error("GET /api/checklists/[id]/edit-history error:", err);
    return NextResponse.json({ error: "Could not load the edit history. Please try again." }, { status: 500, headers: NO_STORE });
  }
}
