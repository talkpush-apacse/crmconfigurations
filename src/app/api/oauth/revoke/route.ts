/** Lets an app switch off its own connection (RFC 7009). Always answers 200 so it cannot be used to probe for tokens. */

import { clientIp, oauthJson, oauthPreflight } from "@/lib/mcp/oauth/http";
import { revokeByToken } from "@/lib/mcp/oauth/service";
import { createLimiter } from "@/lib/tracker/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const limiter = createLimiter(60, 60 * 1000);

export function OPTIONS() {
  return oauthPreflight();
}

export async function POST(request: Request) {
  if (!limiter.hit(clientIp(request))) return oauthJson({ error: "temporarily_unavailable" }, 429);
  try {
    const type = request.headers.get("content-type") ?? "";
    let token = "";
    if (type.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      token = typeof body?.token === "string" ? body.token : "";
    } else {
      const form = await request.formData().catch(() => null);
      const value = form?.get("token");
      token = typeof value === "string" ? value : "";
    }
    if (token && token.length <= 200) await revokeByToken(token);
  } catch (err) {
    console.error("[mcp-oauth-revoke] error:", err instanceof Error ? err.message : err);
  }
  return oauthJson({});
}
