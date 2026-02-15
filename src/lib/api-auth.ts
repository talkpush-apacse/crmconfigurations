import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./auth";

/**
 * Verify admin authentication from request cookies.
 * Returns the userId if authenticated, or a 401 NextResponse if not.
 */
export function requireAuth(
  request: NextRequest
): { userId: string } | NextResponse {
  const token = request.cookies.get("admin_token")?.value;

  if (!token) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }

  return { userId: payload.userId };
}
