import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { resolveStaffActor, type Actor } from "./actor";
import { TrackerError } from "./errors";

type Handler = (actor: Actor) => Promise<unknown>;

/** Wrap a staff-only tracker route: auth, actor lookup, uniform error responses. */
export async function authed(request: NextRequest, handler: Handler, successStatus = 200): Promise<NextResponse> {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const actor = await resolveStaffActor(auth.userId);
    const result = await handler(actor);
    if (result instanceof NextResponse) return result;
    return NextResponse.json(result ?? { ok: true }, { status: successStatus });
  } catch (err) {
    return errorResponse(err);
  }
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Some fields need attention.",
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 400 }
    );
  }
  if (err instanceof TrackerError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[tracker] unexpected error:", err instanceof Error ? err.message : err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

/** Read a JSON body; an empty or invalid body becomes a 400 rather than a 500. */
export async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new TrackerError("The request body must be valid JSON.", 400);
  }
}
