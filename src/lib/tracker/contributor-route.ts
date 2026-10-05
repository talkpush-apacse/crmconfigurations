import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { resolveContributorToken, type ContributorContext } from "./contributor-service";
import { TrackerError } from "./errors";
import { clientKey, createLimiter } from "./rate-limit";

/**
 * The one wrapper every PUBLIC contributor route goes through, so the safety rules live in one place:
 *  - the token IS the credential; a bad, expired, revoked or wrong-kind link gets the same generic 404;
 *  - rate limits per address (best effort on a serverless host; the per-contact daily caps in the
 *    service are the real backstop);
 *  - writes must be JSON and small; never cached, never indexed, no cookies.
 */

const SECURITY_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

const MAX_BODY_BYTES = 10_000;

const anyHits = createLimiter(60, 60_000);
const writeHits = createLimiter(30, 60_000);
const failedHits = createLimiter(15, 10 * 60_000);

/** Test hook: the limiters are module state, so tests reset them. */
export function resetContributorLimiters() {
  for (const l of [anyHits, writeHits, failedHits]) l.reset();
}

function respond(status: number, body: Record<string, unknown>, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...SECURITY_HEADERS, ...extra } });
}

async function readBody(request: NextRequest): Promise<unknown> {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    throw new TrackerError("The request must be JSON.", 415);
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new TrackerError("That request is too large.", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new TrackerError("The request body must be valid JSON.", 400);
  }
}

export async function contributorRoute(
  request: NextRequest,
  token: string,
  opts: { write?: boolean; status?: number },
  handler: (ctx: ContributorContext, body: unknown) => Promise<unknown>
): Promise<NextResponse> {
  const key = clientKey(request.headers);
  if (failedHits.count(key) >= 15 || !anyHits.hit(key) || (opts.write && !writeHits.hit(key))) {
    return respond(429, { error: "Too many requests. Please try again in a few minutes." }, { "Retry-After": "300" });
  }

  let ctx: ContributorContext | null;
  try {
    ctx = await resolveContributorToken(token);
  } catch (err) {
    console.error("[contribute] token lookup failed:", err instanceof Error ? err.message : err);
    ctx = null;
  }
  if (!ctx) {
    failedHits.hit(key);
    return respond(404, { error: "Not found" });
  }

  try {
    const body = opts.write ? await readBody(request) : undefined;
    return respond(opts.status ?? 200, (await handler(ctx, body)) as Record<string, unknown>);
  } catch (err) {
    if (err instanceof ZodError) {
      return respond(400, {
        error: "Some fields need attention.",
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    if (err instanceof TrackerError) return respond(err.status, { error: err.message });
    console.error("[contribute] unexpected error:", err instanceof Error ? err.message : err);
    return respond(500, { error: "Something went wrong. Please try again." });
  }
}
