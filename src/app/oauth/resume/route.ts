/**
 * After a first sign-in, the admin home page sends people here if they were in the middle of connecting Claude.
 * It picks the saved request back up. The saved value is only ever followed if it is one of our own authorize addresses.
 */

import { NextRequest, NextResponse } from "next/server";
import { PENDING_CONNECT_COOKIE } from "@/lib/mcp/oauth/session";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const saved = request.cookies.get(PENDING_CONNECT_COOKIE)?.value ?? "";
  const ok = saved.startsWith("/oauth/authorize?") && saved.length < 4000 && !saved.includes("\\");
  const target = ok ? new URL(saved, request.url) : new URL("/admin/home", request.url);
  // A path that starts with /oauth/authorize? cannot change the host, but check anyway.
  const safeTarget = target.origin === new URL(request.url).origin ? target : new URL("/admin/home", request.url);
  const response = NextResponse.redirect(safeTarget, 303);
  response.cookies.set(PENDING_CONNECT_COOKIE, "", { path: "/", maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
