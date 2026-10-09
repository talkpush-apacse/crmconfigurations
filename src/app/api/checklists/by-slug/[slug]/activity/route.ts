import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTabActivity } from "@/lib/edit-history/activity-service";
import { activityJson, parseActivityQuery } from "@/lib/edit-history/activity-http";

/** Client form link: who else has been changing this tab. The client link holder is "someone using the client form link". */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug: checklistSlug } = await params;
    const checklist = await prisma.checklist.findUnique({ where: { slug: checklistSlug }, select: { id: true } });
    if (!checklist) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { slug, since } = parseActivityQuery(request.nextUrl.searchParams);
    if (!slug) return NextResponse.json({ error: "A tab is needed." }, { status: 400 });
    const activity = await getTabActivity({
      checklistId: checklist.id,
      slug,
      since,
      me: { actorType: "slug" },
      audience: "client",
    });
    return activityJson(activity);
  } catch (err) {
    console.error("GET /api/checklists/by-slug/[slug]/activity error:", err);
    return NextResponse.json({ error: "Could not check for other editors." }, { status: 500 });
  }
}
