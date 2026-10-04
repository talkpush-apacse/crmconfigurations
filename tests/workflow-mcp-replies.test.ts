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
const textOf = (r: unknown) => (r as { content: { text: string }[] }).content.map((c) => c.text).join("");
const json = (r: unknown) => JSON.parse(textOf(r));

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
    const created = json(await call("create_workflow_from_flow_table", { clientName: "Replies test", workflowName: "Replies", rows: ROWS, approved: true, layout: "spine", entryLabels: ["Facebook ad", "Careers page"] }));
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

test("channel and cadence (local DB): rows carry channel and timing onto the box, the flow table and the gap check", { skip }, async () => {
  process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:1/test";
  const { createWorkflowMcpServer } = await import("../src/lib/mcp/workflows");
  const { prisma } = await import("../src/lib/db");
  const client = await connect(createWorkflowMcpServer("https://example.test"));
  const call = async (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args });
  let id = "";
  try {
    const rows = [
      { step: "1", actor: "Talkpush", action: "Moves to Rejected", actionType: "Move" },
      { step: "2", actor: "Talkpush", action: "Sends rejection notice", actionType: "Message", channel: "Email", timing: "1 hour after" },
      { step: "3", actor: "Talkpush", action: "Sends reminder", actionType: "Message" },
      { step: "4", actor: "Talkpush", action: "Done", kind: "end", endKind: "neutral" },
    ];
    id = json(await call("create_workflow_from_flow_table", { clientName: "Cadence test", workflowName: "Cadence", rows, approved: true })).workflowId;

    const table = json(await call("get_flow_table", { workflowId: id }));
    assert.ok(table.columns.includes("Channel · When"));
    assert.equal(table.rows.find((r: any) => r.action === "Sends rejection notice").channelWhen, "Email · 1 hour after");

    const preview = json(await call("render_preview", { workflowId: id, audience: "client" }));
    assert.ok(preview.svg.includes("Email · 1 hour after"), "the box shows Channel · When");

    const gaps = json(await call("run_gap_check", { workflowId: id }));
    const missing = gaps.findings.filter((f: any) => f.code === "comm_channel_or_timing_missing");
    assert.equal(missing.length, 1, "only the reminder with nothing set is listed");
    assert.match(missing[0].message, /Sends reminder/);
  } finally {
    if (id) await prisma.workflowProject.delete({ where: { id } }).catch(() => undefined);
  }
});

// ---------- lanes through the connector, and the classic single row ----------
const THREE_ACTORS = [
  { step: "1", actor: "Candidate", action: "Applies", actionType: "Candidate" },
  { step: "2", actor: "Talkpush", action: "Chatbot prescreening", actionType: "System" },
  { step: "3", actor: "Talkpush", action: "All pass?", kind: "decision" },
  { step: "3.1", actor: "Talkpush", action: "Marks as Rejected", actionType: "Move", branch: "No" },
  { step: "3.1", actor: "Talkpush", action: "Rejected", kind: "end", endKind: "failure" },
  { step: "4", actor: "Recruiter", action: "Reviews profile", branch: "Yes" },
  { step: "5", actor: "Talkpush", action: "Hired", kind: "end", endKind: "success" },
];
const WITH_ASSESSMENT = [
  { step: "1", actor: "Candidate", action: "Applies", actionType: "Candidate", stage: "1. Apply" },
  { step: "2", actor: "Talkpush", action: "Sends details to the platform", actionType: "Send Data", system: "Assessment platform", stage: "2. Assessment" },
  { step: "3", actor: "Assessment platform", action: "Scores the assessment", actionType: "System", external: true },
  { step: "4", actor: "Talkpush", action: "Receives the score", actionType: "Get Data" },
  { step: "5", actor: "Talkpush", action: "Done", kind: "end", endKind: "success" },
];

