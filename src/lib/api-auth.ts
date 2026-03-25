import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./auth";
import { prisma } from "./db";
import type { Role } from "./types";

/**
 * Verify authentication from request cookies.
 * Returns { userId, role } if authenticated, or a 401 NextResponse if not.
 */
export function requireAuth(
  request: NextRequest
): { userId: string; role: Role } | NextResponse {
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

  return { userId: payload.userId, role: payload.role };
}

/**
 * Require authentication AND one of the allowed roles.
 * Returns { userId, role } or a 401/403 NextResponse.
 */
export function requireRole(
  request: NextRequest,
  allowedRoles: Role[]
): { userId: string; role: Role } | NextResponse {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!allowedRoles.includes(auth.role)) {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  return auth;
}

/**
 * Check if a user is assigned to a specific checklist.
 */
export async function isAssignedTo(userId: string, checklistId: string): Promise<boolean> {
  const assignment = await prisma.checklistAssignment.findUnique({
    where: { userId_checklistId: { userId, checklistId } },
  });
  return !!assignment;
}
