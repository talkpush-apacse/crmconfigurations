import test from "node:test";
import assert from "node:assert/strict";
import { isRole, normaliseRole, roleMayCall } from "../src/lib/roles";
import { checkRemoval, checkRoleChange, checkSuperAdminChange, isTalkpushEmail } from "../src/lib/users-rules";
import { ROLE_LABELS } from "../src/lib/roles";
import { CHECKLIST_READ_TOOLS } from "../src/lib/mcp/checklist-read-tools";
import { buildMcpServer, defineTool, type ToolModule } from "../src/lib/mcp/toolkit";
import { z } from "zod";
import { readFileSync } from "node:fs";

// A few of these tests load a whole connector, which opens the database connection when it is imported.
// They only run against a LOCAL database (TRACKER_TEST_DATABASE_URL pointing at localhost); skipped otherwise.
const testDb = process.env.TRACKER_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) {
  process.env.DATABASE_URL_DIRECT = testDb;
}
const skip = !isLocalDb && "set TRACKER_TEST_DATABASE_URL to a localhost database";

test("an editor may do anything; a read-only login may only read", () => {
  for (const m of ["GET", "POST", "PUT", "PATCH", "DELETE"]) assert.equal(roleMayCall("editor", m, "/api/anything"), true, m);
  for (const m of ["GET", "HEAD", "OPTIONS"]) assert.equal(roleMayCall("viewer", m, "/api/tracker/projects/x"), true, m);
  for (const m of ["POST", "PUT", "PATCH", "DELETE"]) assert.equal(roleMayCall("viewer", m, "/api/tracker/projects/x"), false, m);
});

test("a read-only login is refused every change, including the upload and the file routes", () => {
  for (const [m, path] of [
    ["POST", "/api/upload"],
    ["POST", "/api/tracker/projects/p1/files/upload-url"],
    ["DELETE", "/api/tracker/files/f1"],
    ["POST", "/api/workflows/w1/summary"],
    ["POST", "/api/checklists/c1/custom-tabs/infer"],
    ["DELETE", "/api/mcp-connections/t1"],
    ["PATCH", "/api/users/u1"],
  ] as const) {
    assert.equal(roleMayCall("viewer", m, path), false, `${m} ${path}`);
  }
});

test("the one POST route that only reads is allowed for a read-only login, and look-alikes are not", () => {
  assert.equal(roleMayCall("viewer", "POST", "/api/workflows/abc123/validate"), true);
  assert.equal(roleMayCall("viewer", "POST", "/api/workflows/abc123/validate/"), true);
  assert.equal(roleMayCall("viewer", "POST", "/api/workflows/abc/def/validate"), false);
  assert.equal(roleMayCall("viewer", "POST", "/api/workflows/abc123/validate-and-publish"), false);
  assert.equal(roleMayCall("viewer", "PATCH", "/api/workflows/abc123/validate"), false);
});

test("a bad or missing role value never grants more access", () => {
  assert.equal(normaliseRole("editor"), "editor");
  for (const v of ["viewer", "admin", "EDITOR", "", null, undefined, 1]) assert.equal(normaliseRole(v), "viewer", String(v));
  assert.equal(isRole("viewer"), true);
  assert.equal(isRole("admin"), false);
});

const U = (id: string, role: "editor" | "viewer") => ({ id, role });

test("managing logins: nobody changes their own role or removes themselves", () => {
  const users = [U("a", "editor"), U("b", "editor"), U("c", "viewer")];
  assert.equal(checkRoleChange(users, "a", "viewer", "a").ok, false);
  assert.equal(checkRemoval(users, "a", "a").ok, false);
  assert.equal(checkRoleChange(users, "c", "editor", "a").ok, true);
  assert.equal(checkRemoval(users, "c", "a").ok, true);
});

