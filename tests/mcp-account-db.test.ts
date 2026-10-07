import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

/**
 * The workflow-creating Claude tools can file the new workflow under an account. Runs only against a LOCAL
 * database (skipped otherwise).
 */
const testDb = process.env.WORKFLOW_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) process.env.DATABASE_URL_DIRECT = testDb;
const skip = !isLocalDb && "set WORKFLOW_TEST_DATABASE_URL to a localhost database";

/* eslint-disable @typescript-eslint/no-explicit-any */
const stamp = Date.now().toString(36);
const json = (r: unknown) => {
  const body = (r as { content: { text: string }[] }).content.map((c) => c.text).join("");
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`The tool did not return JSON: ${body.slice(0, 900)}`); // a tool error reads as text, so show it
  }
};
const text = (r: unknown) => (r as { content: { text: string }[] }).content.map((c) => c.text).join("");

const ROWS = [
  { step: "1", actor: "Candidate", action: "Applies", actionType: "Candidate" },
  { step: "2", actor: "Talkpush", action: "Prescreening", actionType: "System" },
  { step: "3", actor: "Recruiter", action: "Hired", kind: "end", endKind: "success" },
];

test("Claude create tools (local DB): file under an account by name or id, refuse a wrong one, leave unfiled when asked to", { skip }, async () => {
  process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:1/test";
  const { prisma } = await import("../src/lib/db");
  const { createWorkflowMcpServer } = await import("../src/lib/mcp/workflows");
  const [c, s] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1" });
  await Promise.all([createWorkflowMcpServer("https://example.test").connect(s as never), client.connect(c)]);
  const call = (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args });

  const ids: string[] = [];
  const accounts: string[] = [];
  try {
    const mk = async (name: string, extra: Record<string, unknown> = {}) => {
      const a = await prisma.trackerAccount.create({ data: { name: `${name} ${stamp}`, slug: `${name.toLowerCase()}-mcp-${stamp}`, ...extra } });
      accounts.push(a.id);
      return a;
    };
    const acme = await mk("Acme");
    const twin1 = await mk("Twin");
    await prisma.trackerAccount.create({ data: { name: `Twin ${stamp}`, slug: `twin2-mcp-${stamp}` } }).then((a) => accounts.push(a.id));
    const old = await mk("Archived", { archived: true });

    // empty workflow, by name
    const empty = json(await call("create_workflow", { clientName: "Acme", workflowName: `By name ${stamp}`, account: `acme ${stamp}` }));
    ids.push(empty.workflowId);
    assert.deepEqual(empty.account, { id: acme.id, name: `Acme ${stamp}` });
    assert.equal((await prisma.workflowProject.findUniqueOrThrow({ where: { id: empty.workflowId } })).accountId, acme.id);

    // by id
    const byId = json(await call("create_workflow", { clientName: "Acme", workflowName: "By id", account: acme.id }));
    ids.push(byId.workflowId);
    assert.equal((await prisma.workflowProject.findUniqueOrThrow({ where: { id: byId.workflowId } })).accountId, acme.id);

    // no account: waits under "Needs an account" and says so
    const none = json(await call("create_workflow", { clientName: "Acme", workflowName: `Unfiled ${stamp}` }));
    ids.push(none.workflowId);
    assert.equal(none.account, null);
    assert.equal((await prisma.workflowProject.findUniqueOrThrow({ where: { id: none.workflowId } })).accountId, null);

    // from a spec
    const spec = json(
      await call("create_workflow_from_spec", {
        clientName: "Acme",
        workflowName: "From spec",
        account: acme.id,
        nodes: [{ tempId: "a", type: "source", label: "Start", actor: "source" }, { tempId: "b", type: "stage", label: "Step", actor: "manual" }],
        edges: [{ sourceTempId: "a", targetTempId: "b" }],
      })
    );
    ids.push(spec.workflowId);
    assert.deepEqual(spec.account, { id: acme.id, name: `Acme ${stamp}` });
    assert.equal((await prisma.workflowProject.findUniqueOrThrow({ where: { id: spec.workflowId } })).accountId, acme.id);

    // from an approved flow table (the usual route)
    const table = json(await call("create_workflow_from_flow_table", { clientName: "Acme", workflowName: "From table", account: `Acme ${stamp}`, rows: ROWS, approved: true }));
    ids.push(table.workflowId);
    assert.equal((await prisma.workflowProject.findUniqueOrThrow({ where: { id: table.workflowId } })).accountId, acme.id);

    // from a template, if this database has one
    const templates = json(await call("list_templates", {}));
    const template = (Array.isArray(templates) ? templates : templates.items ?? templates.templates ?? [])[0];
    if (template?.id) {
      const t = json(await call("create_from_template", { templateId: template.id, clientName: "Acme", workflowName: "From template", account: acme.id }));
      ids.push(t.workflowId);
      assert.equal((await prisma.workflowProject.findUniqueOrThrow({ where: { id: t.workflowId } })).accountId, acme.id);
    }

    // list_workflows says which account
    const listed = json(await call("list_workflows", { search: stamp, limit: 50 }));
    const row = listed.items.find((i: any) => i.id === empty.workflowId);
    assert.deepEqual(row.account, { id: acme.id, name: `Acme ${stamp}` });
    assert.equal(listed.items.find((i: any) => i.id === none.workflowId).account, null);

    // refusals: a wrong, unclear or archived account stops the tool and nothing is created
    for (const [account, pattern] of [
      [`Acme Corp ${stamp}`, /No account is called/],
      [`Twin ${stamp}`, /More than one account is called/],
      [old.id, /archived/],
    ] as const) {
      for (const [tool, args] of [
        ["create_workflow", { clientName: "X", workflowName: `Refused ${stamp}`, account }],
        ["create_workflow_from_flow_table", { clientName: "X", workflowName: `Refused ${stamp}`, account, rows: ROWS, approved: true }],
      ] as const) {
        const res = await call(tool, { ...args });
        assert.equal((res as any).isError, true, `${tool} with ${account} must refuse`);
        assert.match(text(res), pattern);
      }
    }
    assert.equal(await prisma.workflowProject.count({ where: { workflowName: `Refused ${stamp}` } }), 0, "a refused call creates nothing");
    void twin1;
  } finally {
    await prisma.workflowScopingArtifact.deleteMany({ where: { workflowId: { in: ids } } });
    await prisma.workflowProject.deleteMany({ where: { id: { in: ids } } });
    await prisma.trackerAccount.deleteMany({ where: { id: { in: accounts } } });
    await prisma.$disconnect();
  }
});
