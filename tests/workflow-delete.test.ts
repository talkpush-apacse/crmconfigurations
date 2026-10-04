import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

/** delete_workflow: only a never-shared draft, only with its exact name. Database parts run only against a LOCAL database. */
const testDb = process.env.WORKFLOW_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) process.env.DATABASE_URL_DIRECT = testDb;
const skip = !isLocalDb && "set WORKFLOW_TEST_DATABASE_URL to a localhost database";

/* eslint-disable @typescript-eslint/no-explicit-any */
type ServerLike = { connect: (t: never) => Promise<void> };
async function connect(server: ServerLike) {
  const [c, s] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1" });
  await Promise.all([server.connect(s as never), client.connect(c)]);
  return client;
}
const textOf = (r: unknown) => (r as { content: { text: string }[] }).content.map((c) => c.text).join("");
const json = (r: unknown) => JSON.parse(textOf(r));

test("delete_workflow says it is permanent, name-confirmed and only for never-shared workflows", async () => {
  process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:1/test";
  const { createWorkflowMcpServer } = await import("../src/lib/mcp/workflows");
  const client = await connect(createWorkflowMcpServer("https://example.test"));
  const tool = (await client.listTools()).tools.find((t) => t.name === "delete_workflow")!;
  assert.ok(tool, "the tool exists");
  assert.match(tool.description ?? "", /never shared/i);
  assert.match(tool.description ?? "", /cannot be undone/i);
  assert.match(tool.description ?? "", /explicitly asks/i);
  assert.deepEqual((tool.inputSchema as any).required.sort(), ["confirmName", "workflowId"]);
});

test("delete_workflow (local DB): wrong name refused, shared refused, never-shared draft deleted", { skip }, async () => {
  process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:1/test";
  const { createWorkflowMcpServer } = await import("../src/lib/mcp/workflows");
  const { prisma } = await import("../src/lib/db");
  const client = await connect(createWorkflowMcpServer("https://example.test"));
  const call = async (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args });
  const ids: string[] = [];
  const rows = [{ step: "1", actor: "Talkpush", action: "Does it" }];
  try {
    const plain = json(await call("create_workflow_from_flow_table", { clientName: "Delete test", workflowName: "Plain draft", rows, approved: true }));
    const shared = json(await call("create_workflow_from_flow_table", { clientName: "Delete test", workflowName: "Shared draft", rows, approved: true }));
    ids.push(plain.workflowId, shared.workflowId);

    // the wrong name is refused and nothing is deleted
    const wrong = await call("delete_workflow", { workflowId: plain.workflowId, confirmName: "plain draft" });
    assert.equal((wrong as any).isError, true);
    assert.match(textOf(wrong), /exactly as it is/);
    assert.ok(await prisma.workflowProject.findUnique({ where: { id: plain.workflowId } }), "still there");

    // a workflow with a review link is refused, with the reason, and nothing is deleted
    const made = await call("create_link", { workflowId: shared.workflowId, level: "view" });
    assert.equal((made as any).isError, undefined, textOf(made));
    const refused = await call("delete_workflow", { workflowId: shared.workflowId, confirmName: "Shared draft" });
    assert.equal((refused as any).isError, true);
    assert.match(textOf(refused), /shared or reviewed/);
    assert.match(textOf(refused), /review link/);
    assert.ok(await prisma.workflowProject.findUnique({ where: { id: shared.workflowId } }), "still there");

    // a published version also blocks it
    const published = json(await call("create_workflow_from_flow_table", { clientName: "Delete test", workflowName: "Published draft", rows, approved: true }));
    ids.push(published.workflowId);
    const pub = await call("publish_version", { workflowId: published.workflowId });
    assert.equal((pub as any).isError, undefined, textOf(pub));
    const pubRefused = await call("delete_workflow", { workflowId: published.workflowId, confirmName: "Published draft" });
    assert.equal((pubRefused as any).isError, true);
    assert.match(textOf(pubRefused), /published or approved/);

    // a never-shared draft is deleted, along with everything under it
    const done = json(await call("delete_workflow", { workflowId: plain.workflowId, confirmName: "Plain draft" }));
    assert.equal(done.deleted, true);
    assert.equal(await prisma.workflowProject.findUnique({ where: { id: plain.workflowId } }), null, "gone");
    assert.equal(await prisma.workflowVersion.count({ where: { workflowId: plain.workflowId } }), 0, "its versions went with it");
    const again = await call("delete_workflow", { workflowId: plain.workflowId, confirmName: "Plain draft" });
    assert.equal((again as any).isError, true, "a second delete says it is not found");
    assert.match(textOf(again), /not found/i);
  } finally {
    for (const id of ids) await prisma.workflowProject.delete({ where: { id } }).catch(() => undefined);
  }
});
