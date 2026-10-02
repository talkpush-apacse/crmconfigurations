import { NextRequest, NextResponse } from "next/server";
import { getClientViewForProject } from "@/lib/tracker/client-view-service";
import { clientKey, createLimiter } from "@/lib/tracker/rate-limit";
import { resolveViewerToken } from "@/lib/tracker/share-service";

/**
 * PUBLIC, read-only client view. The only unauthenticated tracker data route.
 *
 *  - GET only (every other method is answered 405 by Next).
 *  - The token IS the credential: 256 random bits, stored only as a hash.
 *  - A malformed, unknown, expired or revoked link all get the SAME generic 404,
 *    so a bad link reveals nothing about why it failed.
 *  - The body comes from getClientViewForProject, the same function the staff
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

// Any traffic per address, and a tighter cap on failed (unknown token) attempts.
const anyHits = createLimiter(60, 60_000);
const failedHits = createLimiter(15, 10 * 60_000);

function respond(status: number, body: Record<string, unknown>, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...SECURITY_HEADERS, ...extra } });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const key = clientKey(request.headers);

  if (failedHits.count(key) >= 15 || !anyHits.hit(key)) {
    return respond(429, { error: "Too many requests. Please try again in a few minutes." }, { "Retry-After": "300" });
  }

  try {
    const { token } = await params;
    const projectId = await resolveViewerToken(token);
    if (!projectId) {
      failedHits.hit(key);
      return respond(404, { error: "Not found" });
    }
    return respond(200, await getClientViewForProject(projectId));
  } catch (err) {
    console.error("[share] unexpected error:", err instanceof Error ? err.message : err);
    // Same shape as a bad link: never reveal that a token was valid but something else broke.
    return respond(404, { error: "Not found" });
  }
}
