import { NextRequest, NextResponse } from "next/server";
import { loadSharedClientView } from "@/lib/tracker/share-access";

/**
 * PUBLIC, read-only client view. The only unauthenticated tracker data route.
 *
 *  - GET only (every other method is answered 405 by Next).
 *  - The token IS the credential: 256 random bits, stored only as a hash.
 *  - A malformed, unknown, expired or revoked link all get the SAME generic 404,
 *    so a bad link reveals nothing about why it failed.
 *  - The body comes from getClientViewForProject (through loadSharedClientView, which
 *    the server-rendered /share page also uses), the same function the staff
 *    "View as client" preview uses, so the preview is exactly what clients get.
 *  - Never cached, never indexed, no cookies.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SECURITY_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

function respond(status: number, body: Record<string, unknown>, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...SECURITY_HEADERS, ...extra } });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await loadSharedClientView(token, request.headers);
  if (result.status === "busy") {
    return respond(429, { error: "Too many requests. Please try again in a few minutes." }, { "Retry-After": "300" });
  }
  if (result.status === "unavailable") return respond(404, { error: "Not found" });
  return respond(200, result.data);
}
