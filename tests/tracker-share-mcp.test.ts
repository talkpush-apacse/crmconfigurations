import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { isClientOnlyHost, parseBaseUrl, pathAllowedOnClientHost, resolveClientLinkBase } from "../src/lib/tracker/client-link-url";

/**
 * Client links through the Claude connector. The first half needs no database; the second half runs only against a
 * LOCAL database (TRACKER_TEST_DATABASE_URL pointing at localhost).
 */

const testDb = process.env.TRACKER_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) process.env.DATABASE_URL_DIRECT = testDb;
else process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:1/test";
const skip = !isLocalDb && "set TRACKER_TEST_DATABASE_URL to a localhost database";

// ---------------------------------------------------------------------------
// the address links are built on, and the client-only address
// ---------------------------------------------------------------------------

test("client link address: only a plain https address is accepted", () => {
  assert.deepEqual(parseBaseUrl("https://status.talkpush.com"), { origin: "https://status.talkpush.com", host: "status.talkpush.com" });
  assert.deepEqual(parseBaseUrl("https://status.talkpush.com/"), { origin: "https://status.talkpush.com", host: "status.talkpush.com" });
  assert.deepEqual(parseBaseUrl("http://localhost:3000"), { origin: "http://localhost:3000", host: "localhost:3000" });
  for (const bad of ["", "   ", "status.talkpush.com", "http://status.talkpush.com", "https://status.talkpush.com/hub", "https://user:pw@status.talkpush.com", "https://x.com/?a=1", "javascript:alert(1)"]) {
    assert.equal(parseBaseUrl(bad), null, `should refuse "${bad}"`);
  }
});

test("client link address: the setting wins, otherwise the caller's own address, and a typo is reported", () => {
  const set = resolveClientLinkBase("https://crm.se-talkpush.com", "https://status.talkpush.com");
  assert.equal(set.origin, "https://status.talkpush.com");
  assert.equal(set.configured, true);
  const fallback = resolveClientLinkBase("https://crm.se-talkpush.com", "");
  assert.equal(fallback.origin, "https://crm.se-talkpush.com");
  assert.equal(fallback.configured, false);
  assert.throws(() => resolveClientLinkBase("https://crm.se-talkpush.com", "status.talkpush.com"), /CLIENT_LINK_BASE_URL/);
  assert.throws(() => resolveClientLinkBase(undefined, ""), /Could not work out/);
});

test("client-only address: only client pages open there", () => {
  for (const ok of ["/share/tpv_abc", "/api/share/tpv_abc", "/contribute/tpc_abc", "/api/contribute/tpc_abc/items", "/w/abc", "/api/w/abc/x", "/_next/static/x.js", "/favicon.ico"]) {
    assert.equal(pathAllowedOnClientHost(ok), true, ok);
  }
  for (const no of ["/", "/admin", "/admin/login", "/api/tracker/projects", "/api/mcp/all", "/api/auth/login", "/client/abc/welcome", "/editor/abc", "/workflows", "/shared", "/api/sharex", "/oauth/authorize"]) {
    assert.equal(pathAllowedOnClientHost(no), false, no);
  }
});

test("client-only address: never switches on for the staff address", () => {
  const client = "https://status.talkpush.com";
  const staff = "https://crm.se-talkpush.com";
  assert.equal(isClientOnlyHost("status.talkpush.com", client, staff), true);
  assert.equal(isClientOnlyHost("crm.se-talkpush.com", client, staff), false);
  assert.equal(isClientOnlyHost("status.talkpush.com", "", staff), false, "off when the setting is empty");
  assert.equal(isClientOnlyHost("status.talkpush.com", "nonsense", staff), false);
  assert.equal(isClientOnlyHost("crm.se-talkpush.com", staff, staff), false, "setting both to one address must not lock staff out");
  assert.equal(isClientOnlyHost(null, client, staff), false);
});

// ---------------------------------------------------------------------------
// expiry
// ---------------------------------------------------------------------------

