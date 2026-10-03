import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * A visitor who opens a shared link (not a named invite) is a "guest". The first time, they type a name; we keep
 * a signed cookie so their comments and edits carry that name. The name is self-declared, so it is always shown
 * as unverified. The cookie is signed with the server secret so nobody can edit it to impersonate someone else.
 */

export const GUEST_COOKIE = "wf_guest";

export interface GuestIdentity {
  id: string;
  name: string;
  email?: string;
}

function secret(): string {
  const s = process.env.ADMIN_SECRET;
  if (!s) throw new Error("ADMIN_SECRET is required");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(`wf-guest:${payload}`).digest("base64url");
}

export function newGuest(name: string, email?: string): GuestIdentity {
  return { id: randomBytes(9).toString("base64url"), name: name.trim().slice(0, 80), email: email?.trim().slice(0, 120) || undefined };
}

export function encodeGuestCookie(guest: GuestIdentity): string {
  const payload = Buffer.from(JSON.stringify(guest)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeGuestCookie(value: string | undefined | null): GuestIdentity | null {
  if (!value) return null;
  const [payload, mac] = value.split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const g = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as GuestIdentity;
    return typeof g.id === "string" && typeof g.name === "string" && g.name.trim() ? g : null;
  } catch {
    return null;
  }
}
