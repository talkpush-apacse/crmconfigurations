import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "@/lib/api-auth";
import { disableViewLink, enableViewLink, getViewLink, regenerateViewLink } from "@/lib/view-link";

/**
 * Staff only (Talkpush Admins; a read-only login must not see or change the secret link text).
 * GET  — { token }: the current read-only view token, or null when the link is off.
 * POST — { action: "enable" | "regenerate" | "turn_off" } then { token } as it is afterwards.
 */
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireEditor(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const result = await getViewLink(id);
    if (!result.ok) return NextResponse.json({ error: "Checklist not found" }, { status: 404, headers: NO_STORE });
    return NextResponse.json({ token: result.token }, { headers: NO_STORE });
  } catch (err) {
    console.error("GET /api/checklists/[id]/view-link error:", err);
    return NextResponse.json({ error: "Could not load the view link." }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireEditor(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { action?: unknown };
    const run =
      body.action === "enable" ? enableViewLink
      : body.action === "regenerate" ? regenerateViewLink
      : body.action === "turn_off" ? disableViewLink
      : null;
    if (!run) {
      return NextResponse.json({ error: "Choose enable, regenerate or turn_off." }, { status: 400, headers: NO_STORE });
    }
    const result = await run(id);
    if (!result.ok) return NextResponse.json({ error: "Checklist not found" }, { status: 404, headers: NO_STORE });
    return NextResponse.json({ token: result.token }, { headers: NO_STORE });
  } catch (err) {
    console.error("POST /api/checklists/[id]/view-link error:", err);
    return NextResponse.json({ error: "Could not change the view link. Please try again." }, { status: 500, headers: NO_STORE });
  }
}
