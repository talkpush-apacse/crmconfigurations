import { NextRequest, NextResponse } from "next/server";
import { loadSharedWorkbook } from "@/lib/tracker/share-access";
import { workbookResponse } from "@/lib/tracker/workbook-service";

/**
 * PUBLIC. The Excel copy (Summary, List, Board, Timeline) for a view-only link.
 * Same rules as /api/share/[token]: GET only, the token is the credential, any bad link gets the same generic 404,
 * and the file is built only from the client-safe view. Downloads are rate limited and recorded for staff.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow, noarchive", "Referrer-Policy": "no-referrer" } as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await loadSharedWorkbook(token, request.headers);
  if (result.status === "busy") {
    return NextResponse.json({ error: "Too many downloads. Please try again in a few minutes." }, { status: 429, headers: { ...HEADERS, "Retry-After": "300" } });
  }
  if (result.status === "unavailable") return NextResponse.json({ error: "Not found" }, { status: 404, headers: HEADERS });
  return workbookResponse(result.file, result.name);
}
