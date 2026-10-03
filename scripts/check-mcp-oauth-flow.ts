/**
 * Plays Claude (and a few attackers) against a RUNNING local server over real HTTP: finding the sign-in
 * documents, registering, signing in as a person, the Allow page, tokens, calling both connectors,
 * renewing, revoking, and the older shared keys.
 *
 *   DATABASE_URL_DIRECT=postgresql://localhost:54329/tracker_dev \
 *   TRACKER_MCP_API_KEY=... MCP_API_KEY=... \
 *   npx tsx scripts/check-mcp-oauth-flow.ts [http://localhost:3000]
 *
 * Refuses to run against anything but localhost. Creates a throwaway admin user, apps, account and project and removes them.
 */
import { createHash, randomBytes } from "node:crypto";

process.env.ADMIN_SECRET ??= "x".repeat(40); // only needed to hash a throwaway password; the server uses its own

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const dbUrl = process.env.DATABASE_URL_DIRECT ?? "";
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname;
  } catch {
    return "";
  }
};
const LOCAL = ["localhost", "127.0.0.1", "::1", "[::1]"];
if (!LOCAL.includes(hostOf(base)) || !LOCAL.includes(hostOf(dbUrl))) {
  console.error("Refusing to run: both the server address and DATABASE_URL_DIRECT must be local.");
  process.exit(1);
}
const trackerKey = process.env.TRACKER_MCP_API_KEY ?? "";
const checklistKey = process.env.MCP_API_KEY ?? "";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const verifier = randomBytes(32).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const STATE = "state-" + randomBytes(6).toString("hex");

async function http(path: string, init: RequestInit & { cookies?: Record<string, string> } = {}) {
  const { cookies, headers, ...rest } = init;
  const cookieHeader = cookies ? Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ") : undefined;
  const res = await fetch(path.startsWith("http") ? path : base + path, {
    redirect: "manual",
    ...rest,
    headers: { ...(headers as Record<string, string>), ...(cookieHeader ? { cookie: cookieHeader } : {}) },
  });
  return res;
}
const setCookie = (res: Response, name: string) => {
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(";");
    const [k, ...v] = pair.split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
};
/** Where a redirect points; relative addresses are resolved against the server. A missing Location gives a harmless dummy. */
const loc = (res: Response) => new URL(res.headers.get("location") ?? "/__no_location__", base);
const noStore = (res: Response) => (res.headers.get("cache-control") ?? "").includes("no-store");
const form = (obj: Record<string, string>) => new URLSearchParams(obj).toString();
const FORM = { "Content-Type": "application/x-www-form-urlencoded" };

