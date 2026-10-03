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
