import test from "node:test";
import assert from "node:assert/strict";

/**
 * Accounts made from a company and a geo ("Concentrix" + Philippines = "Concentrix PH"). Runs only against a LOCAL
 * database (skipped otherwise). Signs a made-up staff login in-process with a made-up secret.
 */
const testDb = process.env.WORKFLOW_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) {
  process.env.DATABASE_URL_DIRECT = testDb;
  process.env.ADMIN_SECRET = "test-only-secret-for-company-accounts-tests-0123456789";
}
const skip = !isLocalDb && "set WORKFLOW_TEST_DATABASE_URL to a localhost database";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const stamp = Date.now().toString(36);

async function setup(role: "editor" | "viewer" = "editor") {
  const { NextRequest } = await import("next/server");
  const { createToken } = await import("../src/lib/auth");
  const { prisma } = await import("../src/lib/db");
  const user = await prisma.adminUser.create({ data: { email: `acct-${role}-${stamp}@example.invalid`, role } });
  const cookie = `admin_token=${createToken(user.id)}`;
  const call = async (handler: (req: InstanceType<typeof NextRequest>, ctx: { params: Promise<Json> }) => Promise<Response>, url: string, opts: { method?: string; body?: unknown; params?: Json } = {}) => {
    const req = new NextRequest(`http://localhost${url}`, {
      method: opts.method ?? "GET",
      headers: { "content-type": "application/json", cookie },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : {}) as Json };
  };
  return { call, prisma, userId: user.id };
}

