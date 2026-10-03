import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { createLimiter, type Limiter } from "@/lib/tracker/rate-limit";
import { OpError } from "@/lib/workflow/ops";
import { ScopingInputError } from "@/lib/workflow/scoping";
import { staffActing, type ActingAs } from "./actor";
import { AccessError } from "./errors";
import { ADMIN } from "./permissions";
import { GUEST_COOKIE } from "./guest";
import { problemMessage, resolveAccess, type ResolvedAccess } from "./resolve";

/** Never cache anything that depends on a secret link, and never let it be indexed. */
const NO_STORE = { "Cache-Control": "no-store, max-age=0", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };

export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...extra } });
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return json({ error: "Some fields need attention.", issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, 400);
  }
  if (err instanceof AccessError) return json({ error: err.message, code: err.code }, err.status);
  if (err instanceof OpError) {
    const status = err.code === "forbidden" ? 403 : err.code === "not_found" ? 404 : 400;
    return json({ error: err.message, code: err.code, opIndex: err.opIndex }, status);
  }
  if (err instanceof ScopingInputError) return json({ error: err.message }, 400);
  console.error("[workflow] unexpected error:", err instanceof Error ? err.message : err);
  return json({ error: "Something went wrong. Please try again." }, 500);
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AccessError("The request body must be valid JSON.", 400);
  }
}

// ---- rate limits (in memory: best effort per server instance, honest about it) ---------------------

export const limiters = {
  /** Any request that carries a secret link, per visitor address. */
  general: createLimiter(240, 60_000),
  /** Passcode guesses and name set-up. */
  sensitive: createLimiter(20, 10 * 60_000),
  /** Comments, suggestions, edits, approvals. */
  writes: createLimiter(60, 60_000),
  /** "Request access" forms. */
  accessRequests: createLimiter(5, 60 * 60_000),
};

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

function tooMany(): NextResponse {
  return json({ error: "Too many requests. Please wait a moment and try again." }, 429, { "Retry-After": "30" });
}

// ---- routes for people holding a secret link --------------------------------------------------------

export interface TokenRouteOptions {
  /** Extra limiter for this action (on top of the general one). */
  limit?: Limiter;
  /** Do not run the normal permission/problem checks: the handler deals with a failed link itself (request-access). */
  allowProblem?: boolean;
}

type TokenHandler = (ctx: { access: ResolvedAccess; who: ActingAs; request: NextRequest }) => Promise<unknown>;

export async function withToken(request: NextRequest, token: string, handler: TokenHandler, opts: TokenRouteOptions = {}): Promise<NextResponse> {
  const ip = clientIp(request);
  if (!limiters.general.hit(ip)) return tooMany();
  if (opts.limit && !opts.limit.hit(ip)) return tooMany();

  try {
    const passcode = request.headers.get("x-wf-passcode");
    // A wrong passcode guess counts against a tight limit.
    if (passcode && !limiters.sensitive.hit(`pass:${ip}`)) return tooMany();

    const result = await resolveAccess({ token, passcode, guestCookie: request.cookies.get(GUEST_COOKIE)?.value });
    if (!result.ok) {
      const msg = problemMessage(result.problem);
      const status = result.problem === "passcode_required" || result.problem === "wrong_passcode" ? 401 : result.problem === "not_found" ? 404 : 403;
      return json({ error: msg.title, problem: result.problem, title: msg.title, message: msg.body, canRequestAccess: msg.canRequestAccess, clientName: result.clientName ?? null }, status);
    }
    const who: ActingAs = { principal: result.access.principal, identity: result.access.identity };
    const out = await handler({ access: result.access, who, request });
    if (out instanceof NextResponse) return out;
    return json(out ?? { ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- routes for staff -------------------------------------------------------------------------------

export interface StaffContext {
  admin: { id: string; label: string };
  who: ActingAs;
  request: NextRequest;
}

export async function withStaff(request: NextRequest, handler: (ctx: StaffContext) => Promise<unknown>, successStatus = 200): Promise<NextResponse> {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    let label = "Staff";
    try {
      const user = await prisma.adminUser.findUnique({ where: { id: auth.userId }, select: { email: true } });
      if (user?.email) label = user.email;
    } catch {
      // the label is cosmetic
    }
    const admin = { id: auth.userId, label };
    const out = await handler({ admin, who: staffActing(admin, ADMIN), request });
    if (out instanceof NextResponse) return out;
    return NextResponse.json(out ?? { ok: true }, { status: successStatus });
  } catch (err) {
    return errorResponse(err);
  }
}
