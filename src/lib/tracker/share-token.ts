import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Secret client links. The raw token is shown to staff ONCE, when the link is
 * created; the database keeps only its SHA-256 hash (like a password), so a
 * database leak cannot be turned into working links.
 */

/** A recognisable prefix helps secret scanners. The prefix also keeps the two kinds of link apart. */
const PREFIXES = { viewer: "tpv_", contributor: "tpc_" } as const;
export type ShareKind = keyof typeof PREFIXES;

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateShareToken(kind: ShareKind = "viewer"): { token: string; hash: string; hint: string } {
  const prefix = PREFIXES[kind];
  const token = `${prefix}${randomBytes(32).toString("base64url")}`;
  return { token, hash: hashShareToken(token), hint: `${token.slice(0, prefix.length + 4)}...${token.slice(-4)}` };
}

/** Constant-time comparison of a presented token against a stored hash. */
export function tokenMatchesHash(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashShareToken(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function looksLikeShareToken(value: string, kind: ShareKind = "viewer"): boolean {
  const prefix = PREFIXES[kind];
  return value.startsWith(prefix) && value.length >= prefix.length + 40 && value.length <= 200 && /^[A-Za-z0-9_-]+$/.test(value);
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
