import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Secret client links. The raw token is shown to staff ONCE, when the link is
 * created; the database keeps only its SHA-256 hash (like a password), so a
 * database leak cannot be turned into working links.
 */

const PREFIX = "tpv_"; // "Talkpush viewer"; a recognisable prefix helps secret scanners

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateShareToken(): { token: string; hash: string; hint: string } {
  const token = `${PREFIX}${randomBytes(32).toString("base64url")}`;
  return { token, hash: hashShareToken(token), hint: `${token.slice(0, PREFIX.length + 4)}...${token.slice(-4)}` };
}

/** Constant-time comparison of a presented token against a stored hash. */
export function tokenMatchesHash(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashShareToken(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function looksLikeShareToken(value: string): boolean {
  return value.startsWith(PREFIX) && value.length >= PREFIX.length + 40 && value.length <= 200 && /^[A-Za-z0-9_-]+$/.test(value);
}

export type LinkProblem = "revoked" | "expired" | "wrong_kind";

/** Is this link usable right now? Returns null when it is, otherwise why not. */
export function linkProblem(
  link: { kind: string; revokedAt: Date | null; expiresAt: Date | null },
  expectedKind: string,
  now: Date = new Date()
): LinkProblem | null {
  if (link.kind !== expectedKind) return "wrong_kind";
  if (link.revokedAt) return "revoked";
  if (link.expiresAt && link.expiresAt.getTime() <= now.getTime()) return "expired";
  return null;
}