test("lanes through the connector (local DB): chosen from the table, said in the reply, stored, drawn, readable back", { skip }, async () => {
  process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:1/test";
  const { createWorkflowMcpServer } = await import("../src/lib/mcp/workflows");
  const { prisma } = await import("../src/lib/db");
  const client = await connect(createWorkflowMcpServer("https://example.test"));
  const call = async (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args });
  const ids: string[] = [];
  try {
    const auto = json(await call("create_workflow_from_flow_table", { clientName: "Lanes test", workflowName: "Three actors", rows: THREE_ACTORS, approved: true }));
    ids.push(auto.workflowId);
    assert.equal(auto.layout, "lanes");
    assert.match(auto.layoutReason, /3 different actors \(Candidate, Talkpush automation, Recruiter\)/);
    assert.deepEqual(auto.lanes, ["Candidate", "Talkpush automation", "Recruiter"]);
    const stored = await prisma.workflowProject.findUniqueOrThrow({ where: { id: auto.workflowId } });
    assert.ok((stored.nodes as any[]).some((n) => n.data.lane === "Recruiter"), "the lane is stored on the step");

    const rich = json(await call("create_workflow_from_flow_table", { clientName: "Lanes test", workflowName: "With assessment", rows: WITH_ASSESSMENT, approved: true }));
    ids.push(rich.workflowId);
    assert.equal(rich.layout, "lanes");
    assert.deepEqual(rich.externalLanes, ["Assessment platform"]);
    assert.deepEqual(rich.stages, ["1. Apply", "2. Assessment"]);
    const table = json(await call("get_flow_table", { workflowId: rich.workflowId }));
    assert.ok(table.columns.includes("Lane") && table.columns.includes("Stage"));
    assert.equal(table.rows.find((r: any) => r.action === "Scores the assessment").lane, "Assessment platform");
    const preview = json(await call("render_preview", { workflowId: rich.workflowId, audience: "client" }));
    for (const word of ["2. Assessment", "Assessment platform", "another system", "Continues in"]) assert.ok(preview.svg.includes(word), word);
    assert.equal(json(await call("lint_layout", { workflowId: rich.workflowId })).counts.high, 0);

    const warned = json(await call("create_workflow_from_flow_table", { clientName: "Lanes test", workflowName: "Unused outside system", rows: THREE_ACTORS.slice(0, 2), approved: true, externalLanes: ["HRIS"] }));
    ids.push(warned.workflowId);
    assert.equal(warned.layout, "spine");
    assert.match(warned.warning, /no step sits in that lane/);
  } finally {
    for (const id of ids) await prisma.workflowProject.delete({ where: { id } }).catch(() => undefined);
  }
});

test("the classic single row stays available (local DB): chosen for 2 actors, forced with layout spine, and exactly the old layout", { skip }, async () => {
  process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:1/test";
  const { createWorkflowMcpServer } = await import("../src/lib/mcp/workflows");
  const { prisma } = await import("../src/lib/db");
  const { layoutProcessMap } = await import("../src/lib/workflow/process-map/layout");
  const client = await connect(createWorkflowMcpServer("https://example.test"));
  const call = async (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args });
  const ids: string[] = [];
  const nodesOf = async (id: string) => (await prisma.workflowProject.findUniqueOrThrow({ where: { id } })).nodes as any[];
  const edgesOf = async (id: string) => (await prisma.workflowProject.findUniqueOrThrow({ where: { id } })).edges as any[];
  try {
    const two = json(await call("create_workflow_from_flow_table", { clientName: "Spine test", workflowName: "Two actors", rows: THREE_ACTORS.filter((r) => r.actor !== "Recruiter"), approved: true }));
    ids.push(two.workflowId);
    assert.equal(two.layout, "spine");
    assert.match(two.layoutReason, /Single row/);

    // three actors AND stages AND an outside system, but forced to the classic single row
    const forced = json(await call("create_workflow_from_flow_table", { clientName: "Spine test", workflowName: "Forced spine", rows: WITH_ASSESSMENT, approved: true, layout: "spine" }));
    ids.push(forced.workflowId);
    assert.equal(forced.layout, "spine");
    const nodes = await nodesOf(forced.workflowId);
    const edges = await edgesOf(forced.workflowId);
    assert.ok(nodes.every((n) => n.data.lane === undefined && n.data.stage === undefined && n.data.laneKind === undefined), "no lane fields at all");
    const old = layoutProcessMap(nodes, edges);
    for (const n of nodes) {
      const p = old.positions.get(n.id)!;
      assert.equal(Math.round(n.position.x), Math.round(p.x), `${n.data.label}: x is the classic single-row position`);
      assert.equal(Math.round(n.position.y), Math.round(p.y), `${n.data.label}: y is the classic single-row position`);
    }
    const preview = json(await call("render_preview", { workflowId: forced.workflowId }));
    assert.ok(!preview.svg.includes("another system") && !preview.svg.includes("Continues in"), "no lanes, no stage circles");
    assert.ok(preview.svg.includes("Candidate entry") || preview.svg.includes("Journey"), "the classic frames");
    const mainRow = nodes.filter((n) => ["Applies", "Sends details to the platform", "Scores the assessment", "Receives the score"].includes(n.data.label));
    assert.equal(new Set(mainRow.map((n) => Math.round(n.position.y + 45))).size <= 2, true, "the main path runs along one row");
  } finally {
    for (const id of ids) await prisma.workflowProject.delete({ where: { id } }).catch(() => undefined);
  }
});

