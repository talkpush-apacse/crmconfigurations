import { NextRequest, NextResponse } from "next/server";
import { loadSharedActivity } from "@/lib/tracker/share-access";

/**
 * PUBLIC, read-only. The activity trail for a view-only link: who changed what and when, on the items the client can
 * see. Built from an allow-list (client-activity.ts): no staff emails, blocker reasons, links, files or downloads.
 * Same rules as /api/share/[token]: GET only, the token is the credential, any bad link gets the same generic 404.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow, noarchive", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await loadSharedActivity(token, request.headers);
  if (result.status === "busy") return NextResponse.json({ error: "Too many requests. Please try again in a few minutes." }, { status: 429, headers: { ...HEADERS, "Retry-After": "300" } });
  if (result.status === "unavailable") return NextResponse.json({ error: "Not found" }, { status: 404, headers: HEADERS });
  return NextResponse.json({ entries: result.entries }, { headers: HEADERS });
}
