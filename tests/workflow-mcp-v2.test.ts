import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

/** The version 2 Workflow Builder tools, through a real MCP connection. Database parts run only against a LOCAL database. */

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
async function load() {
  process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:1/test";
  return import("../src/lib/mcp/workflows");
}

const NEW_TOOLS = ["list_pages", "add_page", "rename_page", "delete_page", "update_edge", "delete_edge", "get_flow_table", "create_workflow_from_flow_table", "propose_changes", "run_gap_check", "lint_layout", "render_preview", "diff_versions", "publish_version", "set_diagram_style", "list_access", "create_link", "disable_link", "invite_person", "revoke_person", "list_suggestions", "accept_suggestion", "reject_suggestion", "list_comments"];

test("mcp v2: the original 29 tools are still there, plus 24 new ones, with no name clashes", async () => {
  const { createWorkflowMcpServer } = await load();
  const client = await connect(createWorkflowMcpServer("https://example.test"));
  const names = (await client.listTools()).tools.map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
  assert.equal(names.length, 53);
  for (const n of NEW_TOOLS) assert.ok(names.includes(n), n);
});

test("mcp v2: page and revision options were added to the tools that need them", async () => {
  const { createWorkflowMcpServer } = await load();
  const client = await connect(createWorkflowMcpServer("https://example.test"));
  const tools = new Map((await client.listTools()).tools.map((t) => [t.name, t]));
  const props = (n: string) => Object.keys((tools.get(n)!.inputSchema as any).properties);
  for (const n of ["add_node", "update_node", "delete_node", "add_edge", "auto_layout", "validate_workflow", "get_workflow"]) assert.ok(props(n).includes("page"), `${n} has page`);
  for (const n of ["add_node", "update_node", "delete_node", "auto_layout", "add_edge"]) assert.ok(props(n).includes("baseRevision"), `${n} has baseRevision`);
  assert.ok(!props("get_workflow").includes("baseRevision"), "reads have no revision guard");
  assert.ok(props("add_node").includes("actionType") && props("add_node").includes("endKind"));
});

test("mcp v2: sharing tools say they are only for when the user asks; reads are tagged read", async () => {
  const { createWorkflowModule } = await load();
  const mod = createWorkflowModule("https://example.test");
  const by = new Map(mod.tools.map((t) => [t.name, t]));
  for (const n of ["create_link", "invite_person", "revoke_person", "disable_link", "accept_suggestion", "reject_suggestion", "publish_version", "share_workflow"]) {
    assert.match(by.get(n)!.description, /explicitly asks|never called automatically/i, n);
    assert.equal(by.get(n)!.access, "write", n);
  }
  for (const n of ["list_pages", "get_flow_table", "run_gap_check", "lint_layout", "render_preview", "diff_versions", "list_access", "list_suggestions", "list_comments"]) assert.equal(by.get(n)!.access, "read", n);
});

test("mcp v2: building from a flow table needs a yes first", async () => {
  const { createWorkflowMcpServer } = await load();
  const client = await connect(createWorkflowMcpServer("https://example.test"));
  const r = await client.callTool({ name: "create_workflow_from_flow_table", arguments: { clientName: "A", workflowName: "B", rows: [{ step: "1", actor: "Talkpush", action: "Do it" }], approved: false } });
  assert.equal((r as any).isError, true);
  assert.match(textOf(r), /approved: true|ask whether/i);
});

const ROWS = [
  { step: "1", actor: "Talkpush", action: "Send self-scheduling link", actionType: "Message" },
  { step: "2", actor: "Candidate", action: "Picks a slot", actionType: "Candidate" },
  { step: "3", actor: "Talkpush", action: "Attended?", kind: "decision" },
  { step: "3.1", actor: "Talkpush", action: "Send no-show recovery", actionType: "Message", branch: "3.1 · No" },
  { step: "3.1", actor: "Talkpush", action: "Manual follow-up", kind: "end", endKind: "neutral" },
  { step: "4", actor: "Recruiter", action: "Conducts the interview" },
  { step: "5", actor: "Talkpush", action: "Move to Hired", actionType: "Move" },
  { step: "5", actor: "Talkpush", action: "Hired", kind: "end", endKind: "success" },
];

