import { NextRequest, NextResponse } from "next/server";
import { getTabActivity } from "@/lib/edit-history/activity-service";
import { activityJson, parseActivityQuery } from "@/lib/edit-history/activity-http";
import { findChecklistByEditorToken } from "@/lib/edit-history/resolve";
import { LINK_OFF_MESSAGE } from "@/lib/edit-history/types";

/**
 * Editor link: who else has been changing this tab. Same access rule as the page itself (a turned-off link is refused),
 * and the viewer's own changes are left out. Staff are shown as "Talkpush team", never by email address.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const found = await findChecklistByEditorToken(token, { id: true });
    if (!found.ok) {
      return found.reason === "unknown"
        ? NextResponse.json({ error: "Not found" }, { status: 404 })
        : NextResponse.json({ error: LINK_OFF_MESSAGE, code: "link_off" }, { status: 410 });
    }
    const { slug, since } = parseActivityQuery(request.nextUrl.searchParams);
    if (!slug) return NextResponse.json({ error: "A tab is needed." }, { status: 400 });
    const activity = await getTabActivity({
      checklistId: found.checklist.id,
      slug,
      since,
      me: { linkId: found.actor.linkId ?? null, actorType: found.actor.type },
      audience: "client",
    });
    return activityJson(activity);
  } catch (err) {
    console.error("GET /api/checklists/by-token/[token]/activity error:", err);
    return NextResponse.json({ error: "Could not check for other editors." }, { status: 500 });
  }
}
