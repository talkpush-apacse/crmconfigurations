import { NextRequest } from "next/server";
import { authed } from "@/lib/tracker/route-helpers";
import { makeWorkbook, recordWorkbookDownload, workbookResponse } from "@/lib/tracker/workbook-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET returns the whole project as one Excel file: Summary, List, Board and Timeline (staff copy, with team-only
 * items and blocker reasons). It is a GET on purpose: a read-only Talkpush login may call it, and it changes nothing
 * except recording the download in the project's activity.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return authed(request, async (actor) => {
    const { file, name } = await makeWorkbook(id, "staff");
    await recordWorkbookDownload(id, actor, "staff");
    return workbookResponse(file, name);
  });
}
