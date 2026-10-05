import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

/**
 * The combined connector (/api/mcp/all). No database is needed: these tests only list tools and check auth.
 * The point of the checks: it serves exactly the tools of the three single-area connectors (nothing lost,
 * nothing renamed, no clash) plus the read-only Configuration Plan tool, and the single-area connectors are untouched.
 */

type ServerLike = { connect: (t: never) => Promise<void> };

async function connect(server: ServerLike) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1" });
  await Promise.all([server.connect(serverSide as never), client.connect(clientSide)]);
  return client;
}

async function load() {
  process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:1/test";
  const combined = await import("../src/lib/mcp/combined");
  const auth = await import("../src/lib/mcp/combined-auth");
  const { createMcpServer } = await import("../src/lib/mcp-server");
  const { createTrackerMcpServer } = await import("../src/lib/mcp/tracker");
  const { createWorkflowMcpServer } = await import("../src/lib/mcp/workflows");
  return { ...combined, ...auth, createMcpServer, createTrackerMcpServer, createWorkflowMcpServer };
}

const CTX = { actor: { label: "test", via: "mcp" as const } };
const ORIGIN = "https://example.test";

const namesOf = async (server: ServerLike) => (await (await connect(server)).listTools()).tools.map((t) => t.name).sort();

test("combined connector serves exactly the tools of the checklist, tracker and workflow connectors, plus the config plan", async () => {
  const m = await load();
  const combined = await namesOf(m.createCombinedMcpServer(ORIGIN, CTX));
  const separate = [
    ...(await namesOf(m.createMcpServer())),
    ...(await namesOf(m.createTrackerMcpServer())),
    ...(await namesOf(m.createWorkflowMcpServer(ORIGIN))),
    "get_config_plan", // the Configuration Plan area is served on the combined URL only
  ].sort();
  assert.equal(new Set(combined).size, combined.length, "no duplicate tool names");
  assert.deepEqual(combined, separate);
  for (const probe of ["list_checklists", "list_tracker_projects", "create_workflow_from_spec", "run_gap_check", "get_config_plan"]) {
    assert.ok(combined.includes(probe), `${probe} is served`);
  }
});

test("combined connector's instructions cover every area and keep the sharing rule", async () => {
  const m = await load();
  const text = m.combinedInstructions(m.combinedModules(ORIGIN));
  assert.match(text, /Project Tracker/);
  assert.match(text, /Workflow Builder/);
  assert.match(text, /Configuration Plan/);
  assert.match(text, /ONLY for when the user explicitly asks/);
});

test("combined auth: sign-in is the default, the key is header-only and separate from the other keys", async () => {
  const { validateCombinedMcpAuth } = await load();
  const saved = { c: process.env.COMBINED_MCP_API_KEY, t: process.env.TRACKER_MCP_API_KEY, w: process.env.WORKFLOW_MCP_API_KEY, m: process.env.MCP_API_KEY };
  const key = "k".repeat(40);
  const req = (headers: Record<string, string> = {}, url = "https://example.test/api/mcp/all") => new Request(url, { method: "POST", headers });
  try {
    delete process.env.COMBINED_MCP_API_KEY;
    assert.equal(validateCombinedMcpAuth(req({ authorization: `Bearer ${key}` })).valid, false, "no key configured: nothing is accepted");

    process.env.COMBINED_MCP_API_KEY = "short";
    assert.equal(validateCombinedMcpAuth(req({ authorization: "Bearer short" })).valid, false, "a short key is refused");

    process.env.COMBINED_MCP_API_KEY = key;
    assert.equal(validateCombinedMcpAuth(req({ authorization: `Bearer ${key}` })).valid, true);
    assert.equal(validateCombinedMcpAuth(req({ authorization: `Bearer ${"x".repeat(40)}` })).valid, false);
    assert.equal(validateCombinedMcpAuth(req({}, `https://example.test/api/mcp/all?api_key=${key}`)).valid, false, "never read from the address");

    // the single-area keys must not open the combined connector
    process.env.TRACKER_MCP_API_KEY = "t".repeat(40);
    process.env.WORKFLOW_MCP_API_KEY = "w".repeat(40);
    process.env.MCP_API_KEY = "m".repeat(40);
    for (const other of ["t", "w", "m"]) {
      assert.equal(validateCombinedMcpAuth(req({ authorization: `Bearer ${other.repeat(40)}` })).valid, false);
    }
  } finally {
    for (const [name, v] of [["COMBINED_MCP_API_KEY", saved.c], ["TRACKER_MCP_API_KEY", saved.t], ["WORKFLOW_MCP_API_KEY", saved.w], ["MCP_API_KEY", saved.m]] as const) {
      if (v === undefined) delete process.env[name];
      else process.env[name] = v;
    }
  }
});
