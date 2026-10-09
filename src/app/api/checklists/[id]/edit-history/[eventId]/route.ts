import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getEditEvent } from "@/lib/edit-history/history-service";

/** Staff only. GET — one recorded change with its before and after text. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { id, eventId } = await params;
    const event = await getEditEvent(id, eventId);
    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ event }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (err) {
    console.error("GET /api/checklists/[id]/edit-history/[eventId] error:", err);
    return NextResponse.json({ error: "Could not load this change. Please try again." }, { status: 500 });
  }
}