test("managing logins: there is always at least one editor", () => {
  const onlyOne = [U("a", "editor"), U("c", "viewer")];
  assert.equal(checkRoleChange(onlyOne, "a", "viewer", "c").ok, false);
  assert.equal(checkRemoval(onlyOne, "a", "c").ok, false);
  const two = [U("a", "editor"), U("b", "editor")];
  assert.equal(checkRoleChange(two, "b", "viewer", "a").ok, true);
  assert.equal(checkRemoval(two, "b", "a").ok, true);
  assert.equal(checkRoleChange(onlyOne, "zzz", "viewer", "a").ok, false);
});

test("only talkpush.com addresses are unmarked", () => {
  assert.equal(isTalkpushEmail("Jolo.Yu@Talkpush.com"), true);
  assert.equal(isTalkpushEmail("x@gmail.com"), false);
  assert.equal(isTalkpushEmail("x@talkpush.com.evil.com"), false);
});

test("a read-only connection is only offered tools that look at data", () => {
  const writeTool = defineTool({ name: "t_write", description: "changes", access: "write", input: {}, handler: async () => "x" });
  const readTool = defineTool({ name: "t_read", description: "reads", access: "read", input: { a: z.string().optional() }, handler: async () => "x" });
  const mod: ToolModule = { id: "t", name: "T", tools: [writeTool, readTool] };
  const names = (readOnly: boolean) =>
    Object.keys((buildMcpServer({ name: "t", version: "1" }, [mod], { actor: { label: "x", via: "mcp" }, readOnly }) as unknown as { _registeredTools: Record<string, unknown> })._registeredTools).sort();
  assert.deepEqual(names(false), ["t_read", "t_write"]);
  assert.deepEqual(names(true), ["t_read"]);
});

test("the tracker's read-only connection has no tool that changes data", { skip }, async () => {
  const { trackerModule } = await import("../src/lib/mcp/tracker");
  const server = buildMcpServer({ name: "t", version: "1" }, [trackerModule], { actor: { label: "x", via: "mcp" }, readOnly: true }) as unknown as {
    _registeredTools: Record<string, unknown>;
  };
  const offered = Object.keys(server._registeredTools).sort();
  const reads = trackerModule.tools.filter((t) => t.access === "read").map((t) => t.name).sort();
  assert.deepEqual(offered, reads);
  assert.ok(offered.length > 0);
  for (const name of offered) assert.doesNotMatch(name, /^(add|create|update|set|archive|record|delete)_/, name);
});