test("accounts from company and geo (local DB): generated names, one company, one account per geo", { skip }, async () => {
  const { call, prisma, userId } = await setup();
  const made: string[] = [];
  const co = `Concentrix${stamp}`;
  try {
    const list = await import("../src/app/api/tracker/accounts/route");
    const one = await import("../src/app/api/tracker/accounts/[id]/route");
    const companies = await import("../src/app/api/tracker/companies/route");
    const gallery = await import("../src/app/api/companies/route");
    const create = async (body: Json) => {
      const r = await call(list.POST as never, "/api/tracker/accounts", { method: "POST", body });
      if (r.status === 201) made.push(r.body.id);
      return r;
    };

    // the name is built from the company and the geo's short code
    const ph = await create({ company: co, geo: "Philippines" });
    assert.equal(ph.status, 201);
    assert.equal(ph.body.name, `${co} PH`);
    assert.equal(ph.body.companyName, co);
    assert.deepEqual([ph.body.geo, ph.body.geoCode], ["Philippines", "PH"]);

    // the same company again, spelled differently, is the SAME company; the geo can be typed as a code or a name
    const us = await create({ company: `  ${co.toUpperCase()}, Inc. `, geo: "us" });
    assert.equal(us.status, 201, JSON.stringify(us.body));
    assert.equal(us.body.companyId, ph.body.companyId, "only one company");
    assert.equal(us.body.companyName, co, "it keeps the name the company was first given");
    assert.equal(us.body.name, `${co} US`);
    assert.equal(await prisma.trackerCompany.count({ where: { nameKey: { startsWith: co.toLowerCase() } } }), 1);

    // the UK is written UK; a region is written in full
    assert.equal((await create({ companyId: ph.body.companyId, geo: "United Kingdom" })).body.name, `${co} UK`);
    assert.equal((await create({ company: co, geo: "APAC" })).body.name, `${co} APAC`);

    // one account per company per geo
    const dup = await create({ company: co, geo: "PH" });
    assert.equal(dup.status, 400);
    assert.match(dup.body.error, new RegExp(`already has an account for Philippines: ${co} PH`));

    // a geo that is not in the list needs its own short code
    const noCode = await create({ company: co, geo: "Greater Bay Area" });
    assert.equal(noCode.status, 400);
    assert.match(noCode.body.error, /not in the geo list/);
    const withCode = await create({ company: co, geo: "Greater Bay Area", geoCode: "GBA" });
    assert.equal(withCode.body.name, `${co} GBA`);

    // a different name can be given on purpose
    const named = await create({ company: co, geo: "Singapore", name: `${co} Singapore Hub` });
    assert.equal(named.body.name, `${co} Singapore Hub`);
    assert.equal(named.body.geoCode, "SG");

    // an account with only a name still works (how accounts were made before companies)
    const legacy = await create({ name: `Legacy ${stamp}` });
    assert.equal(legacy.status, 201);
    assert.equal(legacy.body.companyId, null);

    // refusals
    assert.equal((await create({ company: co })).status, 400, "a company needs a geo");
    assert.equal((await create({ geo: "Philippines" })).status, 400, "a geo needs a company");
    assert.equal((await create({})).status, 400);
    assert.equal((await create({ companyId: "nope", geo: "PH" })).status, 404);

    // two people adding the same new company at the same moment still end up with one company
    const race = `Race${stamp}`;
    const both = await Promise.all([create({ company: race, geo: "Philippines" }), create({ company: race.toLowerCase(), geo: "India" })]);
    assert.deepEqual(both.map((r) => r.status), [201, 201]);
    assert.equal(both[0].body.companyId, both[1].body.companyId);
    assert.equal(await prisma.trackerCompany.count({ where: { nameKey: race.toLowerCase() } }), 1);

    // editing: give a legacy account a company and geo and its name follows; an explicit name wins
    const filed = await call(one.PATCH as never, `/api/tracker/accounts/${legacy.body.id}`, { method: "PATCH", body: { company: `TP${stamp}`, geo: "Philippines" }, params: { id: legacy.body.id } });
    assert.equal(filed.status, 200);
    assert.equal(filed.body.name, `TP${stamp} PH`);
    const keep = await call(one.PATCH as never, `/api/tracker/accounts/${legacy.body.id}`, { method: "PATCH", body: { name: "Keep this name", geo: "India" }, params: { id: legacy.body.id } });
    assert.equal(keep.body.name, "Keep this name");
    assert.equal(keep.body.geoCode, "IN");
    // moving onto a geo the company already has is refused and changes nothing
    const clash = await call(one.PATCH as never, `/api/tracker/accounts/${named.body.id}`, { method: "PATCH", body: { geo: "Philippines" }, params: { id: named.body.id } });
    assert.equal(clash.status, 400);
    assert.equal((await prisma.trackerAccount.findUniqueOrThrow({ where: { id: named.body.id } })).geoCode, "SG");
    // a name-only edit leaves company and geo alone
    const rename = await call(one.PATCH as never, `/api/tracker/accounts/${ph.body.id}`, { method: "PATCH", body: { notes: "hello" }, params: { id: ph.body.id } });
    assert.deepEqual([rename.body.name, rename.body.geoCode], [`${co} PH`, "PH"]);

    // the form's company list, with the geos each already has
    const cl = await call(companies.GET as never, "/api/tracker/companies");
    const entry = cl.body.companies.find((c: Json) => c.id === ph.body.companyId);
    assert.ok(entry);
    assert.ok(["PH", "US", "UK", "APAC", "GBA", "SG"].every((code) => entry.accounts.some((a: Json) => a.geoCode === code)));

    // the gallery carries company and geo
    const g = await call(gallery.GET as never, "/api/companies");
    const card = g.body.companies.find((c: Json) => c.id === ph.body.id);
    assert.deepEqual([card.companyName, card.geo, card.geoCode], [co, "Philippines", "PH"]);
  } finally {
    await prisma.trackerAccount.deleteMany({ where: { id: { in: made } } });
    await prisma.trackerCompany.deleteMany({ where: { nameKey: { in: [co.toLowerCase(), `race${stamp}`, `tp${stamp}`] } } });
    await prisma.adminUser.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
});

test("Claude's create_account (local DB): company and geo build the name, a repeat is refused, a name alone still works", { skip }, async () => {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
  const { prisma } = await import("../src/lib/db");
  const { createTrackerMcpServer } = await import("../src/lib/mcp/tracker");
  const [c, s] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1" });
  await Promise.all([createTrackerMcpServer().connect(s as never), client.connect(c)]);
  const call = (args: Record<string, unknown>) => client.callTool({ name: "create_account", arguments: args });
  const text = (r: unknown) => (r as { content: { text: string }[] }).content.map((x) => x.text).join("");
  const co = `McpCo${stamp}`;
  try {
    const first = JSON.parse(text(await call({ company: co, geo: "Philippines" })));
    assert.equal(first.name, `${co} PH`);
    assert.equal(first.companyName, co);
    const second = JSON.parse(text(await call({ company: co.toLowerCase(), geo: "UK" })));
    assert.equal(second.name, `${co} UK`);
    assert.equal(second.companyId, first.companyId, "the same company is reused, never a second one");
    const custom = JSON.parse(text(await call({ company: co, geo: "Greater Bay Area", geo_code: "GBA" })));
    assert.equal(custom.name, `${co} GBA`);
    const repeat = await call({ company: co, geo: "PH" });
    assert.equal((repeat as { isError?: boolean }).isError, true);
    assert.match(text(repeat), /already has an account for Philippines/);
    const plain = JSON.parse(text(await call({ name: `McpPlain${stamp}` })));
    assert.equal(plain.companyId, null);
    const tools = (await client.listTools()).tools.find((t) => t.name === "create_account");
    assert.ok(tools && JSON.stringify(tools.inputSchema).includes("geo_code"));
  } finally {
    await prisma.trackerAccount.deleteMany({ where: { OR: [{ name: { startsWith: co } }, { name: `McpPlain${stamp}` }] } });
    await prisma.trackerCompany.deleteMany({ where: { nameKey: co.toLowerCase() } });
    await prisma.$disconnect();
  }
});

test("accounts from company and geo (local DB): a read-only login cannot create one", { skip }, async () => {
  const { call, prisma, userId } = await setup("viewer");
  try {
    const list = await import("../src/app/api/tracker/accounts/route");
    const r = await call(list.POST as never, "/api/tracker/accounts", { method: "POST", body: { company: `Viewer${stamp}`, geo: "Philippines" } });
    assert.equal(r.status, 403);
    assert.equal(await prisma.trackerCompany.count({ where: { nameKey: `viewer${stamp}` } }), 0);
  } finally {
    await prisma.adminUser.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
});
