import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

/**
 * What the Workflow Builder tools say back, and where they put things: revision on every reply, short replies from
 * snapshot and auto_layout, notes placed beside their step, several entry channels, main-path labels.
 * Database parts run only against a LOCAL database.
 */
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

test("tool replies (local DB): revision everywhere, short snapshot and layout replies, notes and connectors placed sensibly", { skip }, async () => {
  process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:1/test";
  const { createWorkflowMcpServer } = await import("../src/lib/mcp/workflows");
  const { prisma } = await import("../src/lib/db");
  const client = await connect(createWorkflowMcpServer("https://example.test"));
  const call = async (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args });
  let id = "";
  try {
    // several entry channels, and labels on the main path
    const created = json(await call("create_workflow_from_flow_table", { clientName: "Replies test", workflowName: "Replies", rows: ROWS, approved: true, entryLabels: ["Facebook ad", "Careers page"] }));
    id = created.workflowId;
    const stored = await prisma.workflowProject.findUniqueOrThrow({ where: { id } });
    const nodes = stored.nodes as any[];
    const edges = stored.edges as any[];
    assert.deepEqual(nodes.filter((n) => n.type === "source").map((n) => n.data.label).sort(), ["Careers page", "Facebook ad"]);
    const firstStep = nodes.find((n) => n.data.label === "Applies");
    assert.equal(edges.filter((e) => e.target === firstStep.id && nodes.find((n) => n.id === e.source)?.type === "source").length, 2, "both channels lead to the first step");
    const yes = edges.find((e) => nodes.find((n) => n.id === e.target)?.data.label === "Reviews profile");
    assert.equal(yes.data.label, "Yes", "the main-path connector keeps its label");

    // get_workflow and every change say the revision
    const wf = json(await call("get_workflow", { workflowId: id }));
    assert.equal(typeof wf.revision, "number");
    const renamed = json(await call("update_node", { workflowId: id, nodeId: firstStep.id, label: "Applies now", baseRevision: wf.revision }));
    assert.equal(renamed.revision, wf.revision + 1, "the reply says the new revision, ready for the next call");

    // a note goes beside its step straight away, not at the bottom-left
    const review = nodes.find((n) => n.data.label === "Reviews profile");
    const added = json(await call("add_node", { workflowId: id, type: "note", noteKind: "needs_input", label: "To confirm", notes: "How long?", attachTo: review.id, baseRevision: renamed.revision }));
    const afterNote = (await prisma.workflowProject.findUniqueOrThrow({ where: { id } })).nodes as any[];
    const note = afterNote.find((n) => n.id === added.nodeId);
    const stepNow = afterNote.find((n) => n.id === review.id);
    assert.ok(Math.abs(note.position.x - stepNow.position.x) < 200, "note is near its step horizontally");
    assert.ok(note.position.y < stepNow.position.y, "and above a main-path step");

    // a connector to a note does not leave from the side the real paths use
    const decisionNode = afterNote.find((n) => n.data.label === "All pass?");
    const link = json(await call("add_edge", { workflowId: id, sourceNodeId: decisionNode.id, targetNodeId: added.nodeId, label: "Why", baseRevision: added.revision }));
    const edgeNow = ((await prisma.workflowProject.findUniqueOrThrow({ where: { id } })).edges as any[]).find((e) => e.id === link.edgeId);
    assert.notEqual(edgeNow.sourceHandle, "right", "not the side the Yes path leaves from");

    // snapshot and auto_layout answer briefly
    const snap = json(await call("create_version_snapshot", { workflowId: id, label: "check" }));
    assert.ok(snap.version.versionNumber >= 1 && !("nodes" in snap.version) && !("edges" in snap.version), "a summary, not the canvas");
    const layout = json(await call("auto_layout", { workflowId: id }));
    assert.ok(!("nodes" in layout), "no list of every node");
    assert.equal(typeof layout.moved, "number");
    assert.equal(layout.nodeCount, afterNote.length);
    assert.equal(typeof layout.revision, "number");
  } finally {
    if (id) await prisma.workflowProject.delete({ where: { id } }).catch(() => undefined);
  }
});
