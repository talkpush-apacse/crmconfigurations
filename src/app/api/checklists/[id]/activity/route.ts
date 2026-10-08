import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getTabActivity } from "@/lib/edit-history/activity-service";
import { activityJson, parseActivityQuery } from "@/lib/edit-history/activity-http";

/** Staff: who else has been changing this tab. Staff see full names (a read-only login may see this too). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const { slug, since } = parseActivityQuery(request.nextUrl.searchParams);
    if (!slug) return NextResponse.json({ error: "A tab is needed." }, { status: 400 });
    const activity = await getTabActivity({
      checklistId: id,
      slug,
      since,
      me: { actorType: "admin", name: auth.email },
      audience: "staff",
    });
    return activityJson(activity);
  } catch (err) {
    console.error("GET /api/checklists/[id]/activity error:", err);
    return NextResponse.json({ error: "Could not check for other editors." }, { status: 500 });
  }
}
