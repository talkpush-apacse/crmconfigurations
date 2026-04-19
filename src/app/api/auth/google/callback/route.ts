import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { createToken } from "@/lib/auth";

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
);

const UNAUTHORIZED = NextResponse.redirect(
  new URL("/admin/login?error=unauthorized", process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000")
);

function redirectUnauthorized(baseUrl: string) {
  return NextResponse.redirect(new URL("/admin/login?error=unauthorized", baseUrl));
}

function redirectAdmin(baseUrl: string) {
  return NextResponse.redirect(new URL("/admin", baseUrl));
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");

  const stateCookie = request.cookies.get("oauth_state")?.value;

  // Clear the state cookie immediately regardless of outcome
  const clearStateCookie = (response: NextResponse) => {
    response.cookies.set("oauth_state", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
    return response;
  };

  // CSRF check
  if (!stateParam || !stateCookie || stateParam !== stateCookie) {
    return clearStateCookie(redirectUnauthorized(origin));
  }

  if (!code) {
    return clearStateCookie(redirectUnauthorized(origin));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return clearStateCookie(redirectUnauthorized(origin));
  }

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      console.error("Google token exchange failed:", await tokenRes.text());
      return clearStateCookie(redirectUnauthorized(origin));
    }

    const tokenData = await tokenRes.json() as { id_token?: string };
    const idToken = tokenData.id_token;

    if (!idToken) {
      return clearStateCookie(redirectUnauthorized(origin));
    }

    // Verify ID token using Google's JWKS
    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: clientId,
    });

    const email = payload["email"] as string | undefined;
    const sub = payload["sub"] as string | undefined;

    if (!email || !sub) {
      return clearStateCookie(redirectUnauthorized(origin));
    }

    // Look up admin by email — never create new users via OAuth
    const user = await prisma.adminUser.findUnique({ where: { email } });

    if (!user) {
      return clearStateCookie(redirectUnauthorized(origin));
    }

    if (user.googleId !== null && user.googleId !== sub) {
      // googleId is linked to a different Google account
      return clearStateCookie(redirectUnauthorized(origin));
    }

    if (user.googleId === null) {
      // First-time Google login: link the Google sub to this admin
      await prisma.adminUser.update({
        where: { id: user.id },
        data: { googleId: sub },
      });
    }

    // Issue the same JWT session cookie as the password login flow
    const token = createToken(user.id);

    const response = redirectAdmin(origin);
    clearStateCookie(response);
    response.cookies.set("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return clearStateCookie(redirectUnauthorized(origin));
  }
}
