import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

/**
 * The look of a map ("original" or "readable"), kept on the map itself. Existing maps are "original" and nothing may change
 * how they are drawn or arranged; new maps are "readable". Database parts run only against a LOCAL database.
 */
const testDb = process.env.WORKFLOW_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) process.env.DATABASE_URL_DIRECT = testDb;
const skip = !isLocalDb && "set WORKFLOW_TEST_DATABASE_URL to a localhost database";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function connect(server: { connect: (t: never) => Promise<void> }) {
  const [c, s] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1" });
  await Promise.all([server.connect(s as never), client.connect(c)]);
  return client;
}
const json = (r: unknown) => JSON.parse((r as { content: { text: string }[] }).content.map((c) => c.text).join(""));

const ROWS = [
  { step: "1", actor: "Candidate", action: "Applies", actionType: "Candidate" },
  { step: "2", actor: "Talkpush", action: "Prescreening", actionType: "System" },
  { step: "3", actor: "Talkpush", action: "All pass?", kind: "decision" },
  { step: "3.1", actor: "Talkpush", action: "Moves to Rejected", actionType: "Move", branch: "No" },
  { step: "3.1", actor: "Talkpush", action: "Rejected", kind: "end", endKind: "failure" },
  { step: "4", actor: "Recruiter", action: "Reviews profile", branch: "Yes" },
  { step: "5", actor: "Talkpush", action: "Hired", kind: "end", endKind: "success" },
];

test("look (local DB): new maps are readable, 'original' keeps the old arrangement, copies keep their look, switching re-arranges", { skip }, async () => {
  process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:1/test";
  const { createWorkflowMcpServer } = await import("../src/lib/mcp/workflows");
  const { prisma } = await import("../src/lib/db");
  const { layoutDiagram } = await import("../src/lib/workflow/process-map/diagram-layout");
  const client = await connect(createWorkflowMcpServer("https://example.test"));
  const call = async (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args });
  const ids: string[] = [];
  const row = (id: string) => prisma.workflowProject.findUniqueOrThrow({ where: { id } });
  const pos = (nodes: any[]) => nodes.map((n) => `${n.id}:${Math.round(n.position.x)},${Math.round(n.position.y)}`).join("|");
  try {
    const fresh = json(await call("create_workflow_from_flow_table", { clientName: "Look test", workflowName: "New map", rows: ROWS, approved: true }));
    ids.push(fresh.workflowId);
    assert.equal((await row(fresh.workflowId)).look, "readable", "a new map is readable");
    // Move steps get the Folder/Stage wording in the stored text.
    const stored = (await row(fresh.workflowId)).nodes as any[];
    assert.ok(stored.some((n) => n.data.label === "Moves to **Rejected** Folder/Stage"));

    const old = json(await call("create_workflow_from_flow_table", { clientName: "Look test", workflowName: "Old look", rows: ROWS, approved: true, look: "original" }));
    ids.push(old.workflowId);
    assert.equal((await row(old.workflowId)).look, "original");
    // An original map is arranged exactly as before: the arrangement is the one the original look gives.
    const oldNodes = (await row(old.workflowId)).nodes as any[];
    const oldEdges = (await row(old.workflowId)).edges as any[];
    const expected = layoutDiagram(oldNodes, oldEdges, "original");
    for (const n of oldNodes) assert.equal(Math.round(n.position.x), Math.round(expected.positions.get(n.id)!.x), `${n.id} x`);
    // The two looks arrange the same steps differently (the readable look is roomier).
    const freshNodes = (await row(fresh.workflowId)).nodes as any[];
    assert.notEqual(pos(freshNodes).replace(/node_\w+/g, "n"), pos(oldNodes).replace(/node_\w+/g, "n"));

    // Anything that arranges an original map keeps using the original look.
    json(await call("auto_layout", { workflowId: old.workflowId }));
    const again = (await row(old.workflowId)).nodes as any[];
    assert.equal(pos(again), pos(oldNodes), "auto_layout leaves an original map where it was");

    // A map that predates the column is "original" by default.
    await prisma.$executeRawUnsafe(`UPDATE "WorkflowProject" SET "look" = DEFAULT WHERE id = '${old.workflowId}'`);
    assert.equal((await row(old.workflowId)).look, "original");

    // A copy looks like its source.
    const copy = json(await call("duplicate_workflow", { workflowId: old.workflowId }));
    ids.push(copy.workflowId);
    assert.equal((await row(copy.workflowId)).look, "original");

    // Switching the look takes a snapshot, arranges again and bumps the revision; it is refused for the Classic style.
    const before = (await row(old.workflowId)).revision;
    const switched = json(await call("set_diagram_look", { workflowId: old.workflowId, look: "readable" }));
    assert.equal(switched.look, "readable");
    const after = await row(old.workflowId);
    assert.equal(after.look, "readable");
    assert.ok(after.revision > before);
    assert.notEqual(pos(after.nodes as any[]), pos(oldNodes));
    const bad = await call("set_diagram_look", { workflowId: old.workflowId, look: "fancy" });
    assert.ok((bad as any).isError);
  } finally {
    for (const id of ids) await prisma.workflowProject.delete({ where: { id } }).catch(() => undefined);
  }
});
