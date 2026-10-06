import { NextRequest } from "next/server";
import { contributorRoute } from "@/lib/tracker/contributor-route";
import { TrackerError } from "@/lib/tracker/errors";
import { clientKey, createLimiter } from "@/lib/tracker/rate-limit";
import { makeWorkbook, recordWorkbookDownload, workbookResponse } from "@/lib/tracker/workbook-service";

/**
 * PUBLIC. The Excel copy (Summary, List, Board, Timeline) for a client contact's private link.
 * Built only from the client-safe view, so it holds exactly what the client can see. Rate limited per address,
 * and each download is recorded in the activity under the contact's name (staff only; it does not use up their daily changes).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const downloadHits = createLimiter(10, 10 * 60_000);

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return contributorRoute(request, token, {}, async (ctx) => {
    if (!downloadHits.hit(clientKey(request.headers))) {
      throw new TrackerError("Too many downloads. Please try again in a few minutes.", 429);
    }
    const { file, name } = await makeWorkbook(ctx.projectId, "client");
    await recordWorkbookDownload(ctx.projectId, ctx.actor, "client");
    return workbookResponse(file, name);
  });
}
