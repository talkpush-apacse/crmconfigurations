import { timingSafeEqual } from "node:crypto";

/**
 * Is this request really from Vercel's scheduler (or someone holding the secret)?
 * Vercel sends "Authorization: Bearer <CRON_SECRET>". With no secret configured nobody can be trusted, so everything is
 * refused: the "Bearer undefined" mistake (a missing setting turning into the text "undefined") can never let a caller in.
 */
export function cronAuthorised(authorizationHeader: string | null | undefined, secret: string | null | undefined): boolean {
  if (!secret || !authorizationHeader) return false;
  const given = Buffer.from(authorizationHeader);
  const wanted = Buffer.from(`Bearer ${secret}`);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}