test("switching a map between lanes and the single row (local DB): nothing lost, numbers unchanged, snapshot taken, classic style refused", { skip }, async () => {
  process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:1/test";
  const { createWorkflowMcpServer } = await import("../src/lib/mcp/workflows");
  const { prisma } = await import("../src/lib/db");
  const client = await connect(createWorkflowMcpServer("https://example.test"));
  const call = async (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args });
  const ids: string[] = [];
  const steps = async (id: string) => json(await call("get_flow_table", { workflowId: id })).rows.map((r: any) => [r.step, r.action]);
  try {
    const m = json(await call("create_workflow_from_flow_table", { clientName: "Switch test", workflowName: "Switch", rows: THREE_ACTORS, approved: true, layout: "spine" }));
    ids.push(m.workflowId);
    const before = await steps(m.workflowId);
    const versions0 = await prisma.workflowVersion.count({ where: { workflowId: m.workflowId } });

    const toLanes = json(await call("set_diagram_layout", { workflowId: m.workflowId, layout: "lanes" }));
    assert.equal(toLanes.layout, "lanes");
    assert.deepEqual(toLanes.lanes, ["Candidate", "Talkpush automation", "Recruiter"], "a table and a switched map give the automated steps the same lane");
    assert.ok(toLanes.stepsUpdated > 0);
    assert.deepEqual(await steps(m.workflowId), before, "same steps, same numbers");
    assert.ok((await prisma.workflowVersion.count({ where: { workflowId: m.workflowId } })) > versions0, "a snapshot was taken first");
    assert.equal(json(await call("lint_layout", { workflowId: m.workflowId })).counts.high, 0);
    // a new note lands in its step's lane, under it, straight away
    const review = ((await prisma.workflowProject.findUniqueOrThrow({ where: { id: m.workflowId } })).nodes as any[]).find((n) => n.data.label === "Reviews profile");
    const added = json(await call("add_node", { workflowId: m.workflowId, type: "note", noteKind: "info", label: "Hint", notes: "Detail", attachTo: review.id }));
    const afterNodes = (await prisma.workflowProject.findUniqueOrThrow({ where: { id: m.workflowId } })).nodes as any[];
    const note = afterNodes.find((n) => n.id === added.nodeId);
    const stepNow = afterNodes.find((n) => n.id === review.id);
    assert.ok(Math.abs(note.position.x - stepNow.position.x) < 60, "in the step's column");
    assert.ok(note.position.y > stepNow.position.y, "under the step, inside its lane");
    assert.equal(json(await call("lint_layout", { workflowId: m.workflowId })).counts.high, 0);
    await call("delete_node", { workflowId: m.workflowId, nodeId: added.nodeId });

    const toSpine = json(await call("set_diagram_layout", { workflowId: m.workflowId, layout: "spine" }));
    assert.equal(toSpine.layout, "spine");
    const nodes = (await prisma.workflowProject.findUniqueOrThrow({ where: { id: m.workflowId } })).nodes as any[];
    assert.ok(nodes.every((n) => n.data.lane === undefined), "lanes removed");
    assert.deepEqual(await steps(m.workflowId), before, "and the numbers are still the same");

    const bad = await call("set_diagram_layout", { workflowId: m.workflowId, layout: "sideways" });
    assert.equal((bad as any).isError, true);

    const classic = json(await call("create_workflow", { clientName: "Switch test", workflowName: "Classic look" }));
    ids.push(classic.workflowId);
    const refused = await call("set_diagram_layout", { workflowId: classic.workflowId, layout: "lanes" });
    assert.equal((refused as any).isError, true, "the Classic look has no lanes");
    assert.match(textOf(refused), /Process Map style/);
  } finally {
    for (const id of ids) await prisma.workflowProject.delete({ where: { id } }).catch(() => undefined);
  }
});

test("a single step can be given a lane, a stage and an outside-system flag, and can be cleared again (local DB)", { skip }, async () => {
  process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:1/test";
  const { createWorkflowMcpServer } = await import("../src/lib/mcp/workflows");
  const { prisma } = await import("../src/lib/db");
  const client = await connect(createWorkflowMcpServer("https://example.test"));
  const call = async (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args });
  let id = "";
  try {
    id = json(await call("create_workflow_from_flow_table", { clientName: "Step test", workflowName: "One step", rows: THREE_ACTORS.filter((r) => r.actor !== "Recruiter"), approved: true })).workflowId;
    const read = async () => (await prisma.workflowProject.findUniqueOrThrow({ where: { id } })).nodes as any[];
    const step = (await read()).find((n) => n.data.label === "Chatbot prescreening");
    await call("update_node", { workflowId: id, nodeId: step.id, lane: "Vendor", stage: "1. Screening", external: true });
    const set = (await read()).find((n) => n.id === step.id);
    assert.deepEqual([set.data.lane, set.data.stage, set.data.laneKind], ["Vendor", "1. Screening", "external"]);
    const laid = json(await call("auto_layout", { workflowId: id }));
    assert.equal(laid.style, "process_map");
    await call("update_node", { workflowId: id, nodeId: step.id, lane: "", stage: "", external: false });
    const cleared = (await read()).find((n) => n.id === step.id);
    assert.deepEqual([cleared.data.lane, cleared.data.stage, cleared.data.laneKind], ["", "", ""]);
  } finally {
    if (id) await prisma.workflowProject.delete({ where: { id } }).catch(() => undefined);
  }
});
