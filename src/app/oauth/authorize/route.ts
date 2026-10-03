/**
 * Where Claude sends a person to connect. This only checks the request and routes the person:
 *   not signed in  -> remember the request, send them to the normal admin login
 *   signed in      -> the Allow page
 * Requests from an unknown app or to an unregistered address get an error page, never a redirect.
 */

import { NextRequest, NextResponse } from "next/server";
import { connectErrorPage } from "@/lib/mcp/oauth/error-page";
import { OAuthError } from "@/lib/mcp/oauth/errors";
import { adminFromSessionCookie, PENDING_CONNECT_COOKIE } from "@/lib/mcp/oauth/session";
import { validateAuthorizeRequest } from "@/lib/mcp/oauth/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function redirectWithError(redirectUri: string, state: string | null, error: OAuthError) {
  const target = new URL(redirectUri);
  target.searchParams.set("error", error.code);
  target.searchParams.set("error_description", error.description);
  if (state) target.searchParams.set("state", state);
  return NextResponse.redirect(target, 303);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const q = url.searchParams;
  const state = q.get("state");
  const redirectUri = q.get("redirect_uri") ?? "";

  try {
    // The app and the return address must pass these checks before anything is ever sent to that address.
    await validateAuthorizeRequest({
      clientId: q.get("client_id") ?? "",
      redirectUri,
      codeChallenge: q.get("code_challenge") ?? "",
      codeChallengeMethod: q.get("code_challenge_method") ?? "",
      scope: q.get("scope") ?? undefined,
    });
    if (q.get("response_type") !== "code") throw new OAuthError("invalid_request", "response_type must be code.");
  } catch (err) {
    if (!(err instanceof OAuthError)) {
      console.error("[mcp-oauth-authorize] unexpected error:", err instanceof Error ? err.message : err);
      return connectErrorPage("Something went wrong on our side.", 500);
    }
    // Errors about the app or its address are shown here. Anything else came after those checks passed,
    // so the address is trusted and the error goes back to the app, as the standard asks.
    if (err.code === "invalid_client" || err.code === "invalid_redirect_uri") return connectErrorPage(err.description);
    return redirectWithError(redirectUri, state, err);
  }

  const admin = await adminFromSessionCookie(request.cookies.get("admin_token")?.value);
  if (!admin) {
    const response = NextResponse.redirect(new URL("/admin/login", request.url), 303);
    response.cookies.set(PENDING_CONNECT_COOKIE, `${url.pathname}${url.search}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60,
      path: "/",
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const consent = new URL("/oauth/consent", request.url);
  consent.search = url.search;
  const response = NextResponse.redirect(consent, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
