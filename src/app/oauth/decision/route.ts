/**
 * Handles the Allow / Cancel click. The click only counts if all of these hold:
 *   - it came from our own Allow page (Origin check plus a signed note tied to this person and request)
 *   - the person is still signed in
 *   - the app and return address still pass every check
 * Then the person is sent back to the app with a one-time code (Allow) or an "access_denied" error (Cancel).
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyConsentToken, type ConsentFields } from "@/lib/mcp/oauth/consent-token";
import { connectErrorPage } from "@/lib/mcp/oauth/error-page";
import { OAuthError } from "@/lib/mcp/oauth/errors";
import { originOf } from "@/lib/mcp/oauth/origin";
import { createAuthCode, validateAuthorizeRequest } from "@/lib/mcp/oauth/service";
import { adminFromSessionCookie } from "@/lib/mcp/oauth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function backToApp(redirectUri: string, params: Record<string, string>) {
  const target = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v) target.searchParams.set(k, v);
  const response = NextResponse.redirect(target, 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function POST(request: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return connectErrorPage("Something went wrong on our side.", 500);

  const sentFrom = request.headers.get("origin");
  if (sentFrom && sentFrom !== originOf(request)) {
    return connectErrorPage("This request did not come from our own page.", 403);
  }

  const form = await request.formData().catch(() => null);
  const text = (name: string) => {
    const value = form?.get(name);
    return typeof value === "string" ? value : "";
  };

  const admin = await adminFromSessionCookie(request.cookies.get("admin_token")?.value);
  if (!admin) return connectErrorPage("Your sign-in expired. Start the connection again from Claude.", 401);

  const fields: ConsentFields = {
    userId: admin.id,
    clientId: text("client_id"),
    redirectUri: text("redirect_uri"),
    codeChallenge: text("code_challenge"),
    state: text("state"),
    scope: text("scope"),
  };
  if (!verifyConsentToken(secret, text("consent"), fields)) {
    return connectErrorPage("This Allow page has expired or was not ours. Start the connection again from Claude.", 403);
  }

  const authorize = { ...fields, codeChallengeMethod: text("code_challenge_method"), scope: fields.scope || undefined };
  try {
    if (text("decision") !== "allow") {
      await validateAuthorizeRequest(authorize); // the return address must be trusted before we send anyone there
      return backToApp(fields.redirectUri, { error: "access_denied", error_description: "The person chose not to connect.", state: fields.state });
    }
    const code = await createAuthCode({ ...authorize, adminUserId: admin.id });
    return backToApp(fields.redirectUri, { code, state: fields.state });
  } catch (err) {
    if (err instanceof OAuthError) return connectErrorPage(err.description);
    console.error("[mcp-oauth-decision] unexpected error:", err instanceof Error ? err.message : err);
    return connectErrorPage("Something went wrong on our side.", 500);
  }
}
