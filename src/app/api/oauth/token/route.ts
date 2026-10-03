/** Swaps a one-time code, or a refresh token, for tokens (RFC 6749 section 4.1.3 and 6). */

import { createLimiter } from "@/lib/tracker/rate-limit";
import { OAuthError } from "@/lib/mcp/oauth/errors";
import { clientIp, oauthErrorResponse, oauthJson, oauthPreflight } from "@/lib/mcp/oauth/http";
import { exchangeAuthCode, refreshTokens } from "@/lib/mcp/oauth/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const limiter = createLimiter(60, 60 * 1000);

export function OPTIONS() {
  return oauthPreflight();
}

/** Token requests are form-encoded by the standard; accept JSON too, since some tools send it. */
async function readParams(request: Request): Promise<Record<string, string>> {
  const type = request.headers.get("content-type") ?? "";
  const out: Record<string, string> = {};
  if (type.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body === "object") {
      for (const [k, v] of Object.entries(body)) if (typeof v === "string") out[k] = v;
    }
    return out;
  }
  const form = await request.formData().catch(() => null);
  if (form) for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

export async function POST(request: Request) {
  try {
    if (!limiter.hit(clientIp(request))) {
      throw new OAuthError("temporarily_unavailable", "Too many requests. Try again shortly.", 429);
    }
    const p = await readParams(request);
    const need = (name: string) => {
      const value = p[name];
      if (!value) throw new OAuthError("invalid_request", `Missing ${name}.`);
      return value;
    };

    if (p.grant_type === "authorization_code") {
      return oauthJson(
        await exchangeAuthCode({
          code: need("code"),
          clientId: need("client_id"),
          redirectUri: need("redirect_uri"),
          codeVerifier: need("code_verifier"),
        })
      );
    }
    if (p.grant_type === "refresh_token") {
      return oauthJson(await refreshTokens({ refreshToken: need("refresh_token"), clientId: need("client_id") }));
    }
    throw new OAuthError("unsupported_grant_type", "Use authorization_code or refresh_token.");
  } catch (err) {
    return oauthErrorResponse(err, "mcp-oauth-token");
  }
}
