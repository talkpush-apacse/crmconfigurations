import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Secret links for the Workflow Builder. The raw link is shown to staff ONCE, when it is created; the database
 * keeps only its SHA-256 hash, so a database leak cannot be turned into working links. 256 random bits.
 * (Same approach as the Project Tracker's client links, with its own prefixes so a link for one cannot be
 * mistaken for the other.)
 */

export type TokenKind = "link" | "member";

const PREFIX: Record<TokenKind, string> = {
  link: "wfl_", // a shared View / Comment / Edit link
  member: "wfm_", // a named invite (one person)
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken(kind: TokenKind): { token: string; hash: string; hint: string } {
  const token = `${PREFIX[kind]}${randomBytes(32).toString("base64url")}`;
  return { token, hash: hashToken(token), hint: `${token.slice(0, 8)}...${token.slice(-4)}` };
}

/** Which kind of link does this look like? null when it is not one of ours (cheap check before any database call). */
export function tokenKindOf(value: string): TokenKind | null {
  if (value.length < 40 || value.length > 200 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  if (value.startsWith(PREFIX.link)) return "link";
  if (value.startsWith(PREFIX.member)) return "member";
  return null;
}

/** Constant-time comparison of a presented token against a stored hash. */
export function tokenMatchesHash(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---- optional passcode on a shared link ----------------------------------------------------------

/** "scrypt$<salt>$<hash>". A passcode is short and human, so it is slow-hashed and salted (unlike a random token). */
export function hashPasscode(passcode: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(passcode, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function passcodeMatches(passcode: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(passcode, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
