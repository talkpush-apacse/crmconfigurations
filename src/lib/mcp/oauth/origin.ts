/** The public address of this server as the caller used it (https://crm.se-talkpush.com, a preview URL, localhost). */
export function originOf(request: Request): string {
  const url = new URL(request.url);
  const safe = (value: string | null, fallback: string) => {
    const first = value?.split(",")[0]?.trim();
    return first && /^[A-Za-z0-9.\-:[\]]+$/.test(first) ? first : fallback;
  };
  const host = safe(request.headers.get("x-forwarded-host"), url.host);
  const proto = safe(request.headers.get("x-forwarded-proto"), url.protocol.replace(":", ""));
  return `${proto}://${host}`;
}

/**
 * Did an Allow / Cancel click come from our own page? The Allow page sends `Referrer-Policy: no-referrer`, and under that
 * policy browsers (Chrome, Firefox) label a form post `Origin: null` even though it is our own page. So "null" is accepted:
 * the signed note on the form is what stops a forged click, and a request the browser itself marks cross-site is still refused.
 * No Origin header at all (older browsers, tools) is accepted for the same reason.
 */
export function isOwnPageClick(request: Request, ownOrigin: string): boolean {
  const sentFrom = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  if (!sentFrom || sentFrom === "null") return true;
  return sentFrom === ownOrigin;
}
