/** Is this the cookie of a signed-in admin, and who are they? Uses the same session as the website. */

import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/auth";

export interface SignedInAdmin {
  id: string;
  email: string;
}

export async function adminFromSessionCookie(cookieValue: string | undefined): Promise<SignedInAdmin | null> {
  if (!cookieValue) return null;
  const payload = verifyToken(cookieValue);
  if (!payload) return null;
  const user = await prisma.adminUser.findUnique({ where: { id: payload.userId }, select: { id: true, email: true } });
  return user ?? null;
}

/** Name of the short-lived cookie that remembers an unfinished connect request while someone signs in. */
export const PENDING_CONNECT_COOKIE = "mcp_oauth_pending";
