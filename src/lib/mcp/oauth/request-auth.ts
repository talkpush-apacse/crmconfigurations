/**
 * Who is calling a connector? Either an OAuth connection (a person signed in through Claude)
 * or one of the older shared keys. The keys keep working exactly as before.
 */

import { NextResponse } from "next/server";
import { looksLikeAccessToken } from "./crypto";
import { wwwAuthenticate } from "./metadata";
import { originOf } from "./origin";
import { authenticateAccessToken, type ConnectionAuth } from "./service";

export type McpCaller = { via: "key" } | { via: "oauth"; connection: ConnectionAuth };

export type McpAuthResult = { ok: true; caller: McpCaller } | { ok: false; error: string };

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" && token ? token : null;
}

export async function authenticateMcpRequest(
  request: Request,
  validateKey: (request: Request) => { valid: boolean; error?: string }
): Promise<McpAuthResult> {
  const token = bearerToken(request);
  if (token && looksLikeAccessToken(token)) {
    const connection = await authenticateAccessToken(token);
    return connection
      ? { ok: true, caller: { via: "oauth", connection } }
      : { ok: false, error: "Invalid or expired access token" };
  }
  const key = validateKey(request);
  return key.valid ? { ok: true, caller: { via: "key" } } : { ok: false, error: key.error ?? "Invalid or missing API key" };
}

/** 401 that also tells Claude where to start signing in. */
export function unauthorizedResponse(
  request: Request,
  resourcePath: string,
  error: string,
  corsHeaders: Record<string, string>
) {
  return NextResponse.json(
    { error },
    { status: 401, headers: { ...corsHeaders, "WWW-Authenticate": wwwAuthenticate(originOf(request), resourcePath) } }
  );
}

/** A connection made by a read-only login only gets tools that look at data. The older shared keys are unchanged. */
export function isReadOnlyCaller(caller: McpCaller): boolean {
  return caller.via === "oauth" && caller.connection.role !== "editor";
}

/** Name shown in the Activity log for changes made through this connection. */
export function actorLabelFor(caller: McpCaller): string {
  return caller.via === "oauth" ? `Claude for ${caller.connection.email}` : "Claude (MCP)";
}
