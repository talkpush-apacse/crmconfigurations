import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  challengeFromVerifier,
  hashSecret,
  isValidCodeChallenge,
  looksLikeAccessToken,
  newSecret,
  verifyPkce,
} from "../src/lib/mcp/oauth/crypto";
import { isAllowedRedirectUri, redirectHost, redirectMatchesRegistered } from "../src/lib/mcp/oauth/redirect";
import { authorizationServerMetadata, protectedResourceMetadata, wwwAuthenticate } from "../src/lib/mcp/oauth/metadata";
import { OAuthError } from "../src/lib/mcp/oauth/errors";

// RFC 7636 appendix B test vector
const RFC_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const RFC_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

test("pkce: the standard's own example verifies, and a different verifier does not", () => {
  assert.equal(challengeFromVerifier(RFC_VERIFIER), RFC_CHALLENGE);
  assert.equal(verifyPkce(RFC_VERIFIER, RFC_CHALLENGE), true);
  assert.equal(verifyPkce(RFC_VERIFIER.replace(/.$/, "A"), RFC_CHALLENGE), false);
});

test("pkce: a verifier that is too short or has odd characters is refused", () => {
  assert.equal(verifyPkce("short", challengeFromVerifier("short")), false);
  const odd = "a".repeat(42) + " ";
  assert.equal(verifyPkce(odd, challengeFromVerifier(odd)), false);
  assert.equal(verifyPkce("", ""), false);
});

test("pkce: a challenge must be 43 URL-safe characters", () => {
  assert.equal(isValidCodeChallenge(RFC_CHALLENGE), true);
  assert.equal(isValidCodeChallenge(RFC_CHALLENGE + "="), false);
  assert.equal(isValidCodeChallenge("plain-text-challenge"), false);
  assert.equal(isValidCodeChallenge(""), false);
});

test("secrets: random, prefixed, URL-safe, and only a hash is kept", () => {
  const a = newSecret("accessToken");
  const b = newSecret("accessToken");
  assert.notEqual(a, b);
  assert.ok(looksLikeAccessToken(a));
  assert.ok(!looksLikeAccessToken(newSecret("refreshToken")));
  assert.match(a, /^mcp_at_[A-Za-z0-9_-]{43}$/, "32 random bytes, no + or / to break a URL");
  assert.equal(hashSecret(a), createHash("sha256").update(a).digest("hex"));
  assert.notEqual(hashSecret(a), a);
  assert.match(newSecret("authCode"), /^mcp_ac_/);
});

