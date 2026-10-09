/**
 * Shared auth check for Vercel Cron routes.
 *
 * Returns a 401 Response when the request must be rejected, or null when the
 * caller may proceed. If CRON_SECRET is unset the check fails closed — without
 * the `!secret` guard the template string would become "Bearer undefined" and
 * a request sending exactly that header would be accepted.
 */
export function rejectUnlessCron(request: Request): Response | null {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}
