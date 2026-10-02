import { timingSafeEqual } from "node:crypto";

/**
 * Auth for the Project Tracker MCP endpoint.
 *
 * Deliberately a SEPARATE key (TRACKER_MCP_API_KEY) from the checklist MCP key,
 * so tracker access can be rotated or revoked without breaking checklist
 * automation, and the reverse. Accepts a Bearer header, or ?api_key= for the
 * Claude custom-connector format. Compared in constant time.
 */

const MIN_KEY_LENGTH = 24;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function validateTrackerMcpAuth(request: Request): { valid: boolean; error?: string } {
  const apiKey = process.env.TRACKER_MCP_API_KEY;
  if (!apiKey) return { valid: false, error: "TRACKER_MCP_API_KEY is not configured on the server" };
  if (apiKey.length < MIN_KEY_LENGTH) {
    return { valid: false, error: `TRACKER_MCP_API_KEY must be at least ${MIN_KEY_LENGTH} characters` };
  }

  const header = request.headers.get("authorization");
  if (header) {
    const [scheme, token] = header.split(" ");
    if (scheme === "Bearer" && token && safeEqual(token, apiKey)) return { valid: true };
  }
  const queryKey = new URL(request.url).searchParams.get("api_key");
  if (queryKey && safeEqual(queryKey, apiKey)) return { valid: true };

  return { valid: false, error: "Invalid or missing API key" };
}