test("redirects: Claude's web callbacks and local apps are allowed", () => {
  assert.equal(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback", []), true);
  assert.equal(isAllowedRedirectUri("https://claude.com/api/mcp/auth_callback", []), true);
  assert.equal(isAllowedRedirectUri("http://localhost:54321/callback", []), true);
  assert.equal(isAllowedRedirectUri("http://127.0.0.1:8080/oauth/callback", []), true);
  assert.equal(isAllowedRedirectUri("http://[::1]:9000/cb", []), true);
});

test("redirects: lookalikes, other sites, plain http and sneaky forms are refused", () => {
  const bad = [
    "https://evil.example/api/mcp/auth_callback",
    "https://claude.ai.evil.example/api/mcp/auth_callback",
    "https://claude.ai/api/mcp/auth_callback/extra",
    "https://claude.ai/other",
    "http://claude.ai/api/mcp/auth_callback",
    "https://claude.ai@evil.example/api/mcp/auth_callback",
    "https://user:pw@claude.ai/api/mcp/auth_callback",
    "https://claude.ai/api/mcp/auth_callback#frag",
    "http://localhost.evil.example/cb",
    "http://example.com/cb",
    "javascript:alert(1)",
    "claude://callback",
    "not a url",
    "",
    "https://claude.ai/api/mcp/auth_callback?x=" + "a".repeat(2100),
  ];
  for (const uri of bad) assert.equal(isAllowedRedirectUri(uri, []), false, `should refuse: ${uri.slice(0, 60)}`);
});

test("redirects: extra addresses must be listed exactly", () => {
  const extra = ["https://app.example.com/callback"];
  assert.equal(isAllowedRedirectUri("https://app.example.com/callback", extra), true);
  assert.equal(isAllowedRedirectUri("https://app.example.com/callback2", extra), false);
  assert.equal(isAllowedRedirectUri("https://app.example.com/callback", []), false);
});

test("redirects: a registered address matches exactly; local apps may change port only", () => {
  const web = ["https://claude.ai/api/mcp/auth_callback"];
  assert.equal(redirectMatchesRegistered("https://claude.ai/api/mcp/auth_callback", web), true);
  assert.equal(redirectMatchesRegistered("https://claude.com/api/mcp/auth_callback", web), false);

  const local = ["http://localhost:1111/callback"];
  assert.equal(redirectMatchesRegistered("http://localhost:2222/callback", local), true);
  assert.equal(redirectMatchesRegistered("http://localhost:2222/other", local), false);
  assert.equal(redirectMatchesRegistered("http://127.0.0.1:2222/callback", local), false);
});

test("redirects: the Allow page can show the destination host", () => {
  assert.equal(redirectHost("https://claude.ai/api/mcp/auth_callback"), "claude.ai");
  assert.equal(redirectHost("nonsense"), "unknown");
});

test("metadata: sign-in documents point at this server and require PKCE S256", () => {
  const origin = "https://crm.se-talkpush.com";
  const as = authorizationServerMetadata(origin);
  assert.equal(as.issuer, origin);
  assert.equal(as.authorization_endpoint, `${origin}/oauth/authorize`);
  assert.equal(as.token_endpoint, `${origin}/api/oauth/token`);
  assert.equal(as.registration_endpoint, `${origin}/api/oauth/register`);
  assert.deepEqual(as.code_challenge_methods_supported, ["S256"]);
  assert.deepEqual(as.token_endpoint_auth_methods_supported, ["none"]);

  const prm = protectedResourceMetadata(origin, "/api/mcp/tracker");
  assert.equal(prm.resource, `${origin}/api/mcp/tracker`);
  assert.deepEqual(prm.authorization_servers, [origin]);
  assert.equal(
    wwwAuthenticate(origin, "/api/mcp/tracker"),
    `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/api/mcp/tracker"`
  );
});

test("errors: carry a standard code and a message safe to show", () => {
  const err = new OAuthError("invalid_grant", "That code is invalid, expired or already used.");
  assert.deepEqual(err.toJSON(), { error: "invalid_grant", error_description: "That code is invalid, expired or already used." });
  assert.equal(err.status, 400);
});

// ---------------------------------------------------------------------------
// the signed note that stops a forged Allow click
// ---------------------------------------------------------------------------

import { makeConsentToken, verifyConsentToken, type ConsentFields } from "../src/lib/mcp/oauth/consent-token";
import { originOf } from "../src/lib/mcp/oauth/origin";

const SECRET = "s".repeat(40);
const FIELDS: ConsentFields = {
  userId: "user_1",
  clientId: "client_1",
  redirectUri: "https://claude.ai/api/mcp/auth_callback",
  codeChallenge: RFC_CHALLENGE,
  state: "abc123",
  scope: "mcp",
};

test("consent token: works for the exact person, app, address and request it was made for", () => {
  const token = makeConsentToken(SECRET, FIELDS);
  assert.equal(verifyConsentToken(SECRET, token, FIELDS), true);
});

test("consent token: changing anything it covers makes it fail", () => {
  const token = makeConsentToken(SECRET, FIELDS);
  for (const change of [
    { userId: "user_2" },
    { clientId: "client_2" },
    { redirectUri: "https://claude.com/api/mcp/auth_callback" },
    { codeChallenge: "A".repeat(43) },
    { state: "other" },
    { scope: "mcp extra" },
  ]) {
    assert.equal(verifyConsentToken(SECRET, token, { ...FIELDS, ...change }), false, JSON.stringify(change));
  }
  assert.equal(verifyConsentToken("t".repeat(40), token, FIELDS), false, "a different server secret must fail");
});

test("consent token: expires after ten minutes, and cannot be pre-dated", () => {
  const now = Date.now();
  const token = makeConsentToken(SECRET, FIELDS, now);
  assert.equal(verifyConsentToken(SECRET, token, FIELDS, now + 9 * 60_000), true);
  assert.equal(verifyConsentToken(SECRET, token, FIELDS, now + 11 * 60_000), false);
  const [, mac] = token.split(".");
  const farFuture = `${Math.floor(now / 1000) + 24 * 3600}.${mac}`;
  assert.equal(verifyConsentToken(SECRET, farFuture, FIELDS, now), false);
});

test("consent token: garbage is refused without throwing", () => {
  for (const junk of ["", "x", "1.2.3", "abc.def", `${Math.floor(Date.now() / 1000) + 60}.`, "9".repeat(20) + ".x"]) {
    assert.equal(verifyConsentToken(SECRET, junk, FIELDS), false, junk);
  }
});

test("origin: follows the forwarded host the way Vercel sets it, and ignores odd values", () => {
  const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });
  assert.equal(originOf(req("http://localhost:3000/x")), "http://localhost:3000");
  assert.equal(
    originOf(req("https://internal.vercel/x", { "x-forwarded-host": "crm.se-talkpush.com", "x-forwarded-proto": "https" })),
    "https://crm.se-talkpush.com"
  );
  assert.equal(originOf(req("https://real.example/x", { "x-forwarded-host": "evil.example/<script>" })), "https://real.example");
});
