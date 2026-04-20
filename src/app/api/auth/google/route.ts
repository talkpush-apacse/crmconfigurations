import { randomBytes } from "crypto";
import { OAuth2Client } from "google-auth-library";
import { NextRequest, NextResponse } from "next/server";

const GOOGLE_STATE_COOKIE = "admin_google_oauth_state";
const STATE_MAX_AGE_SECONDS = 10 * 60;

function getGoogleConfig(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    new URL("/api/auth/google/callback", request.url).toString();

  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

function redirectToLogin(request: NextRequest, error: string) {
  const url = new URL("/admin/login", request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const config = getGoogleConfig(request);
  if (!config) {
    return redirectToLogin(request, "google_config");
  }

  const state = randomBytes(32).toString("hex");
  const client = new OAuth2Client(
    config.clientId,
    config.clientSecret,
    config.redirectUri
  );
  const authorizationUrl = client.generateAuthUrl({
    scope: ["openid", "email", "profile"],
    state,
  });

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: STATE_MAX_AGE_SECONDS,
    path: "/api/auth/google",
  });

  return response;
}
