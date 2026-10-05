import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";
import {
  assertUniqueToolNames,
  buildMcpServer,
  defineTool,
  type ToolContext,
  type ToolModule,
} from "../src/lib/mcp/toolkit";

const CTX: ToolContext = { actor: { label: "Test caller", via: "mcp" } };

class FriendlyError extends Error {}

type ServerLike = { connect: (t: never) => Promise<void> };

async function connect(server: ServerLike) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1" });
  await Promise.all([server.connect(serverSide as never), client.connect(clientSide)]);
  return client;
}

function textOf(result: unknown): string {
  const content = (result as { content: { type: string; text: string }[] }).content;
  return content.map((c) => c.text).join("");
}

/** The tracker and checklist modules load the database client on import, which wants a URL (nothing is queried). */
async function loadModules() {
  process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:1/test";
  const tracker = await import("../src/lib/mcp/tracker");
  const modules = await import("../src/lib/mcp/modules");
  const docs = await import("../src/lib/mcp/tracker/docs");
  return { ...tracker, ...modules, ...docs };
}

// ---------------------------------------------------------------------------
// the toolkit itself, with a made-up module (no database)
// ---------------------------------------------------------------------------

const demoModule: ToolModule = {
  id: "demo",
  name: "Demo",
  instructions: "Demo instructions.",
  logPrefix: "demo-mcp",
  isUserError: (err): err is Error => err instanceof FriendlyError,
  tools: [
    defineTool({
      name: "echo",
      description: "Echo the text back, and say who is calling.",
      access: "read",
      input: { text: z.string() },
      handler: async ({ text }, ctx) => ({ text, caller: ctx.actor.label }),
    }),
    defineTool({
      name: "friendly_failure",
      description: "Always fails with a message meant for people.",
      access: "read",
      input: {},
      handler: async () => {
        throw new FriendlyError("That project is archived.");
      },
    }),
    defineTool({
      name: "unexpected_failure",
      description: "Always fails with an internal detail that must not be shown.",
      access: "read",
      input: {},
      handler: async () => {
        throw new Error("connection string postgres://user:SECRET@host leaked");
      },
    }),
    defineTool({
      name: "validation_failure",
      description: "Fails the way a service-layer schema check fails.",
      access: "read",
      input: {},
      handler: async () => {
        z.object({ due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse({ due: "tomorrow" });
        return null;
      },
    }),
  ],
};

test("toolkit: a handler's return value becomes JSON text, and the handler sees the caller", async () => {
  const client = await connect(buildMcpServer({ name: "Demo", version: "1" }, [demoModule], CTX));
  const result = await client.callTool({ name: "echo", arguments: { text: "hi" } });
  assert.notEqual(result.isError, true);
  assert.deepEqual(JSON.parse(textOf(result)), { text: "hi", caller: "Test caller" });
});

test("toolkit: errors written for people are shown, unexpected errors are not", async () => {
  const client = await connect(buildMcpServer({ name: "Demo", version: "1" }, [demoModule], CTX));

  const friendly = await client.callTool({ name: "friendly_failure", arguments: {} });
  assert.equal(friendly.isError, true);
  assert.equal(textOf(friendly), "That project is archived.");

  const original = console.error;
  console.error = () => {};
  try {
    const unexpected = await client.callTool({ name: "unexpected_failure", arguments: {} });
    assert.equal(unexpected.isError, true);
    assert.equal(textOf(unexpected), "Something went wrong. Please try again.");
    assert.ok(!textOf(unexpected).includes("SECRET"));
  } finally {
    console.error = original;
  }

  const invalid = await client.callTool({ name: "validation_failure", arguments: {} });
  assert.equal(invalid.isError, true);
  assert.match(textOf(invalid), /^Some fields need attention: due:/);
});

test("toolkit: the module's instructions reach the client", async () => {
  const client = await connect(buildMcpServer({ name: "Demo", version: "1" }, [demoModule], CTX));
  assert.equal(client.getInstructions(), "Demo instructions.");
});

test("toolkit: two tools with the same name are refused", () => {
  const dupe = defineTool({ name: "echo", description: "A second echo.", access: "read", input: {}, handler: async () => null });
  assert.throws(
    () => assertUniqueToolNames([demoModule, { id: "other", name: "Other", tools: [dupe] }]),
    /Tool name "echo" is used by both "demo" and "other"/
  );
});

// ---------------------------------------------------------------------------
// the real modules
// ---------------------------------------------------------------------------

test("tracker tools: every tool is well formed", async () => {
  const { trackerModule } = await loadModules();
  const names = trackerModule.tools.map((t) => t.name);
  assert.equal(new Set(names).size, names.length, "tool names must be unique");
  for (const t of trackerModule.tools) {
    assert.match(t.name, /^[a-z][a-z0-9_]*$/, `${t.name}: use snake_case`);
    assert.ok(t.description.trim().length >= 20, `${t.name}: write a description Claude can decide from`);
    assert.ok(t.access === "read" || t.access === "write", `${t.name}: access must be read or write`);
  }
});

test("tracker tools: there is no delete tool, and the read tools are the ones expected", async () => {
  const { trackerModule } = await loadModules();
  for (const t of trackerModule.tools) {
    assert.ok(!/delete|destroy|purge|drop|truncate/.test(t.name), `${t.name}: Claude must not be able to delete (use archive)`);
  }
  const reads = trackerModule.tools.filter((x) => x.access === "read").map((x) => x.name).sort();
  assert.deepEqual(reads, ["get_project_summary", "get_project_timeline", "list_accounts", "list_open_items", "list_people", "list_project_access", "list_project_files", "list_tracker_projects"]);
});

test("tracker server: serves exactly the tools in its module", async () => {
  const { trackerModule, createTrackerMcpServer } = await loadModules();
  const client = await connect(createTrackerMcpServer());
  const served = (await client.listTools()).tools.map((t) => t.name).sort();
  assert.deepEqual(served, trackerModule.tools.map((t) => t.name).sort());
});

test("checklist and tracker can be served together without a name clash", async () => {
  const { MCP_MODULES } = await loadModules();
  const client = await connect(buildMcpServer({ name: "Talkpush", version: "1" }, MCP_MODULES, CTX));
  const names = (await client.listTools()).tools.map((t) => t.name);
  assert.ok(names.includes("list_checklists"), "checklist tools are present");
  assert.ok(names.includes("list_tracker_projects"), "tracker tools are present");
  assert.equal(new Set(names).size, names.length);
});

test("the generated tool list is up to date (run `npm run mcp:docs` if this fails)", async () => {
  const { renderTrackerToolsDoc, TRACKER_TOOLS_DOC_PATH } = await loadModules();
  const committed = readFileSync(resolve(process.cwd(), TRACKER_TOOLS_DOC_PATH), "utf8");
  assert.equal(committed, renderTrackerToolsDoc());
});
