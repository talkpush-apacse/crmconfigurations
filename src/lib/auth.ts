import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const WEAK_SECRETS = ["change-me-in-production", "secret", "admin", "password", "12345678", "changeme"];

function getJwtSecret(): string {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SECRET environment variable is required. Set it in your .env or Vercel environment.");
  }
  if (secret.length < 32) {
    throw new Error("ADMIN_SECRET must be at least 32 characters long. Use a random string.");
  }
  if (WEAK_SECRETS.includes(secret.toLowerCase())) {
    throw new Error("ADMIN_SECRET is too weak. Use a random 32+ character string.");
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash?: string | null): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

export function createToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export function setAdminSessionCookie(response: NextResponse, userId: string): void {
  response.cookies.set("admin_token", createToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });
}

export function clearAdminSessionCookie(response: NextResponse): void {
  response.cookies.set("admin_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

export async function getAuthUser(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  return verifyToken(token);
}
