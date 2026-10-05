/**
 * Where client links point.
 *
 * Staff use the Hub on its own address (APP_BASE_URL, for example https://crm.se-talkpush.com). Some client
 * networks only allow certain hosts, so CLIENT_LINK_BASE_URL can name a different address (for example
 * https://status.talkpush.com) that serves the same app. Links are built on that address when it is set,
 * and on the address the caller used when it is not.
 *
 * This file has no imports on purpose: the site gatekeeper (middleware.ts) runs on the edge and uses it too.
 */

export interface ClientLinkBase {
  /** https://host (no path, no trailing slash). */
  origin: string;
  host: string;
  /** True when CLIENT_LINK_BASE_URL supplied it; false when it is only the address the caller used. */
  configured: boolean;
}

/** An address the setting may hold: https (or http on localhost), no path, no login details. */
export function parseBaseUrl(value: string | undefined | null): { origin: string; host: string } | null {
  const raw = value?.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return null;
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) return null;
  return { origin: url.origin, host: url.host };
}

/**
 * The address client links are built on. Throws a plain message when the setting is filled in but is not a
 * usable address, so a typo is noticed before a link is created rather than quietly producing a wrong one.
 */
export function resolveClientLinkBase(fallbackOrigin: string | undefined, setting = process.env.CLIENT_LINK_BASE_URL): ClientLinkBase {
  if (setting?.trim()) {
    const parsed = parseBaseUrl(setting);
    if (!parsed) {
      throw new Error("The client link address setting (CLIENT_LINK_BASE_URL) is not a usable address. It must look like https://status.example.com with no path.");
    }
    return { ...parsed, configured: true };
  }
  const fallback = parseBaseUrl(fallbackOrigin);
  if (!fallback) throw new Error("Could not work out the address to build the link on.");
  return { ...fallback, configured: false };
}

/** For the staff screens, which are fine on the Hub's own address when no client address is set. */
export function clientLinkBase(fallbackOrigin: string): ClientLinkBase {
  return resolveClientLinkBase(fallbackOrigin);
}

export function clientPageUrl(base: ClientLinkBase, page: "share" | "contribute", token: string): string {
  return `${base.origin}/${page}/${token}`;
}

export function clientViewUrl(base: ClientLinkBase, token: string): string {
  return clientPageUrl(base, "share", token);
}

/** Said to staff when a link uses the Hub's own address, which some client networks block. */
export function hostWarning(base: ClientLinkBase): string | null {
  if (base.configured) return null;
  return (
    `This link uses ${base.host}, the address the Hub is reached on. Some client networks (TP Philippines, for one) block it. ` +
    "Once a client-friendly address such as a talkpush.com subdomain is set up, set CLIENT_LINK_BASE_URL and new links will use it."
  );
}

// ---------------------------------------------------------------------------
// the client-only address
// ---------------------------------------------------------------------------

/** What may be opened on the client-only address. Everything else there answers "not found". */
const CLIENT_HOST_PREFIXES = ["/share", "/api/share", "/contribute", "/api/contribute", "/w", "/api/w", "/_next"];
const CLIENT_HOST_FILES = new Set(["/favicon.ico", "/robots.txt"]);

export function pathAllowedOnClientHost(pathname: string): boolean {
  if (CLIENT_HOST_FILES.has(pathname)) return true;
  return CLIENT_HOST_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Is this request on the client-only address? Only when CLIENT_LINK_BASE_URL names a host that is NOT the staff
 * address (APP_BASE_URL), so setting both to the same address can never lock staff out.
 */
export function isClientOnlyHost(
  requestHost: string | null | undefined,
  clientSetting = process.env.CLIENT_LINK_BASE_URL,
  staffSetting = process.env.APP_BASE_URL
): boolean {
  const client = parseBaseUrl(clientSetting);
  if (!client || !requestHost) return false;
  if (requestHost.toLowerCase() !== client.host.toLowerCase()) return false;
  const staff = parseBaseUrl(staffSetting);
  if (staff && staff.host.toLowerCase() === client.host.toLowerCase()) return false;
  return true;
}