test("the checklist read-only list is real and contains nothing that sounds like a change", () => {
  const source = readFileSync(new URL("../src/lib/mcp-server.ts", import.meta.url), "utf8");
  const registered = new Set([...source.matchAll(/server\.tool\(\s*"([a-z_]+)"/g)].map((m) => m[1]));
  assert.ok(registered.size > 40, "found the registered checklist tools");
  for (const name of CHECKLIST_READ_TOOLS) {
    assert.ok(registered.has(name), `${name} is not a registered checklist tool (typo?)`);
    assert.doesNotMatch(name, /^(add|create|update|delete|archive|apply|clone|edit|restore|refresh|generate)_/, name);
  }
});

test("the checklist connector for a read-only login offers exactly the read tools; an editor still gets all of them", { skip }, async () => {
  const { createMcpServer } = await import("../src/lib/mcp-server");
  const names = (readOnly: boolean) =>
    Object.keys((createMcpServer({ readOnly }) as unknown as { _registeredTools: Record<string, unknown> })._registeredTools).sort();
  const all = names(false);
  const readOnly = names(true);
  assert.ok(all.length > 40);
  assert.deepEqual(readOnly, [...CHECKLIST_READ_TOOLS].sort());
  assert.ok(readOnly.length < all.length);
});

test("the combined connector for a read-only login offers no tool that changes data in any area", { skip }, async () => {
  const { createCombinedMcpServer } = await import("../src/lib/mcp/combined");
  const server = createCombinedMcpServer("https://example.test", { actor: { label: "x", via: "mcp" }, readOnly: true }) as unknown as {
    _registeredTools: Record<string, unknown>;
  };
  const offered = Object.keys(server._registeredTools);
  assert.ok(offered.length > 20);
  for (const name of offered) assert.doesNotMatch(name, /^(add|create|update|set|archive|record|delete|apply|clone|edit|restore|refresh|generate|publish|share|invite|revoke|move|duplicate|auto|design|clear|accept|reject|propose)_/, name);
});

test("a read-only connection can run the gap check but cannot save its findings", { skip }, async () => {
  const { createWorkflowModule } = await import("../src/lib/mcp/workflows");
  const mod = createWorkflowModule("https://example.test");
  const tool = mod.tools.find((t) => t.name === "run_gap_check");
  assert.ok(tool, "run_gap_check exists");
  await assert.rejects(
    () => tool.handler({ workflowId: "w1", saveAsArtifacts: true } as never, { actor: { label: "x", via: "mcp" }, readOnly: true }),
    /read-only/
  );
});

const S = (id: string, role: "editor" | "viewer", isSuperAdmin = false) => ({ id, role, isSuperAdmin });

test("people see the profile names, while the stored values stay editor and viewer", () => {
  assert.equal(ROLE_LABELS.editor, "Talkpush Admin");
  assert.equal(ROLE_LABELS.viewer, "Talkpush read-only");
});

test("super admins: only a super admin can make or remove one", () => {
  const users = [S("jolo", "editor", true), S("admin", "editor"), S("view", "viewer")];
  assert.equal(checkSuperAdminChange(users, "admin", true, "jolo").ok, true);
  assert.equal(checkSuperAdminChange(users, "admin", true, "admin").ok, false, "a Talkpush Admin cannot promote themselves");
  assert.equal(checkSuperAdminChange(users, "jolo", false, "admin").ok, false, "a Talkpush Admin cannot demote a super admin");
  assert.equal(checkSuperAdminChange(users, "zzz", true, "jolo").ok, false, "an unknown login");
  assert.equal(checkSuperAdminChange(users, "admin", true, "unknown").ok, false, "an unknown actor is not a super admin");
});

test("super admins: has to be a Talkpush Admin, and there is always at least one", () => {
  const users = [S("jolo", "editor", true), S("view", "viewer")];
  assert.equal(checkSuperAdminChange(users, "view", true, "jolo").ok, false, "read-only cannot be a super admin");
  assert.equal(checkSuperAdminChange(users, "jolo", false, "jolo").ok, false, "the last super admin cannot step down");
  const two = [S("jolo", "editor", true), S("ana", "editor", true)];
  assert.equal(checkSuperAdminChange(two, "jolo", false, "jolo").ok, true, "stepping down is fine when another remains");
  assert.equal(checkSuperAdminChange(two, "ana", true, "jolo").ok, true, "already one: nothing to do");
});

test("super admins: a Talkpush Admin cannot demote or remove one; a super admin can, but never the last", () => {
  const users = [S("jolo", "editor", true), S("ana", "editor", true), S("admin", "editor")];
  assert.equal(checkRoleChange(users, "jolo", "viewer", "admin").ok, false);
  assert.equal(checkRemoval(users, "jolo", "admin").ok, false);
  assert.equal(checkRoleChange(users, "ana", "viewer", "jolo").ok, false, "demote a super admin to read-only: remove super admin first");
  assert.equal(checkRemoval(users, "ana", "jolo").ok, true);
  assert.equal(checkRemoval([S("jolo", "editor", true), S("admin", "editor")], "jolo", "admin").ok, false);
  assert.equal(checkRemoval([S("jolo", "editor", true), S("admin", "editor")], "admin", "jolo").ok, true, "a super admin may remove an ordinary Talkpush Admin");
});

test("Talkpush Admins still add, change and remove other ordinary logins", () => {
  const users = [S("jolo", "editor", true), S("admin", "editor"), S("view", "viewer"), S("two", "editor")];
  assert.equal(checkRoleChange(users, "view", "editor", "admin").ok, true);
  assert.equal(checkRoleChange(users, "two", "viewer", "admin").ok, true);
  assert.equal(checkRemoval(users, "view", "admin").ok, true);
  assert.equal(checkRemoval(users, "two", "admin").ok, true);
});