test("mcp v2 end to end (local DB): table -> diagram -> checks -> edits on a second page -> diff -> style -> review tools", { skip }, async () => {
  const { createWorkflowMcpServer } = await load();
  const { prisma } = await import("../src/lib/db");
  const client = await connect(createWorkflowMcpServer("https://example.test"));
  const call = async (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args });
  let id = "";
  try {
    const created = json(await call("create_workflow_from_flow_table", { clientName: "V2 test", workflowName: "Interview flow", rows: ROWS, approved: true, entryLabel: "Qualified candidate" }));
    id = created.workflowId;
    assert.ok(id);
    const row = await prisma.workflowProject.findUniqueOrThrow({ where: { id } });
    assert.equal(row.diagramStyle, "process_map");

    // the flow table comes back as it went in
    const table = json(await call("get_flow_table", { workflowId: id }));
    assert.deepEqual(table.rows.map((r: any) => r.step), ["1", "2", "3", "3.1", "4", "5"]);
    assert.equal(table.rows.find((r: any) => r.step === "3.1").branch, "3.1 · No");

    // checks
    const lint = json(await call("lint_layout", { workflowId: id }));
    assert.equal(lint.counts.high, 0, JSON.stringify(lint.findings));
    const gaps = json(await call("run_gap_check", { workflowId: id, saveAsArtifacts: true }));
    assert.ok(gaps.summary.assumptions >= 1);
    assert.ok(gaps.savedAsArtifacts >= 1);
    const valid = json(await call("validate_workflow", { workflowId: id }));
    assert.ok(Array.isArray(valid.layout) && Array.isArray(valid.sanitization));

    // render preview: the same drawing, as SVG, and a client copy hides staff-only steps
    const preview = json(await call("render_preview", { workflowId: id }));
    assert.equal(preview.format, "svg");
    assert.ok(preview.svg.startsWith("<svg") && preview.svg.includes("Send self-scheduling link"));
    const png = await call("render_preview", { workflowId: id, format: "png" });
    assert.equal((png as any).isError, true);
    const wf0 = json(await call("get_workflow", { workflowId: id }));
    const secretNode = json(await call("add_node", { workflowId: id, type: "stage", label: "SECRET INTERNAL STEP", visibility: "internal", internalNotes: "x" }));
    const clientPreview = json(await call("render_preview", { workflowId: id, audience: "client" }));
    assert.ok(!clientPreview.svg.includes("SECRET INTERNAL STEP"));
    assert.ok(json(await call("render_preview", { workflowId: id, audience: "internal" })).svg.includes("SECRET INTERNAL STEP"));
    await call("delete_node", { workflowId: id, nodeId: secretNode.nodeId });
    void wf0;

    // pages: add a second page, add a step to it only
    const added = json(await call("add_page", { workflowId: id, name: "Onboarding" }));
    assert.ok(added.pageId);
    json(await call("add_node", { workflowId: id, page: "Onboarding", type: "stage", label: "Collect documents", actor: "automated" }));
    const pages = json(await call("list_pages", { workflowId: id })).pages;
    assert.deepEqual(pages.map((p: any) => p.name), ["Page 1", "Onboarding"]);
    assert.equal(pages[1].steps, 1);
    assert.ok(pages[0].steps >= 8, "page 1 untouched");
    const stored = await prisma.workflowProject.findUniqueOrThrow({ where: { id } });
    assert.equal((stored.nodes as any[]).length, pages[0].steps, "legacy columns still mirror page 1");
    await call("rename_page", { workflowId: id, page: "2", name: "Documents" });
    assert.equal(json(await call("list_pages", { workflowId: id })).pages[1].name, "Documents");

    // connectors
    const edges = (await prisma.workflowProject.findUniqueOrThrow({ where: { id } })).edges as any[];
    const e0 = edges[1];
    assert.equal((await call("update_edge", { workflowId: id, edgeId: e0.id, label: "Booked" }) as any).isError, undefined);
    const after = (await prisma.workflowProject.findUniqueOrThrow({ where: { id } })).edges as any[];
    assert.equal(after.find((e) => e.id === e0.id).data.label, "Booked");
    await call("delete_edge", { workflowId: id, edgeId: e0.id });
    assert.ok(!((await prisma.workflowProject.findUniqueOrThrow({ where: { id } })).edges as any[]).some((e) => e.id === e0.id));

    // revision guard
    const rev = (await prisma.workflowProject.findUniqueOrThrow({ where: { id } })).revision;
    const stale = await call("add_node", { workflowId: id, type: "stage", label: "Late", baseRevision: rev - 1 });
    assert.equal((stale as any).isError, true);
    assert.match(textOf(stale), /changed since you read it/);
    const ok = await call("add_node", { workflowId: id, type: "stage", label: "On time", baseRevision: rev });
    assert.equal((ok as any).isError, undefined, textOf(ok));

    // snapshot before a bulk change, then diff
    const before = await prisma.workflowVersion.count({ where: { workflowId: id } });
    await call("auto_layout", { workflowId: id });
    assert.equal(await prisma.workflowVersion.count({ where: { workflowId: id } }), before + 1, "a snapshot was taken before auto_layout");
    const diff = json(await call("diff_versions", { workflowId: id, a: "1" }));
    assert.ok(diff.inPlainLanguage.length > 0);

    // propose instead of overwriting
    const proposal = json(await call("propose_changes", { workflowId: id, summary: "Rename step", ops: [{ op: "updateNode", nodeId: stored.nodes && (stored.nodes as any[])[1].id, patch: { label: "Claude's idea" } }] }));
    assert.equal(proposal.status, "pending");
    assert.match(proposal.inPlainLanguage, /1 step edited/);
    const pending = json(await call("list_suggestions", { workflowId: id }));
    assert.equal(pending.items.length, 1);
    json(await call("accept_suggestion", { workflowId: id, suggestionId: proposal.suggestionId }));
    assert.equal(((await prisma.workflowProject.findUniqueOrThrow({ where: { id } })).nodes as any[])[1].data.label, "Claude's idea");

    // style
    json(await call("set_diagram_style", { workflowId: id, style: "classic" }));
    assert.equal((await prisma.workflowProject.findUniqueOrThrow({ where: { id } })).diagramStyle, "classic");
    const refused = await call("lint_layout", { workflowId: id });
    assert.equal((refused as any).isError, true);
    json(await call("set_diagram_style", { workflowId: id, style: "process_map" }));

    // sharing
    const link = json(await call("create_link", { workflowId: id, level: "view" }));
    assert.match(link.url, /^https:\/\/example\.test\/w\/wfl_/);
    const person = json(await call("invite_person", { workflowId: id, displayName: "Pat", level: "commenter" }));
    assert.match(person.url, /\/w\/wfm_/);
    const access = json(await call("list_access", { workflowId: id }));
    assert.equal(access.links.length, 1);
    assert.equal(access.members.length, 1);
    assert.ok(!JSON.stringify(access).includes(link.url.split("/w/")[1]) && !JSON.stringify(access).includes(person.url.split("/w/")[1]), "no secret address in the listing");
    await call("revoke_person", { workflowId: id, personId: person.personId });
    await call("disable_link", { workflowId: id, linkId: access.links[0].id });
    assert.equal(json(await call("list_access", { workflowId: id })).links.length, 0);
    const v = json(await call("publish_version", { workflowId: id, label: "For review" }));
    assert.ok(v.versionNumber >= 1);
    assert.deepEqual(json(await call("list_comments", { workflowId: id })).items, []);

    // everything above was recorded as Claude's work
    const audit = await prisma.workflowAuditEvent.findMany({ where: { workflowId: id, actorType: "mcp" } });
    const actions = audit.map((a) => a.action);
    for (const a of ["mcp.add_page", "mcp.add_node", "mcp.update_edge", "mcp.auto_layout", "mcp.create_link", "mcp.invite_person"]) assert.ok(actions.includes(a), a);
  } finally {
    if (id) await prisma.workflowProject.delete({ where: { id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
});
