import { NextResponse } from "next/server";
import { OAuthError } from "./errors";

/** The sign-in endpoints are called by Claude's servers and by browser-based tools, so allow cross-origin calls. */
export const OAUTH_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, MCP-Protocol-Version",
};

export function oauthJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { ...OAUTH_CORS, "Cache-Control": "no-store", Pragma: "no-cache" },
  });
}

export function oauthPreflight() {
  return new NextResponse(null, { status: 204, headers: OAUTH_CORS });
}

/** Standard error body for known problems; a generic message (and a log line) for anything unexpected. */
export function oauthErrorResponse(err: unknown, label: string) {
  if (err instanceof OAuthError) return oauthJson(err.toJSON(), err.status);
  console.error(`[${label}] unexpected error:`, err instanceof Error ? err.message : err);
  return oauthJson({ error: "server_error", error_description: "Something went wrong. Please try again." }, 500);
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
