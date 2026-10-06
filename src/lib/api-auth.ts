import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./db";
import { verifyToken } from "./auth";
import { normaliseRole, READ_ONLY_MESSAGE, roleMayCall, type Role } from "./roles";

export interface AuthedUser {
  userId: string;
  email: string;
  role: Role;
}

/**
 * Who is this login, as the database says today? Looked up (not read from the sign-in cookie) so that changing a role,
 * or removing a login, takes effect straight away instead of when the cookie expires. Kept for a few seconds per server
 * instance so a busy page does not ask the database on every request; the Users screen clears it on every change.
 */
const CACHE_SECONDS = 15;
const cache = new Map<string, { user: AuthedUser | null; expires: number }>();

export function forgetUserAccess(userId?: string): void {
  if (userId) cache.delete(userId);
  else cache.clear();
}

export async function lookupUser(userId: string): Promise<AuthedUser | null> {
  const hit = cache.get(userId);
  if (hit && hit.expires > Date.now()) return hit.user;
  const row = await prisma.adminUser.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } });
  const user = row ? { userId: row.id, email: row.email, role: normaliseRole(row.role) } : null;
  cache.set(userId, { user, expires: Date.now() + CACHE_SECONDS * 1000 });
  return user;
}

/**
 * Verify authentication from request cookies and apply the role.
 * Returns the signed-in user, or a 401 (not signed in / login removed) or 403 (read-only login trying to change something).
 * Every route that needs a signed-in staff member calls this, so the read-only rule lives in exactly one place.
 */
export async function requireAuth(request: NextRequest): Promise<AuthedUser | NextResponse> {
  const token = request.cookies.get("admin_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const user = await lookupUser(payload.userId);
  if (!user) {
    return NextResponse.json({ error: "This login no longer has access. Please sign in again." }, { status: 401 });
  }

  if (!roleMayCall(user.role, request.method, request.nextUrl.pathname)) {
    return NextResponse.json({ error: READ_ONLY_MESSAGE, code: "read_only" }, { status: 403 });
  }

  return user;
}

/** For screens that are for editors only, even to look at (for example managing logins). */
export async function requireEditor(request: NextRequest): Promise<AuthedUser | NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "editor") {
    return NextResponse.json({ error: "Only Talkpush Admins can do this.", code: "read_only" }, { status: 403 });
  }
  return auth;
}