async function mcp(path: string, bearer: string | null, method = "tools/list", params: unknown = {}) {
  const res = await http(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const text = await res.text();
  let json: { result?: { tools?: unknown[]; content?: { text: string }[] } } | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { res, json };
}

async function main() {
  const { prisma } = await import("../src/lib/db");
  const { hashPassword } = await import("../src/lib/auth");

  const email = `oauth-flow-${Date.now().toString(36)}@example.test`;
  const password = randomBytes(12).toString("base64url");
  await prisma.adminUser.create({ data: { email, passwordHash: await hashPassword(password) } });
  const clientIds: string[] = [];

  try {
    // ----- finding the sign-in documents -------------------------------------------------------
    const asRes = await http("/.well-known/oauth-authorization-server");
    const as = await asRes.json();
    check("sign-in server document is published", asRes.status === 200 && as.issuer === base && as.registration_endpoint === `${base}/api/oauth/register`);
    check("it requires PKCE S256 and public clients", as.code_challenge_methods_supported?.[0] === "S256" && as.token_endpoint_auth_methods_supported?.[0] === "none");
    const prm = await (await http("/.well-known/oauth-protected-resource/api/mcp/tracker")).json();
    check("tracker connector points at this sign-in server", prm.resource === `${base}/api/mcp/tracker` && prm.authorization_servers?.[0] === base);
    check("checklist connector document is published", (await http("/.well-known/oauth-protected-resource/api/mcp")).status === 200);
    check("other paths are not protected resources", (await http("/.well-known/oauth-protected-resource/api/other")).status === 404);

    // ----- an unauthenticated call tells Claude where to sign in ---------------------------------------
    for (const path of ["/api/mcp/tracker", "/api/mcp"]) {
      const { res } = await mcp(path, null);
      const header = res.headers.get("www-authenticate") ?? "";
      check(`${path}: no credentials gives 401 and a sign-in pointer`, res.status === 401 && header.includes(`resource_metadata="${base}/.well-known/oauth-protected-resource${path}"`));
    }

    // ----- registering --------------------------------------------------------------------------
    const bad = await http("/api/oauth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ redirect_uris: ["https://evil.example/cb"] }) });
    check("registration with another site's address is refused", bad.status === 400 && (await bad.json()).error === "invalid_redirect_uri");
    const regRes = await http("/api/oauth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_name: "OAUTH FLOW CHECK", redirect_uris: [REDIRECT] }) });
    const reg = await regRes.json();
    clientIds.push(reg.client_id);
    check("an app can register itself", regRes.status === 201 && !!reg.client_id && noStore(regRes));

    // ----- the authorize request ---------------------------------------------------------------------
    const authorizeQuery = (over: Record<string, string> = {}) =>
      form({ response_type: "code", client_id: reg.client_id, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: "S256", state: STATE, scope: "mcp", ...over });

    const unknownApp = await http(`/oauth/authorize?${authorizeQuery({ client_id: "nope" })}`);
    check("an unknown app gets an error page, not a redirect", unknownApp.status === 400 && !unknownApp.headers.get("location"));
    const evilRedirect = await http(`/oauth/authorize?${authorizeQuery({ redirect_uri: "https://evil.example/cb" })}`);
    check("an unregistered address gets an error page, never a redirect to it", evilRedirect.status === 400 && !evilRedirect.headers.get("location"));
    const noResponseType = await http(`/oauth/authorize?${authorizeQuery({ response_type: "token", redirect_uri: "https://evil.example/cb" })}`);
    check("a wrong response type to an unregistered address is not redirected either", noResponseType.status === 400 && !noResponseType.headers.get("location"));
    const plain = await http(`/oauth/authorize?${authorizeQuery({ code_challenge_method: "plain" })}`);
    const plainTo = loc(plain);
    check("PKCE 'plain' is turned away with an error to the registered address", plain.status === 303 && plainTo.origin + plainTo.pathname === REDIRECT && plainTo.searchParams.get("error") === "invalid_request" && plainTo.searchParams.get("state") === STATE);

    const query = authorizeQuery();
    const notSignedIn = await http(`/oauth/authorize?${query}`);
    const pending = setCookie(notSignedIn, "mcp_oauth_pending");
    check("not signed in: sent to the normal login, request remembered", notSignedIn.status === 303 && loc(notSignedIn).pathname === "/admin/login" && !!pending);

    // ----- signing in as a person, then resuming ---------------------------------------------------------
    const bad401 = await http("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "wrong" }) });
    check("the normal login still refuses a wrong password", bad401.status === 401);
    const login = await http("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const session = setCookie(login, "admin_token") ?? "";
    check("the normal login works", login.status === 200 && !!session);

    const home = await http("/admin/home", { cookies: { admin_token: session, mcp_oauth_pending: pending ?? "" } });
    check("admin home resumes an unfinished connect", [302, 303, 307, 308].includes(home.status) && loc(home).pathname === "/oauth/resume");
    const resume = await http("/oauth/resume", { cookies: { admin_token: session, mcp_oauth_pending: pending ?? "" } });
    const resumeTo = loc(resume);
    check("resume returns to the authorize request and clears the note", resumeTo.pathname === "/oauth/authorize" && resumeTo.searchParams.get("state") === STATE && setCookie(resume, "mcp_oauth_pending") === "");
    const tampered = await http("/oauth/resume", { cookies: { mcp_oauth_pending: encodeURIComponent("//evil.example/x") } });
    check("a tampered note cannot redirect anywhere else", loc(tampered).origin === base);

    const toConsent = await http(`/oauth/authorize?${query}`, { cookies: { admin_token: session } });
    check("signed in: sent to the Allow page", toConsent.status === 303 && loc(toConsent).pathname === "/oauth/consent");

    const consentRes = await http(`/oauth/consent?${query}`, { cookies: { admin_token: session } });
    const html = await consentRes.text();
    check("the Allow page names the app, the person and where they go next", consentRes.status === 200 && html.includes("OAUTH FLOW CHECK") && html.includes(email) && html.includes("claude.ai"));
    check("the Allow page says plainly what the app can do", html.includes("removing message templates") && html.includes("cannot delete tracker data"));
    const hidden = (name: string) => html.match(new RegExp(`name="${name}"[^>]*value="([^"]*)"|value="([^"]*)"[^>]*name="${name}"`))?.slice(1).find(Boolean)?.replace(/&amp;/g, "&") ?? "";
    const fields = {
      client_id: hidden("client_id"), redirect_uri: hidden("redirect_uri"), code_challenge: hidden("code_challenge"),
      code_challenge_method: hidden("code_challenge_method"), state: hidden("state"), scope: hidden("scope"), consent: hidden("consent"),
    };
    check("the Allow page carries a signed note", fields.consent.includes(".") && fields.client_id === reg.client_id);
    const noSession = await http(`/oauth/consent?${query}`);
    check("the Allow page is not shown to someone signed out", [302, 303, 307].includes(noSession.status));

    // ----- attacks on the Allow click --------------------------------------------------------------------------
    const decide = (extra: Record<string, string>, opts: { cookies?: Record<string, string>; origin?: string } = {}) =>
      http("/oauth/decision", { method: "POST", headers: { ...FORM, ...(opts.origin ? { Origin: opts.origin } : {}) }, body: form({ ...fields, ...extra }), cookies: opts.cookies ?? { admin_token: session } });

    check("a forged click without the signed note is refused", (await decide({ consent: "" }, { origin: base })).status === 403);
    check("a click from another website is refused", (await decide({ decision: "allow" }, { origin: "https://evil.example" })).status === 403);
    check("a click with a changed address is refused", (await decide({ decision: "allow", redirect_uri: "http://localhost:9/cb" }, { origin: base })).status === 403);
    check("a click with a changed state is refused", (await decide({ decision: "allow", state: "other" }, { origin: base })).status === 403);
    check("a click while signed out is refused", (await decide({ decision: "allow" }, { origin: base, cookies: {} })).status === 401);

    const cancel = await decide({ decision: "deny" }, { origin: base });
    const cancelTo = loc(cancel);
    check("Cancel sends the person back with access_denied", cancel.status === 303 && cancelTo.searchParams.get("error") === "access_denied" && cancelTo.searchParams.get("state") === STATE && !cancelTo.searchParams.get("code"));

    const allow = await decide({ decision: "allow" }, { origin: base });
    const allowTo = loc(allow);
    const code = allowTo.searchParams.get("code") ?? "";
    check("Allow sends the person back with a one-time code and their state", allow.status === 303 && allowTo.origin + allowTo.pathname === REDIRECT && code.startsWith("mcp_ac_") && allowTo.searchParams.get("state") === STATE);
    check("that response is not cached and sends no referrer", noStore(allow) && allow.headers.get("referrer-policy") === "no-referrer");

    // ----- tokens ------------------------------------------------------------------------------------------------------
    const tokenCall = (body: Record<string, string>) => http("/api/oauth/token", { method: "POST", headers: FORM, body: form(body) });
    const wrongVerifier = await tokenCall({ grant_type: "authorization_code", code, client_id: reg.client_id, redirect_uri: REDIRECT, code_verifier: randomBytes(32).toString("base64url") });
    check("a wrong verifier is refused", wrongVerifier.status === 400 && (await wrongVerifier.json()).error === "invalid_grant");
    const tokRes = await tokenCall({ grant_type: "authorization_code", code, client_id: reg.client_id, redirect_uri: REDIRECT, code_verifier: verifier });
    const tok = await tokRes.json();
    check("the right verifier gives tokens, never cached", tokRes.status === 200 && tok.token_type === "Bearer" && tok.expires_in === 3600 && noStore(tokRes));
    const reuse = await tokenCall({ grant_type: "authorization_code", code, client_id: reg.client_id, redirect_uri: REDIRECT, code_verifier: verifier });
    check("the code cannot be used twice", reuse.status === 400);
    check("GET on the token address is not allowed", (await http("/api/oauth/token")).status === 405);
    const odd = await tokenCall({ grant_type: "password", client_id: reg.client_id });
    check("other grant types are refused", odd.status === 400 && (await odd.json()).error === "unsupported_grant_type");
    const jsonTok = await http("/api/oauth/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grant_type: "refresh_token", refresh_token: "mcp_rt_" + "x".repeat(43), client_id: reg.client_id }) });
    check("a made-up refresh token is refused", jsonTok.status === 400 && (await jsonTok.json()).error === "invalid_grant");

    // ----- using the connectors with the token ----------------------------------------------------------------------------
    const tracker = await mcp("/api/mcp/tracker", tok.access_token);
    check("the token opens the tracker connector", tracker.res.status === 200 && (tracker.json?.result?.tools?.length ?? 0) === 18, `${tracker.json?.result?.tools?.length} tools`);
    const checklist = await mcp("/api/mcp", tok.access_token);
    check("the token opens the checklist connector", checklist.res.status === 200 && (checklist.json?.result?.tools?.length ?? 0) > 18, `${checklist.json?.result?.tools?.length} tools`);
    const bogus = await mcp("/api/mcp/tracker", "mcp_at_" + "q".repeat(43));
    check("a made-up token gets 401 with a sign-in pointer", bogus.res.status === 401 && !!bogus.res.headers.get("www-authenticate"));

    // changes made through the connection are logged under the person
    const made = await mcp("/api/mcp/tracker", tok.access_token, "tools/call", { name: "create_account", arguments: { name: "OAUTH FLOW CHECK account" } });
    check("a write through the connection works", made.res.status === 200 && !made.json?.result?.content?.[0]?.text?.includes("Something went wrong"));
    const proj = await mcp("/api/mcp/tracker", tok.access_token, "tools/call", { name: "create_project", arguments: { account: "OAUTH FLOW CHECK account", title: "OAUTH FLOW CHECK project" } });
    const activity = await prisma.trackerActivity.findFirst({ where: { actorLabel: `Claude for ${email}` } });
    check("Activity names the person who connected Claude", proj.res.status === 200 && !!activity && activity.via === "mcp", activity?.actorLabel ?? "no activity row");

    // ----- the older shared keys still work ----------------------------------------------------------------------------------------
    if (trackerKey) {
      const viaHeader = await mcp("/api/mcp/tracker", trackerKey);
      const viaUrl = await http(`/api/mcp/tracker?api_key=${encodeURIComponent(trackerKey)}`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }) });
      check("tracker: the shared key still works (header and ?api_key=)", viaHeader.res.status === 200 && viaUrl.status === 200);
      const wrong = await mcp("/api/mcp/tracker", "wrong-key-for-testing");
      check("tracker: a wrong key is still refused", wrong.res.status === 401);
    }
    if (checklistKey) {
      check("checklist: the shared key still works", (await mcp("/api/mcp", checklistKey)).res.status === 200);
      check("checklist: the tracker key does not open it", !trackerKey || (await mcp("/api/mcp", trackerKey)).res.status === 401);
    }

    // ----- renewing ----------------------------------------------------------------------------------------------------------------------
    const renewRes = await tokenCall({ grant_type: "refresh_token", refresh_token: tok.refresh_token, client_id: reg.client_id });
    const renewed = await renewRes.json();
    check("renewing gives a new pair", renewRes.status === 200 && renewed.access_token !== tok.access_token);
    check("the old access token stops working", (await mcp("/api/mcp/tracker", tok.access_token)).res.status === 401);
    check("the new access token works", (await mcp("/api/mcp/tracker", renewed.access_token)).res.status === 200);
    const replay = await tokenCall({ grant_type: "refresh_token", refresh_token: tok.refresh_token, client_id: reg.client_id });
    check("the old refresh token cannot be replayed", replay.status === 400);

    // ----- revoking ------------------------------------------------------------------------------------------------------------------------------
    const unknownRevoke = await http("/api/oauth/revoke", { method: "POST", headers: FORM, body: form({ token: "mcp_at_" + "n".repeat(43) }) });
    check("revoking an unknown token answers 200 and reveals nothing", unknownRevoke.status === 200);
    const revoke = await http("/api/oauth/revoke", { method: "POST", headers: FORM, body: form({ token: renewed.access_token }) });
    check("an app can revoke its own connection", revoke.status === 200);
    check("the revoked token is refused at once", (await mcp("/api/mcp/tracker", renewed.access_token)).res.status === 401);
    const afterRevoke = await tokenCall({ grant_type: "refresh_token", refresh_token: renewed.refresh_token, client_id: reg.client_id });
    check("a revoked connection cannot be renewed", afterRevoke.status === 400);
  } finally {
    await prisma.adminUser.deleteMany({ where: { email } });
    await prisma.mcpOAuthClient.deleteMany({ where: { id: { in: clientIds } } });
    await prisma.trackerProject.deleteMany({ where: { title: "OAUTH FLOW CHECK project" } });
    await prisma.trackerAccount.deleteMany({ where: { name: "OAUTH FLOW CHECK account" } });
  }

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