test("connector link expiry: 90 days by default, null for none, never in the past or beyond a year", async () => {
  const { resolveConnectorExpiry } = await import("../src/lib/tracker/share-service");
  const now = new Date("2026-10-06T00:00:00.000Z");
  assert.equal(resolveConnectorExpiry(undefined, now)?.toISOString(), "2027-01-04T00:00:00.000Z");
  assert.equal(resolveConnectorExpiry(null, now), null);
  assert.equal(resolveConnectorExpiry("2026-12-31", now)?.toISOString(), "2026-12-31T00:00:00.000Z");
  assert.throws(() => resolveConnectorExpiry("2026-10-01", now), /future/);
  assert.throws(() => resolveConnectorExpiry("2028-01-01", now), /at most a year/);
  assert.throws(() => resolveConnectorExpiry("next tuesday", now), /real date/);
});

// ---------------------------------------------------------------------------
// the tools
// ---------------------------------------------------------------------------

async function connect(server: { connect: (t: never) => Promise<void> }) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1" });
  await Promise.all([server.connect(serverSide as never), client.connect(clientSide)]);
  return client;
}
const textOf = (r: unknown) => (r as { content: { text: string }[] }).content.map((c) => c.text).join("");

test("sharing tools: offered to an editor, hidden from a read-only connection (except the list)", async () => {
  const { createTrackerMcpServer } = await import("../src/lib/mcp/tracker");
  const actor = { label: "Claude for test@example.com", via: "mcp" as const };
  const editor = (await (await connect(createTrackerMcpServer({ actor }))).listTools()).tools.map((t) => t.name);
  for (const n of ["create_project_link", "list_project_access", "disable_project_link"]) assert.ok(editor.includes(n), n);
  const reader = (await (await connect(createTrackerMcpServer({ actor, readOnly: true }))).listTools()).tools.map((t) => t.name);
  assert.ok(reader.includes("list_project_access"));
  assert.ok(!reader.includes("create_project_link"));
  assert.ok(!reader.includes("disable_project_link"));
});

test("create_project_link: only a view level exists in this release", async () => {
  const { createTrackerMcpServer } = await import("../src/lib/mcp/tracker");
  const client = await connect(createTrackerMcpServer({ actor: { label: "t", via: "mcp" } }));
  const res = await client.callTool({ name: "create_project_link", arguments: { project_id: "x", level: "edit" } });
  assert.equal(res.isError, true);
});

