import { timingSafeEqual } from "node:crypto";

/**
 * Auth for the combined MCP endpoint (/api/mcp/all), which serves the checklist, tracker and workflow tools together.
 *
 * People normally connect through Claude sign-in (OAuth) and need no key. The key below is an OPTIONAL fallback for
 * scripts. It is deliberately its own key (COMBINED_MCP_API_KEY): the checklist, tracker and workflow keys each open
 * only their own area, so none of them is accepted here (that would let a tracker-only key change checklists).
 * Header only: addresses end up in logs.
 */

const MIN_KEY_LENGTH = 32;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function validateCombinedMcpAuth(request: Request): { valid: boolean; error?: string } {
  const apiKey = process.env.COMBINED_MCP_API_KEY;
  if (!apiKey) return { valid: false, error: "Sign in with Claude to use this connector (no API key is configured)" };
  if (apiKey.length < MIN_KEY_LENGTH) {
    return { valid: false, error: `COMBINED_MCP_API_KEY must be at least ${MIN_KEY_LENGTH} characters` };
  }
  const header = request.headers.get("authorization");
  if (header) {
    const [scheme, token] = header.split(" ");
    if (scheme === "Bearer" && token && safeEqual(token, apiKey)) return { valid: true };
  }
  return { valid: false, error: "Invalid or missing API key" };
}
