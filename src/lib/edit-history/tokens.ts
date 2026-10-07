import { randomBytes } from "node:crypto";

/**
 * Named edit links. The link text is `cel_` + 256 random bits. It is stored as-is (not hashed) so staff can copy a
 * link again, the same as the original Checklist.editorToken. The `cel_` prefix lets the server tell the two kinds
 * apart without a second database lookup.
 */
export const EDIT_LINK_PREFIX = "cel_";

export function generateEditLinkToken(): string {
  return `${EDIT_LINK_PREFIX}${randomBytes(32).toString("base64url")}`;
}

/** Cheap shape check before any database call. Old links are UUIDs and do not match. */
export function looksLikeEditLinkToken(value: string): boolean {
  return value.startsWith(EDIT_LINK_PREFIX) && value.length >= 40 && value.length <= 120 && /^[A-Za-z0-9_-]+$/.test(value);
}

/** A person's name for a link: trimmed, one line, no control characters, 1-80 characters. Returns null if unusable. */
export function cleanLinkName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (name.length < 1 || name.length > 80) return null;
  return name;
}