test("project links through the connector, against a real database", { skip }, async () => {
  const { prisma } = await import("../src/lib/db");
  const { createTrackerMcpServer } = await import("../src/lib/mcp/tracker");
  const { resolveViewerToken, createViewerLink } = await import("../src/lib/tracker/share-service");
  const { getClientViewForProject } = await import("../src/lib/tracker/client-view-service");
  delete process.env.CLIENT_LINK_BASE_URL;

  const suffix = Date.now().toString(36);
  const SECRET_TITLE = `INTERNAL_ONLY_${suffix}`;
  const SECRET_JIRA = `https://example.atlassian.net/browse/SECRET-${suffix}`;
  const account = await prisma.trackerAccount.create({ data: { name: `Share MCP ${suffix}`, slug: `share-mcp-${suffix}` } });
  const project = await prisma.trackerProject.create({ data: { accountId: account.id, title: `Share MCP project ${suffix}` } });
  const otherAccount = await prisma.trackerAccount.create({ data: { name: `Share other ${suffix}`, slug: `share-other-${suffix}` } });
  const other = await prisma.trackerProject.create({ data: { accountId: otherAccount.id, title: `Share other project ${suffix}` } });
  await prisma.trackerItem.create({ data: { projectId: project.id, title: "Visible to the client", visibility: "client_visible" } });
  await prisma.trackerItem.create({ data: { projectId: project.id, title: SECRET_TITLE, visibility: "internal", links: [{ url: SECRET_JIRA }] } });
  const visible = await prisma.trackerItem.findFirstOrThrow({ where: { projectId: project.id, title: "Visible to the client" } });
  await prisma.trackerItem.update({ where: { id: visible.id }, data: { links: [{ url: SECRET_JIRA }] } });
  await prisma.trackerRemark.create({ data: { itemId: visible.id, body: `TEAM_ONLY_${suffix}`, visibility: "internal", authorLabel: "someone@example.invalid" } });

  const actor = { label: "Claude for test@example.com", via: "mcp" as const };
  const client = await connect(createTrackerMcpServer({ actor, origin: "https://crm.example.test" }));
  const call = async (name: string, args: Record<string, unknown>) => {
    const r = await client.callTool({ name, arguments: args });
    return { error: Boolean(r.isError), text: textOf(r), json: r.isError ? null : JSON.parse(textOf(r)) };
  };

  try {
    // a link made by hand in the Share dialog, which the connector must never touch
    const byHand = await createViewerLink(project.id, { label: "For Maria", expiresInDays: 30 }, { label: "staff@example.com", via: "web" });

    const first = await call("create_project_link", { project_id: project.id, level: "view" });
    assert.equal(first.error, false, first.text);
    const url1: string = first.json.url;
    assert.match(url1, /^https:\/\/crm\.example\.test\/share\/tpv_/);
    assert.equal(first.json.replacedEarlierLink, false);
    assert.ok(first.json.warning, "warns that the Hub's own address may be blocked");
    const token1 = url1.split("/share/")[1];
    assert.equal(await resolveViewerToken(token1), project.id, "the link opens this project");

    // the client view shows only client-visible items, never internal items, team-only remarks or Jira links
    const view = JSON.stringify(await getClientViewForProject(project.id));
    assert.ok(view.includes("Visible to the client"));
    for (const secret of [SECRET_TITLE, SECRET_JIRA, `TEAM_ONLY_${suffix}`, "someone@example.invalid"]) assert.ok(!view.includes(secret), `leaked: ${secret}`);

    // the address can be moved to a client-friendly host
    process.env.CLIENT_LINK_BASE_URL = "https://status.example.test";
    const second = await call("create_project_link", { project_id: project.id, level: "view", expires_at: null });
    delete process.env.CLIENT_LINK_BASE_URL;
    assert.equal(second.error, false, second.text);
    assert.match(second.json.url, /^https:\/\/status\.example\.test\/share\/tpv_/);
    assert.equal(second.json.warning, undefined, "no warning once a client address is set");
    assert.equal(second.json.expiresAt, null);
    assert.equal(second.json.replacedEarlierLink, true);
    const token2 = second.json.url.split("/share/")[1];
    assert.equal(await resolveViewerToken(token1), null, "the old connector link stopped working");
    assert.equal(await resolveViewerToken(token2), project.id);
    assert.equal(await resolveViewerToken(byHand.token), project.id, "a link made by hand is left alone");

    // listing: no secrets, and the live links are there
    const listed = await call("list_project_access", { project_id: project.id });
    assert.equal(listed.error, false, listed.text);
    assert.ok(!listed.text.includes(token1) && !listed.text.includes(token2) && !listed.text.includes(byHand.token), "no secret in the list");
    assert.ok(!listed.text.includes("tokenHash"));
    assert.equal(listed.json.links.length, 2, "the replaced link is no longer listed");
    const ids = listed.json.links.map((l: { id: string }) => l.id);
    assert.ok(ids.includes(byHand.id) && ids.includes(second.json.linkId));

    // turning one off: not another project's link, then the real one
    const wrong = await call("disable_project_link", { project_id: other.id, link_id: second.json.linkId });
    assert.equal(wrong.error, true);
    assert.equal(await resolveViewerToken(token2), project.id, "a link id from another project changed nothing");
    const off = await call("disable_project_link", { project_id: project.id, link_id: second.json.linkId });
    assert.equal(off.error, false, off.text);
    assert.equal(await resolveViewerToken(token2), null);
    assert.equal((await call("list_project_access", { project_id: project.id })).json.links.length, 1);

    // a bad setting is reported and leaves no link behind
    const before = await prisma.trackerShareLink.count({ where: { projectId: project.id } });
    process.env.CLIENT_LINK_BASE_URL = "not-an-address";
    const bad = await call("create_project_link", { project_id: project.id, level: "view" });
    delete process.env.CLIENT_LINK_BASE_URL;
    assert.equal(bad.error, true);
    assert.match(bad.text, /CLIENT_LINK_BASE_URL/);
    assert.equal(await prisma.trackerShareLink.count({ where: { projectId: project.id } }), before);

    // an archived project cannot be shared
    await prisma.trackerProject.update({ where: { id: other.id }, data: { archived: true } });
    assert.equal((await call("create_project_link", { project_id: other.id, level: "view" })).error, true);

    // every change is in the activity log under the caller's name
    const log = await prisma.trackerActivity.findMany({ where: { projectId: project.id, action: { startsWith: "share." } }, orderBy: { createdAt: "asc" } });
    const actions = log.map((l) => l.action);
    assert.ok(actions.filter((a) => a === "share.created").length >= 3, "each creation is logged");
    assert.ok(actions.filter((a) => a === "share.revoked").length >= 2, "the replace and the turn-off are logged");
    assert.ok(log.every((l) => l.actorLabel === actor.label || l.actorLabel === "staff@example.com"));
    assert.ok(log.some((l) => l.via === "mcp"));
    assert.ok(!JSON.stringify(log).includes(token1) && !JSON.stringify(log).includes(token2), "no secret in the log");
  } finally {
    await prisma.trackerProject.deleteMany({ where: { id: { in: [project.id, other.id] } } }).catch(() => undefined);
    await prisma.trackerAccount.deleteMany({ where: { id: { in: [account.id, otherAccount.id] } } }).catch(() => undefined);
    await prisma.$disconnect();
  }
});

