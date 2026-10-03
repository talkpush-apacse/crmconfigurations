/**
 * Where an app may be sent back to after "Allow". This is the main defence against a fake app
 * tricking someone into sending their code to an attacker, so the rules are strict:
 *   - Claude's own web callbacks (exact match), plus any exact addresses listed in MCP_OAUTH_EXTRA_REDIRECTS
 *   - loopback addresses (http://localhost, 127.0.0.1, [::1]) for Claude Code, Desktop and local tools; any port
 *   - nothing else, no fragments, no embedded passwords
 */

const FIXED_ALLOWED = [
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
];

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function parse(uri: string): URL | null {
  try {
    return new URL(uri);
  } catch {
    return null;
  }
}

function isLoopback(url: URL): boolean {
  return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
}

export function extraAllowedRedirects(env: string | undefined = process.env.MCP_OAUTH_EXTRA_REDIRECTS): string[] {
  return (env ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAllowedRedirectUri(uri: string, extra: string[] = extraAllowedRedirects()): boolean {
  if (uri.length > 2000) return false;
  const url = parse(uri);
  if (!url) return false;
  if (url.hash || url.username || url.password) return false;
  if (isLoopback(url)) return true;
  if (url.protocol !== "https:") return false;
  return FIXED_ALLOWED.includes(uri) || extra.includes(uri);
}

/**
 * Is the address in this request one the app registered? Exact match, except that loopback addresses
 * may use a different port each time (the standard for local apps).
 */
export function redirectMatchesRegistered(requested: string, registered: string[]): boolean {
  if (registered.includes(requested)) return true;
  const want = parse(requested);
  if (!want || !isLoopback(want)) return false;
  return registered.some((r) => {
    const have = parse(r);
    return !!have && isLoopback(have) && have.hostname === want.hostname && have.pathname === want.pathname;
  });
}

/** What to show a person on the Allow page, so they can see where they will be sent. */
export function redirectHost(uri: string): string {
  return parse(uri)?.host ?? "unknown";
}
