/**
 * A signed note that says "this exact Allow page was shown to this exact person a moment ago".
 * It stops another website from forging the Allow click: the forged form cannot know this value,
 * and it only works for the person, app, address and request it was made for.
 */

import { createHmac } from "node:crypto";
import { safeEqual } from "./crypto";

const LIFETIME_SECONDS = 10 * 60;

export interface ConsentFields {
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  scope: string;
}

function sign(secret: string, fields: ConsentFields, expiresAt: number): string {
  const body = JSON.stringify([
    fields.userId,
    fields.clientId,
    fields.redirectUri,
    fields.codeChallenge,
    fields.state,
    fields.scope,
    expiresAt,
  ]);
  return createHmac("sha256", `mcp-consent:${secret}`).update(body).digest("base64url");
}

export function makeConsentToken(secret: string, fields: ConsentFields, nowMs: number = Date.now()): string {
  const expiresAt = Math.floor(nowMs / 1000) + LIFETIME_SECONDS;
  return `${expiresAt}.${sign(secret, fields, expiresAt)}`;
}

export function verifyConsentToken(
  secret: string,
  token: string,
  fields: ConsentFields,
  nowMs: number = Date.now()
): boolean {
  const [expiry, mac, ...rest] = token.split(".");
  if (!expiry || !mac || rest.length > 0 || !/^\d{1,12}$/.test(expiry)) return false;
  const expiresAt = Number(expiry);
  const now = Math.floor(nowMs / 1000);
  if (expiresAt <= now || expiresAt > now + LIFETIME_SECONDS) return false;
  return safeEqual(mac, sign(secret, fields, expiresAt));
}
