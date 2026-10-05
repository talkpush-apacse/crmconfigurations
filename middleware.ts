import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { isClientOnlyHost, pathAllowedOnClientHost } from "@/lib/tracker/client-link-url";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The client-only address (CLIENT_LINK_BASE_URL) serves client link pages and nothing else.
  if (isClientOnlyHost(request.headers.get("host")) && !pathAllowedOnClientHost(pathname)) {
    return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  // Protect /admin/* but allow /admin/login through unauthenticated
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const token = request.cookies.get("admin_token")?.value;

    if (!token) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      console.error("[middleware] ADMIN_SECRET environment variable is not set — blocking all admin access");
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    try {
      const secret = new TextEncoder().encode(adminSecret);
      await jwtVerify(token, secret);
    } catch {
      // Token invalid or expired — redirect to login
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // Every page and API route (so the client-only address can be enforced), but not Next.js's own build files.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
