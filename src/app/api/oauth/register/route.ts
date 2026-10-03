/** Lets an app (Claude) register itself, so nobody has to create a client id by hand (RFC 7591). */

import { createLimiter } from "@/lib/tracker/rate-limit";
import { OAuthError } from "@/lib/mcp/oauth/errors";
import { clientIp, oauthErrorResponse, oauthJson, oauthPreflight } from "@/lib/mcp/oauth/http";
import { registerClient } from "@/lib/mcp/oauth/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Best effort per running instance, like the client share links. The redirect allow-list and the
// person-must-click-Allow rule are the real protection.
const limiter = createLimiter(20, 60 * 60 * 1000);

export function OPTIONS() {
  return oauthPreflight();
}

export async function POST(request: Request) {
  try {
    if (!limiter.hit(clientIp(request))) {
      throw new OAuthError("temporarily_unavailable", "Too many registrations. Try again later.", 429);
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new OAuthError("invalid_client_metadata", "Send the registration as JSON.");
    }
    return oauthJson(await registerClient(body), 201);
  } catch (err) {
    return oauthErrorResponse(err, "mcp-oauth-register");
  }
}
