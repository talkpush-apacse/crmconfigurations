import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { SECRET_PREFIX } from "./constants";

type SecretKind = keyof typeof SECRET_PREFIX;

/** A new random secret: 256 bits, URL-safe, with a prefix that says what it is. */
export function newSecret(kind: SecretKind): string {
  return SECRET_PREFIX[kind] + randomBytes(32).toString("base64url");
}

/** Secrets are stored only as this hash. They are random, so a plain SHA-256 is enough. */
export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function looksLikeAccessToken(value: string): boolean {
  return value.startsWith(SECRET_PREFIX.accessToken);
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// ---------------------------------------------------------------------------
// PKCE (S256 only). The app proves it is the one that started the sign-in.
// ---------------------------------------------------------------------------

/** A SHA-256 hash in base64url is always 43 characters. */
export function isValidCodeChallenge(challenge: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(challenge);
}

const VERIFIER_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/;

export function challengeFromVerifier(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!VERIFIER_PATTERN.test(verifier)) return false;
  return safeEqual(challengeFromVerifier(verifier), challenge);
}
