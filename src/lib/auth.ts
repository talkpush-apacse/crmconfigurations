import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
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

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch {
    return null;
  }
}

export async function getAuthUser(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}
