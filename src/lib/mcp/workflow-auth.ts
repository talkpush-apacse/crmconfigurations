import { timingSafeEqual } from "node:crypto";

/**
 * Auth for the Workflow Builder MCP endpoint (/api/mcp/workflows).
 *
 * Its own key (WORKFLOW_MCP_API_KEY), separate from the checklist and tracker keys, so each can be rotated on
 * its own. Header only: unlike the older endpoints it does NOT accept the key in the web address, because
 * addresses end up in logs. People who connect through Claude sign-in (OAuth) do not use a key at all.
 */

const MIN_KEY_LENGTH = 32;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function validateWorkflowMcpAuth(request: Request): { valid: boolean; error?: string } {
  const apiKey = process.env.WORKFLOW_MCP_API_KEY;
  if (!apiKey) return { valid: false, error: "WORKFLOW_MCP_API_KEY is not configured on the server" };
  if (apiKey.length < MIN_KEY_LENGTH) {
    return { valid: false, error: `WORKFLOW_MCP_API_KEY must be at least ${MIN_KEY_LENGTH} characters` };
  }
  const header = request.headers.get("authorization");
  if (header) {
    const [scheme, token] = header.split(" ");
    if (scheme === "Bearer" && token && safeEqual(token, apiKey)) return { valid: true };
  }
  return { valid: false, error: "Invalid or missing API key" };
}
