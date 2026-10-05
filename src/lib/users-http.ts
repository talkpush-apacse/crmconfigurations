import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UserError } from "@/lib/users-service";

/** Turns a problem from the user-management service into a plain-language response. */
export function usersErrorResponse(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return NextResponse.json({ error: err.issues[0]?.message ?? "Some fields need attention." }, { status: 400 });
  }
  if (err instanceof UserError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error("[users] unexpected error:", err instanceof Error ? err.message : err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
