import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

/**
 * Workflow Builder MCP tools. The first group needs no database. The last test talks to a real database
 * and only runs when WORKFLOW_TEST_DATABASE_URL points at localhost (it never runs against Supabase).
 */

const EXPECTED_TOOLS = [
  "add_call_note", "add_edge", "add_node", "add_recovery_edge", "add_scoping_artifact", "auto_layout",
  "clear_campaign_structure", "create_from_template", "create_version_snapshot", "create_workflow",
  "create_workflow_from_scoping_notes", "create_workflow_from_spec", "delete_node", "delete_scoping_artifact",
  "design_campaign_structure", "duplicate_workflow", "generate_customer_summary", "get_template", "get_workflow",
  "list_scoping_artifacts", "list_templates", "list_versions", "list_workflows", "renumber_steps",
  "restore_version", "share_workflow", "update_node", "update_scoping_artifact", "validate_workflow",
];

// Decide the database before anything loads the database client (it reads the address once, on first import).
const testDb = process.env.WORKFLOW_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) process.env.DATABASE_URL_DIRECT = testDb;

type ServerLike = { connect: (t: never) => Promise<void> };

async function connect(server: ServerLike) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1" });
  await Promise.all([server.connect(serverSide as never), client.connect(clientSide)]);
  return client;
}

const textOf = (result: unknown) =>
  (result as { content: { text: string }[] }).content.map((c) => c.text).join("");

async function load() {
  process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:1/test";
  return import("../src/lib/mcp/workflows");
}

test("workflow MCP: still serves all 29 original tools, by their original names (new tools are added on top)", async () => {
  const { createWorkflowMcpServer } = await load();
  const client = await connect(createWorkflowMcpServer("https://example.test"));
  const names = (await client.listTools()).tools.map((t) => t.name).sort();
  for (const n of EXPECTED_TOOLS) assert.ok(names.includes(n), `${n} is still there`);
  assert.equal(EXPECTED_TOOLS.length, 29);
});

test("workflow MCP: the original required inputs are still required", async () => {
  const { createWorkflowMcpServer } = await load();
  const client = await connect(createWorkflowMcpServer("https://example.test"));
  const tools = new Map((await client.listTools()).tools.map((t) => [t.name, t]));
  const required = (name: string) => [...((tools.get(name)?.inputSchema as { required?: string[] }).required ?? [])].sort();
  assert.deepEqual(required("create_workflow"), ["clientName", "workflowName"]);
  assert.deepEqual(required("add_node"), ["label", "type", "workflowId"]);
  assert.deepEqual(required("add_edge"), ["sourceNodeId", "targetNodeId", "workflowId"]);
  assert.deepEqual(required("restore_version"), ["versionId", "workflowId"]);
});

test("workflow MCP: reads are tagged read, and sharing is not a read", async () => {
  const { createWorkflowModule } = await load();
  const mod = createWorkflowModule("https://example.test");
  const access = new Map(mod.tools.map((t) => [t.name, t.access]));
  for (const name of ["get_workflow", "list_workflows", "validate_workflow", "renumber_steps"]) {
    assert.equal(access.get(name), "read", name);
  }
  for (const name of ["share_workflow", "add_node", "restore_version", "delete_node"]) {
    assert.equal(access.get(name), "write", name);
  }
});

test("workflow MCP: share_workflow says it is never called automatically", async () => {
  const { createWorkflowModule } = await load();
  const tool = createWorkflowModule("https://example.test").tools.find((t) => t.name === "share_workflow");
  assert.match(tool?.description ?? "", /never called automatically/i);
});

test("workflow MCP: tool names do not clash with the checklist or tracker connectors", async () => {
  const { createWorkflowModule } = await load();
  const { MCP_MODULES } = await import("../src/lib/mcp/modules");
  const others = new Set(MCP_MODULES.flatMap((m) => m.tools.map((t) => t.name)));
  const clashes = createWorkflowModule("https://example.test").tools.map((t) => t.name).filter((n) => others.has(n));
  assert.deepEqual(clashes, []);
});

test("workflow MCP: a bad input comes back as a friendly message, not a crash", async () => {
  const { createWorkflowMcpServer } = await load();
  const client = await connect(createWorkflowMcpServer("https://example.test"));
  const result = await client.callTool({ name: "add_node", arguments: { workflowId: "x" } });
  assert.equal((result as { isError?: boolean }).isError, true);
  assert.match(textOf(result), /need attention|label|type/i);
});

test("workflow MCP end to end (local database only): build from a spec, read it back, validate, edit, delete", { skip: !isLocalDb && "set WORKFLOW_TEST_DATABASE_URL to a localhost database" }, async () => {
  const { createWorkflowMcpServer } = await load();
  const { prisma } = await import("../src/lib/db");
  const client = await connect(createWorkflowMcpServer("https://example.test"));
  let workflowId = "";
  try {
    const created = JSON.parse(
      textOf(
        await client.callTool({
          name: "create_workflow_from_spec",
          arguments: {
            clientName: "MCP test client",
            workflowName: "MCP test flow",
            nodes: [
              { tempId: "n1", type: "source", label: "Facebook Messenger", actor: "source" },
              { tempId: "n2", type: "stage", label: "Prescreening chatbot", actor: "automated" },
              { tempId: "n3", type: "decision", label: "Passed prescreening?", actor: "automated" },
              { tempId: "n4", type: "manual_action", label: "Recruiter interview", actor: "manual", actorLabel: "Recruiter", data: { ownerRole: "Recruiter" } },
              { tempId: "n5", type: "communication", label: "Rejection SMS", actor: "automated", data: { channel: "sms" } },
            ],
            edges: [
              { sourceTempId: "n1", targetTempId: "n2" },
              { sourceTempId: "n2", targetTempId: "n3" },
              { sourceTempId: "n3", targetTempId: "n4", label: "Pass", isHappyPath: true, isPrimary: true },
              { sourceTempId: "n3", targetTempId: "n5", label: "Fail" },
            ],
          },
        })
      )
    );
    workflowId = created.workflowId;
    assert.ok(workflowId, "a workflow id comes back");
    assert.match(created.editUrl, /^https:\/\/example\.test\/admin\/workflows\//);

    const got = JSON.parse(textOf(await client.callTool({ name: "get_workflow", arguments: { workflowId } })));
    assert.equal(got.nodes?.length ?? got.workflow?.nodes?.length, 5);

    const valid = JSON.parse(textOf(await client.callTool({ name: "validate_workflow", arguments: { workflowId } })));
    assert.ok(Array.isArray(valid.findings));

    const added = await client.callTool({ name: "add_node", arguments: { workflowId, type: "wait", label: "Wait 24 hours" } });
    assert.ok(!(added as { isError?: boolean }).isError, textOf(added));
  } finally {
    if (workflowId) await prisma.workflowProject.delete({ where: { id: workflowId } }).catch(() => undefined);
    await prisma.$disconnect();
  }
});
