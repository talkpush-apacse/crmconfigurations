import { OAuth2Client } from "google-auth-library";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setAdminSessionCookie } from "@/lib/auth";

const GOOGLE_STATE_COOKIE = "admin_google_oauth_state";

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
  const response = NextResponse.redirect(url);
  clearStateCookie(response);
  return response;
}

function clearStateCookie(response: NextResponse) {
  response.cookies.set(GOOGLE_STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/api/auth/google",
  });
}

export async function GET(request: NextRequest) {
  const config = getGoogleConfig(request);
  if (!config) {
    return redirectToLogin(request, "google_config");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;

  if (!code || !state || !storedState || state !== storedState) {
    return redirectToLogin(request, "oauth_state");
  }

  try {
    const client = new OAuth2Client(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
    const { tokens } = await client.getToken(code);

    if (!tokens.id_token) {
      return redirectToLogin(request, "unauthorized");
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: config.clientId,
    });
    const payload = ticket.getPayload();
    const email = payload?.email;
    const googleId = payload?.sub;

    if (!email || !googleId || payload?.email_verified === false) {
      return redirectToLogin(request, "unauthorized");
    }

    const existingAdmin = await prisma.adminUser.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });

    if (!existingAdmin) {
      return redirectToLogin(request, "unauthorized");
    }

    if (existingAdmin.googleId && existingAdmin.googleId !== googleId) {
      return redirectToLogin(request, "unauthorized");
    }

    const adminUser = existingAdmin.googleId
      ? existingAdmin
      : await prisma.adminUser.update({
          where: { id: existingAdmin.id },
          data: { googleId },
        });

    const response = NextResponse.redirect(new URL("/admin", request.url));
    clearStateCookie(response);
    setAdminSessionCookie(response, adminUser.id);
    return response;
  } catch (err) {
    console.error("GET /api/auth/google/callback error:", err);
    return redirectToLogin(request, "unauthorized");
  }
}
