/**
 * Plays an attacker and a normal app against the Claude connector sign-in service (src/lib/mcp/oauth/service.ts).
 * Needs a LOCAL database that already has the McpOAuthClient / McpAuthCode / McpToken tables:
 *
 *   DATABASE_URL_DIRECT=postgresql://localhost:54329/tracker_dev npx tsx scripts/check-mcp-oauth-service.ts
 *
 * Refuses to run against anything but localhost. Creates a throwaway admin user and apps and removes them again.
 */
import { createHash, randomBytes } from "node:crypto";

const url = process.env.DATABASE_URL_DIRECT ?? "";
let host = "";
try {
  host = new URL(url).hostname;
} catch {
  /* handled below */
}
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
  console.error(`Refusing to run: set DATABASE_URL_DIRECT to a local database (got host "${host || "none"}").`);
  process.exit(1);
}

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
async function rejects(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (err) {
    return (err as { code?: string }).code ?? "error";
  }
}

const verifier = () => randomBytes(32).toString("base64url");
const challengeOf = (v: string) => createHash("sha256").update(v).digest("base64url");
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";

async function main() {
  const { prisma } = await import("../src/lib/db");
  const svc = await import("../src/lib/mcp/oauth/service");
  const { hashSecret } = await import("../src/lib/mcp/oauth/crypto");
  const now = new Date();
  const minutes = (n: number) => new Date(now.getTime() + n * 60_000);
  const days = (n: number) => minutes(n * 24 * 60);

  const email = `oauth-check-${Date.now().toString(36)}@example.test`;
  const admin = await prisma.adminUser.create({ data: { email } });
  const created: string[] = [];

  try {
    // ----- registering an app -------------------------------------------------
    const reg = await svc.registerClient({ client_name: "OAUTH CHECK\u0007 app\n  ", redirect_uris: [REDIRECT] });
    created.push(reg.client_id);
    check("registers an app with an allowed redirect", !!reg.client_id && reg.token_endpoint_auth_method === "none");
    check("app name is cleaned of control characters", reg.client_name === "OAUTH CHECK app", reg.client_name);

    check("refuses a redirect to another site", (await rejects(svc.registerClient({ redirect_uris: ["https://evil.example/cb"] }))) === "invalid_redirect_uri");
    check("refuses a lookalike of claude.ai", (await rejects(svc.registerClient({ redirect_uris: ["https://claude.ai.evil.example/api/mcp/auth_callback"] }))) === "invalid_redirect_uri");
    check("refuses registration without redirect_uris", (await rejects(svc.registerClient({ client_name: "x" }))) === "invalid_client_metadata");
    check("refuses a confidential-client auth method", (await rejects(svc.registerClient({ redirect_uris: [REDIRECT], token_endpoint_auth_method: "client_secret_basic" }))) === "invalid_client_metadata");
    check("refuses an unknown scope", (await rejects(svc.registerClient({ redirect_uris: [REDIRECT], scope: "admin" }))) === "invalid_client_metadata");

    // ----- the authorize request --------------------------------------------------
    const v = verifier();
    const base = { clientId: reg.client_id, redirectUri: REDIRECT, codeChallenge: challengeOf(v), codeChallengeMethod: "S256" };
    check("authorize: unknown app is refused", (await rejects(svc.validateAuthorizeRequest({ ...base, clientId: "nope" }))) === "invalid_client");
    check("authorize: an unregistered redirect is refused", (await rejects(svc.validateAuthorizeRequest({ ...base, redirectUri: "https://claude.com/api/mcp/auth_callback" }))) === "invalid_redirect_uri");
    check("authorize: PKCE 'plain' is refused", (await rejects(svc.validateAuthorizeRequest({ ...base, codeChallengeMethod: "plain" }))) === "invalid_request");
    check("authorize: a malformed challenge is refused", (await rejects(svc.validateAuthorizeRequest({ ...base, codeChallenge: "short" }))) === "invalid_request");
    check("authorize: another scope is refused", (await rejects(svc.validateAuthorizeRequest({ ...base, scope: "mcp admin" }))) === "invalid_scope");
    check("authorize: a good request is accepted", (await svc.validateAuthorizeRequest(base)).id === reg.client_id);

    // ----- the normal path ---------------------------------------------------------
    const code = await svc.createAuthCode({ ...base, adminUserId: admin.id }, now);
    const tokens = await svc.exchangeAuthCode({ code, clientId: reg.client_id, redirectUri: REDIRECT, codeVerifier: v }, now);
    check("code + correct verifier gives tokens", tokens.token_type === "Bearer" && tokens.expires_in === 3600 && tokens.scope === "mcp");
    const who = await svc.authenticateAccessToken(tokens.access_token, now);
    check("the access token identifies the person and the app", who?.email === email && who?.clientName === "OAUTH CHECK app");

    // nothing secret is stored in the clear
    const row = await prisma.mcpToken.findFirst({ where: { adminUserId: admin.id } });
    const stored = JSON.stringify(row);
    check("tokens are stored only as hashes", !!row && !stored.includes(tokens.access_token) && !stored.includes(tokens.refresh_token) && row.accessTokenHash === hashSecret(tokens.access_token));
    const codeRow = await prisma.mcpAuthCode.findFirst({ where: { adminUserId: admin.id } });
    check("the code is stored only as a hash", !!codeRow && !JSON.stringify(codeRow).includes(code));

    // ----- attacks on the code -----------------------------------------------------
    check("a used code cannot be used again", (await rejects(svc.exchangeAuthCode({ code, clientId: reg.client_id, redirectUri: REDIRECT, codeVerifier: v }, now))) === "invalid_grant");

    const v2 = verifier();
    const code2 = await svc.createAuthCode({ ...base, codeChallenge: challengeOf(v2), adminUserId: admin.id }, now);
    check("wrong verifier is refused", (await rejects(svc.exchangeAuthCode({ code: code2, clientId: reg.client_id, redirectUri: REDIRECT, codeVerifier: verifier() }, now))) === "invalid_grant");
    check("wrong redirect_uri is refused", (await rejects(svc.exchangeAuthCode({ code: code2, clientId: reg.client_id, redirectUri: "http://localhost:1/cb", codeVerifier: v2 }, now))) === "invalid_grant");
    const other = await svc.registerClient({ client_name: "OAUTH CHECK other", redirect_uris: [REDIRECT] });
    created.push(other.client_id);
    check("a different app cannot use the code", (await rejects(svc.exchangeAuthCode({ code: code2, clientId: other.client_id, redirectUri: REDIRECT, codeVerifier: v2 }, now))) === "invalid_grant");
    check("an expired code is refused", (await rejects(svc.exchangeAuthCode({ code: code2, clientId: reg.client_id, redirectUri: REDIRECT, codeVerifier: v2 }, minutes(2)))) === "invalid_grant");
    check("a made-up code is refused", (await rejects(svc.exchangeAuthCode({ code: "mcp_ac_" + "x".repeat(43), clientId: reg.client_id, redirectUri: REDIRECT, codeVerifier: v2 }, now))) === "invalid_grant");

    // two requests racing with the same code: exactly one wins
    const v3 = verifier();
    const code3 = await svc.createAuthCode({ ...base, codeChallenge: challengeOf(v3), adminUserId: admin.id }, now);
    const race = await Promise.allSettled([
      svc.exchangeAuthCode({ code: code3, clientId: reg.client_id, redirectUri: REDIRECT, codeVerifier: v3 }, now),
      svc.exchangeAuthCode({ code: code3, clientId: reg.client_id, redirectUri: REDIRECT, codeVerifier: v3 }, now),
    ]);
    check("racing the same code: exactly one succeeds", race.filter((r) => r.status === "fulfilled").length === 1);

    // ----- tokens ---------------------------------------------------------------------
    check("an unknown token is refused", (await svc.authenticateAccessToken("mcp_at_" + "y".repeat(43), now)) === null);
    check("a token without the prefix is refused", (await svc.authenticateAccessToken("abc", now)) === null);
    check("the access token expires after an hour", (await svc.authenticateAccessToken(tokens.access_token, minutes(61))) === null);

    // ----- renewing ---------------------------------------------------------------------
    check("a refresh from the wrong app is refused", (await rejects(svc.refreshTokens({ refreshToken: tokens.refresh_token, clientId: other.client_id }, now))) === "invalid_grant");
    const renewed = await svc.refreshTokens({ refreshToken: tokens.refresh_token, clientId: reg.client_id }, minutes(61));
    check("refreshing gives a working new pair", (await svc.authenticateAccessToken(renewed.access_token, minutes(62)))?.email === email);
    check("the old access token stops working", (await svc.authenticateAccessToken(tokens.access_token, minutes(62))) === null);
    check("the old refresh token cannot be replayed", (await rejects(svc.refreshTokens({ refreshToken: tokens.refresh_token, clientId: reg.client_id }, minutes(62)))) === "invalid_grant");
    check("a connection unused for 30 days lapses", (await rejects(svc.refreshTokens({ refreshToken: renewed.refresh_token, clientId: reg.client_id }, days(31)))) === "invalid_grant");

    // ----- revoking ------------------------------------------------------------------------
    const renewedRow = await prisma.mcpToken.findFirst({ where: { accessTokenHash: hashSecret(renewed.access_token) } });
    const list1 = await svc.listConnections(minutes(62));
    check("the connection is listed with the person's email", list1.some((c) => c.id === renewedRow?.id && c.email === email && c.appName === "OAUTH CHECK app"));
    await svc.revokeByToken(renewed.access_token, minutes(63));
    check("revoking switches the token off at once", (await svc.authenticateAccessToken(renewed.access_token, minutes(63))) === null);
    check("a revoked connection cannot be renewed", (await rejects(svc.refreshTokens({ refreshToken: renewed.refresh_token, clientId: reg.client_id }, minutes(63)))) === "invalid_grant");
    check("a revoked connection leaves the list", !(await svc.listConnections(minutes(63))).some((c) => c.id === renewedRow?.id));
    check("revoking one connection leaves the person's other connection alone", (await svc.listConnections(minutes(63))).some((c) => c.email === email));
    await svc.revokeByToken("mcp_at_" + "z".repeat(43));
    check("revoking an unknown token does not fail or leak", true);

    // ----- removing a person's admin login removes their connections ----------------------------
    const v4 = verifier();
    const code4 = await svc.createAuthCode({ ...base, codeChallenge: challengeOf(v4), adminUserId: admin.id }, now);
    const t4 = await svc.exchangeAuthCode({ code: code4, clientId: reg.client_id, redirectUri: REDIRECT, codeVerifier: v4 }, now);
    check("a fresh connection works", (await svc.authenticateAccessToken(t4.access_token, now)) !== null);
    await prisma.adminUser.delete({ where: { id: admin.id } });
    check("deleting the admin login disconnects them", (await svc.authenticateAccessToken(t4.access_token, now)) === null);
  } finally {
    await prisma.adminUser.deleteMany({ where: { email } });
    await prisma.mcpOAuthClient.deleteMany({ where: { id: { in: created } } });
  }

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