// ---------------------------------------------------------------------------
// the site gatekeeper on the client-only address
// ---------------------------------------------------------------------------

test("gatekeeper: the client-only address opens client pages and nothing else; the staff address is unchanged", async () => {
  const { NextRequest } = await import("next/server");
  const { middleware } = await import("../middleware");
  process.env.ADMIN_SECRET = "test-only-secret-for-share-gatekeeper-0123456789";
  const saved = { c: process.env.CLIENT_LINK_BASE_URL, a: process.env.APP_BASE_URL };
  process.env.CLIENT_LINK_BASE_URL = "https://status.example.test";
  process.env.APP_BASE_URL = "https://crm.example.test";
  const hit = (host: string, path: string) =>
    middleware(new NextRequest(`https://${host}${path}`, { headers: { host } })) as Promise<Response>;
  try {
    for (const path of ["/admin", "/api/tracker/projects", "/api/mcp/all", "/", "/client/abc/welcome"]) {
      assert.equal((await hit("status.example.test", path)).status, 404, `client host ${path}`);
    }
    for (const path of ["/share/tpv_x", "/api/share/tpv_x", "/contribute/tpc_x", "/w/x"]) {
      const res = await hit("status.example.test", path);
      assert.notEqual(res.status, 404, `client host ${path} must reach the app`);
    }
    // the staff address behaves as it always has: /admin asks for a login, other pages pass straight through
    const admin = await hit("crm.example.test", "/admin");
    assert.equal(admin.status, 307);
    assert.match(admin.headers.get("location") ?? "", /\/admin\/login$/);
    assert.notEqual((await hit("crm.example.test", "/api/tracker/projects")).status, 404);
    // with no client address set, nothing is restricted
    delete process.env.CLIENT_LINK_BASE_URL;
    assert.notEqual((await hit("status.example.test", "/api/tracker/projects")).status, 404);
  } finally {
    if (saved.c === undefined) delete process.env.CLIENT_LINK_BASE_URL; else process.env.CLIENT_LINK_BASE_URL = saved.c;
    if (saved.a === undefined) delete process.env.APP_BASE_URL; else process.env.APP_BASE_URL = saved.a;
  }
});
