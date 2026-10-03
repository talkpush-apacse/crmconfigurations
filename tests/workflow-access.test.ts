import test from "node:test";
import assert from "node:assert/strict";
import {
  generateToken,
  hashPasscode,
  hashToken,
  passcodeMatches,
  tokenKindOf,
  tokenMatchesHash,
} from "../src/lib/workflow/access/tokens";
import {
  ADMIN,
  can,
  defaultsForLevel,
  levelForLink,
  linkProblem,
  memberProblem,
  type Capability,
  type Principal,
} from "../src/lib/workflow/access/permissions";
import {
  buildClientWorkflowDto,
  lintClientText,
  lintPagesForClient,
  projectPageForClient,
} from "../src/lib/workflow/access/client-view";
import { applyOps, OpError, type OpPage, type WorkflowOp } from "../src/lib/workflow/ops";

/* eslint-disable @typescript-eslint/no-explicit-any */

const principal = (over: Partial<Principal>): Principal => ({
  kind: "member",
  level: "viewer",
  editMode: "direct",
  canApprove: false,
  canComment: false,
  canAcceptSuggestions: false,
  ...over,
});

// ---------- tokens ----------

test("tokens: a generated link is long, recognisable, and only its hash matches", () => {
  const a = generateToken("link");
  const b = generateToken("member");
  assert.ok(a.token.startsWith("wfl_") && b.token.startsWith("wfm_"));
  assert.ok(a.token.length >= 40);
  assert.notEqual(a.token, generateToken("link").token);
  assert.equal(tokenKindOf(a.token), "link");
  assert.equal(tokenKindOf(b.token), "member");
  assert.equal(tokenKindOf("tpv_" + "x".repeat(50)), null, "a tracker link is not a workflow link");
  assert.equal(tokenKindOf("short"), null);
  assert.equal(tokenMatchesHash(a.token, a.hash), true);
  assert.equal(tokenMatchesHash(a.token + "x", a.hash), false);
  assert.equal(tokenMatchesHash(b.token, a.hash), false);
  assert.equal(a.hash, hashToken(a.token));
  assert.ok(!a.hint.includes(a.token.slice(10, 30)), "the hint never shows the whole link");
});

test("tokens: a passcode is salted and checked in constant time", () => {
  const stored = hashPasscode("blue-tiger-42");
  assert.ok(stored.startsWith("scrypt$"));
  assert.notEqual(stored, hashPasscode("blue-tiger-42"), "same passcode hashes differently each time (salt)");
  assert.equal(passcodeMatches("blue-tiger-42", stored), true);
  assert.equal(passcodeMatches("blue-tiger-43", stored), false);
  assert.equal(passcodeMatches("anything", "garbage"), false);
});

// ---------- permission matrix (spec 12.2), table driven ----------

const MATRIX: { cap: Capability; admin: boolean; editorDirect: boolean; editorSuggest: boolean; commenter: boolean; viewer: boolean }[] = [
  { cap: "dashboard.view",          admin: true, editorDirect: false, editorSuggest: false, commenter: false, viewer: false },
  { cap: "workflow.create",         admin: true, editorDirect: false, editorSuggest: false, commenter: false, viewer: false },
  { cap: "workflow.delete",         admin: true, editorDirect: false, editorSuggest: false, commenter: false, viewer: false },
  { cap: "canvas.view",             admin: true, editorDirect: true,  editorSuggest: true,  commenter: true,  viewer: true },
  { cap: "canvas.edit",             admin: true, editorDirect: true,  editorSuggest: false, commenter: false, viewer: false },
  { cap: "canvas.suggest",          admin: true, editorDirect: true,  editorSuggest: true,  commenter: false, viewer: false },
  { cap: "internal.edit",           admin: true, editorDirect: false, editorSuggest: false, commenter: false, viewer: false },
  { cap: "suggestion.accept",       admin: true, editorDirect: false, editorSuggest: false, commenter: false, viewer: false },
  { cap: "suggestion.withdrawOwn",  admin: true, editorDirect: true,  editorSuggest: true,  commenter: false, viewer: false },
  { cap: "ai.generate",             admin: true, editorDirect: false, editorSuggest: false, commenter: false, viewer: false },
  { cap: "brief.view",              admin: true, editorDirect: false, editorSuggest: false, commenter: false, viewer: false },
  { cap: "comment.create",          admin: true, editorDirect: true,  editorSuggest: true,  commenter: true,  viewer: false },
  { cap: "comment.resolveOwn",      admin: true, editorDirect: true,  editorSuggest: true,  commenter: true,  viewer: false },
  { cap: "approve",                 admin: true, editorDirect: true,  editorSuggest: true,  commenter: false, viewer: false },
  { cap: "versions.viewFull",       admin: true, editorDirect: false, editorSuggest: false, commenter: false, viewer: false },
  { cap: "versions.viewPublished",  admin: true, editorDirect: true,  editorSuggest: true,  commenter: false, viewer: false },
  { cap: "version.restore",         admin: true, editorDirect: false, editorSuggest: false, commenter: false, viewer: false },
  { cap: "status.change",           admin: true, editorDirect: false, editorSuggest: false, commenter: false, viewer: false },
  { cap: "publish",                 admin: true, editorDirect: false, editorSuggest: false, commenter: false, viewer: false },
  { cap: "links.manage",            admin: true, editorDirect: false, editorSuggest: false, commenter: false, viewer: false },
  { cap: "export.internal",         admin: true, editorDirect: false, editorSuggest: false, commenter: false, viewer: false },
  { cap: "export.client",           admin: true, editorDirect: true,  editorSuggest: true,  commenter: true,  viewer: true },
  { cap: "audit.view",              admin: true, editorDirect: false, editorSuggest: false, commenter: false, viewer: false },
];

const editorDirect = principal({ level: "editor", editMode: "direct", canComment: true });
const editorSuggest = principal({ level: "editor", editMode: "suggest_only", canComment: true });
const commenter = principal({ level: "commenter", canComment: true });
const viewer = principal({ level: "viewer" });

for (const row of MATRIX) {
  test(`permissions: ${row.cap}`, () => {
    assert.equal(can(ADMIN, row.cap), row.admin, "admin");
    assert.equal(can(editorDirect, row.cap), row.editorDirect, "editor (direct)");
    assert.equal(can(editorSuggest, row.cap), row.editorSuggest, "editor (suggest-only)");
    assert.equal(can(commenter, row.cap), row.commenter, "commenter");
    assert.equal(can(viewer, row.cap), row.viewer, "viewer");
  });
}

test("permissions: the matrix covers every capability (a new one cannot slip in untested)", () => {
  assert.equal(MATRIX.length, 23);
});

test("permissions: nobody (no principal) can do anything", () => {
  for (const row of MATRIX) {
    assert.equal(can(null, row.cap), false);
    assert.equal(can(undefined, row.cap), false);
  }
});

test("permissions: the switches that staff can turn on", () => {
  assert.equal(can(principal({ level: "viewer", canApprove: true }), "approve"), true, "viewer + can approve");
  assert.equal(can(principal({ level: "commenter", canApprove: true, canComment: true }), "approve"), true);
  assert.equal(can(principal({ level: "viewer", canComment: true }), "comment.create"), true, "viewer + comments switched on");
  assert.equal(can(principal({ level: "commenter", canComment: false }), "comment.create"), false, "commenter with comments switched off");
  assert.equal(can(principal({ level: "editor", editMode: "direct", canAcceptSuggestions: true }), "suggestion.accept"), true);
  assert.equal(can(principal({ level: "editor", editMode: "suggest_only", canAcceptSuggestions: true }), "suggestion.accept"), false, "a suggest-only editor never accepts");
  assert.equal(can(principal({ level: "viewer", canApprove: true }), "canvas.edit"), false, "approve does not grant editing");
});

test("permissions: defaults for a new invite (viewers look only; nobody gets extras by default)", () => {
  assert.deepEqual(defaultsForLevel("viewer"), { canComment: false, canApprove: false, canAcceptSuggestions: false, editMode: "direct" });
  assert.equal(defaultsForLevel("commenter").canComment, true);
  assert.equal(levelForLink("view"), "viewer");
  assert.equal(levelForLink("comment"), "commenter");
  assert.equal(levelForLink("edit"), "editor");
  assert.equal(levelForLink("admin"), null, "there is no link that grants admin");
});

// ---------- is a link usable right now ----------

const NOW = new Date("2026-10-04T12:00:00Z");
const openLink = { level: "view", disabledAt: null, expiresAt: null, passcodeHash: null };

test("links: a normal link on a link-shared workflow works", () => {
  assert.equal(linkProblem(openLink, { generalAccess: "anyone_with_link" }, null, NOW), null);
});

test("links: restricted workflows ignore shared links, disabled and expired ones stop working", () => {
  assert.equal(linkProblem(openLink, { generalAccess: "restricted" }, null, NOW), "restricted");
  assert.equal(linkProblem({ ...openLink, disabledAt: new Date("2026-10-01") }, { generalAccess: "anyone_with_link" }, null, NOW), "disabled");
  assert.equal(linkProblem({ ...openLink, expiresAt: new Date("2026-10-04T11:59:59Z") }, { generalAccess: "anyone_with_link" }, null, NOW), "expired");
  assert.equal(linkProblem({ ...openLink, expiresAt: new Date("2026-10-05") }, { generalAccess: "anyone_with_link" }, null, NOW), null);
  assert.equal(linkProblem({ ...openLink, level: "admin" }, { generalAccess: "anyone_with_link" }, null, NOW), "unknown_level");
});

test("links: a passcode link asks first, then checks", () => {
  const protectedLink = { ...openLink, passcodeHash: "scrypt$a$b" };
  const open = { generalAccess: "anyone_with_link" };
  assert.equal(linkProblem(protectedLink, open, null, NOW), "passcode_required");
  assert.equal(linkProblem(protectedLink, open, false, NOW), "wrong_passcode");
  assert.equal(linkProblem(protectedLink, open, true, NOW), null);
});

test("invites: a named invite works even on a restricted workflow, until revoked or expired", () => {
  assert.equal(memberProblem({ level: "editor", revokedAt: null, expiresAt: null }, NOW), null);
  assert.equal(memberProblem({ level: "editor", revokedAt: new Date("2026-10-02"), expiresAt: null }, NOW), "revoked");
  assert.equal(memberProblem({ level: "viewer", revokedAt: null, expiresAt: new Date("2026-10-04T00:00:00Z") }, NOW), "expired");
  assert.equal(memberProblem({ level: "owner", revokedAt: null, expiresAt: null }, NOW), "unknown_level");
});

// ---------- client-safe output ----------

const SECRET = "INTERNAL-SECRET-MARKER";
const node = (id: string, data: Record<string, unknown> = {}) => ({
  id,
  type: "stage",
  position: { x: 0, y: 0 },
  data: { label: id, type: "stage", notes: `public note ${id}`, feasibility: "needs_review", feasibilityNote: `${SECRET}-feas`, ...data },
});
const edge = (id: string, source: string, target: string) => ({ id, source, target, data: {} });

const fixturePages = (): OpPage[] => [
  {
    id: "p1",
    name: "Page 1",
    nodes: [
      node("a", { internalNotes: `${SECRET}-notes-a` }),
      node("b"),
      node("hidden", { visibility: "internal", label: `${SECRET}-hidden-label`, internalNotes: SECRET }),
    ],
    edges: [edge("e1", "a", "b"), edge("e2", "b", "hidden"), edge("e3", "hidden", "a")],
    viewport: { x: 0, y: 0, zoom: 1 },
  },
];

test("client view: internal steps and their connectors are removed, staff-only fields are stripped", () => {
  const page = projectPageForClient(fixturePages()[0], { showFeasibility: false });
  assert.deepEqual(page.nodes.map((n) => n.id), ["a", "b"]);
  assert.deepEqual(page.edges.map((e) => e.id), ["e1"], "connectors touching an internal step go too");
  const text = JSON.stringify(page);
  assert.ok(!text.includes(SECRET), "no planted staff-only marker survives");
  assert.ok(!("internalNotes" in page.nodes[0].data));
  assert.ok(!("feasibility" in page.nodes[0].data), "feasibility is hidden by default");
  assert.equal(page.nodes[0].data.notes, "public note a", "ordinary notes stay");
});

test("client view: showing feasibility is an explicit switch", () => {
  const page = projectPageForClient(fixturePages()[0], { showFeasibility: true });
  assert.equal(page.nodes[0].data.feasibility, "needs_review");
});

test("client view: the payload is built from an allow-list, so nothing extra leaks", () => {
  const row: any = {
    id: "w1", clientName: "Acme", workflowName: "Flow", description: null, status: "shared", updatedAt: new Date("2026-10-04"),
    nodes: fixturePages()[0].nodes, edges: fixturePages()[0].edges, viewport: {}, pages: fixturePages(),
    shareToken: "SHARE-TOKEN-VALUE", shareVersionId: "v1", templateId: "t1", currentVersion: 4, revision: 9, showFeasibility: false,
    // pretend the row grew a column later:
    futureStaffColumn: "FUTURE-SECRET",
  };
  const dto = buildClientWorkflowDto(row, [
    { action: "approved", createdAt: new Date("2026-10-03"), reviewerName: "Pat Private", comment: "private comment" } as any,
    { action: "changes_requested", createdAt: new Date("2026-10-01"), reviewerName: "Sam Other" } as any,
  ], null);
  const text = JSON.stringify(dto);
  for (const forbidden of ["SHARE-TOKEN-VALUE", "FUTURE-SECRET", "Pat Private", "private comment", "Sam Other", SECRET, "shareVersionId", "templateId", "revision"]) {
    assert.ok(!text.includes(forbidden), `${forbidden} must not be sent to a client`);
  }
  assert.deepEqual(dto.feedback, [{ action: "approved", createdAt: new Date("2026-10-03") }]);
  assert.equal(dto.nodes.length, 2, "the legacy canvas fields are projected too");
});

test("sanitization lint: flags ticket numbers, internal ids and tenant addresses, and only reports", () => {
  assert.deepEqual(lintClientText("See SE-3685 for details", "x").map((h) => h.rule), ["ticket_number"]);
  assert.deepEqual(lintClientText("tenant acme.talkpush.com", "x").map((h) => h.rule), ["talkpush_subdomain"]);
  assert.deepEqual(lintClientText("id cmabc123def456ghi789jkl01", "x").map((h) => h.rule), ["internal_id"]);
  assert.deepEqual(lintClientText("Candidate moves to Rejected after 30 days", "x"), []);
  const pages = fixturePages();
  (pages[0].nodes[1] as any).data.notes = "Ticket SE-3685";
  const hits = lintPagesForClient(pages, { showFeasibility: false });
  assert.equal(hits.length, 1);
  assert.match(hits[0].where, /b \/ notes/);
  assert.equal((pages[0].nodes[1] as any).data.notes, "Ticket SE-3685", "the text itself is left alone");
});

// ---------- ops: the hidden-content rules ----------

const addNodeOp = (id: string, data: Record<string, unknown> = {}): WorkflowOp => ({
  op: "addNode", pageId: "p1", node: { id, type: "stage", position: { x: 5, y: 5 }, data: { label: id, type: "stage", notes: "", ...data } },
});

const internalIds = (pages: OpPage[]) =>
  pages.flatMap((p) => p.nodes.filter((n) => n.data?.visibility === "internal").map((n) => `${p.id}:${n.id}`)).sort();

test("ops: an editor can add, edit, move, connect and delete ordinary steps", () => {
  const out = applyOps(fixturePages(), [
    addNodeOp("c", { label: "<b>New</b> step" }),
    { op: "updateNode", pageId: "p1", nodeId: "a", patch: { label: "Renamed", notes: "n" } },
    { op: "moveNode", pageId: "p1", nodeId: "b", position: { x: 99, y: 99 } },
    { op: "addEdge", pageId: "p1", edge: { id: "e9", source: "a", target: "c", data: { label: "Go" } } },
    { op: "deleteEdge", pageId: "p1", edgeId: "e1" },
  ], editorDirect);
  const p = out[0];
  assert.equal(p.nodes.find((n) => n.id === "c")?.data.label, "New step", "HTML is stripped");
  assert.equal(p.nodes.find((n) => n.id === "a")?.data.label, "Renamed");
  assert.deepEqual(p.nodes.find((n) => n.id === "b")?.position, { x: 99, y: 99 });
  assert.ok(p.edges.some((e) => e.id === "e9"));
  assert.ok(!p.edges.some((e) => e.id === "e1"));
});

test("ops: the input pages are never modified", () => {
  const pages = fixturePages();
  const before = JSON.stringify(pages);
  applyOps(pages, [addNodeOp("z")], editorDirect);
  assert.equal(JSON.stringify(pages), before);
});

test("ops: an editor cannot touch staff-only fields", () => {
  for (const field of ["internalNotes", "visibility", "feasibility", "feasibilityNote", "customColor"]) {
    assert.throws(
      () => applyOps(fixturePages(), [{ op: "updateNode", pageId: "p1", nodeId: "a", patch: { [field]: "x" } }], editorDirect),
      (e: unknown) => e instanceof OpError && e.code === "forbidden",
      field
    );
    assert.throws(
      () => applyOps(fixturePages(), [addNodeOp("c", { [field]: "x" })], editorDirect),
      (e: unknown) => e instanceof OpError && e.code === "forbidden",
      `add with ${field}`
    );
  }
  assert.throws(
    () => applyOps(fixturePages(), [{ op: "updateEdge", pageId: "p1", edgeId: "e1", patch: { isPrimary: true } }], editorDirect),
    (e: unknown) => e instanceof OpError && e.code === "forbidden"
  );
  // staff can
  const out = applyOps(fixturePages(), [{ op: "updateNode", pageId: "p1", nodeId: "a", patch: { internalNotes: "ok" } }], ADMIN);
  assert.equal(out[0].nodes.find((n) => n.id === "a")?.data.internalNotes, "ok");
});

test("ops: a hidden step looks like it does not exist to an editor, in every kind of op", () => {
  const attempts: WorkflowOp[] = [
    { op: "updateNode", pageId: "p1", nodeId: "hidden", patch: { label: "x" } },
    { op: "moveNode", pageId: "p1", nodeId: "hidden", position: { x: 1, y: 1 } },
    { op: "deleteNode", pageId: "p1", nodeId: "hidden" },
    { op: "addEdge", pageId: "p1", edge: { id: "e10", source: "a", target: "hidden" } },
    { op: "addEdge", pageId: "p1", edge: { id: "e11", source: "hidden", target: "a" } },
    { op: "updateEdge", pageId: "p1", edgeId: "e2", patch: { label: "x" } },
    { op: "deleteEdge", pageId: "p1", edgeId: "e2" },
  ];
  for (const op of attempts) {
    assert.throws(() => applyOps(fixturePages(), [op], editorDirect), (e: unknown) => e instanceof OpError && e.code === "not_found", op.op);
  }
});

test("ops: an editor cannot delete a page that holds hidden steps, or the last page", () => {
  const two = [...fixturePages(), { id: "p2", name: "Page 2", nodes: [], edges: [] }];
  assert.throws(() => applyOps(two, [{ op: "deletePage", pageId: "p1" }], editorDirect), (e: unknown) => e instanceof OpError && e.code === "forbidden");
  assert.equal(applyOps(two, [{ op: "deletePage", pageId: "p2" }], editorDirect).length, 1);
  assert.throws(() => applyOps(fixturePages(), [{ op: "deletePage", pageId: "p1" }], ADMIN), (e: unknown) => e instanceof OpError && e.code === "invalid");
});

test("ops: limits stop a runaway client", () => {
  const many = Array.from({ length: 501 }, (_, i) => addNodeOp(`n${i}`));
  assert.throws(() => applyOps(fixturePages(), many, editorDirect), (e: unknown) => e instanceof OpError && e.code === "limit");
});

test("ops: editor save never drops hidden steps (randomised, 300 sessions)", () => {
  // Small seeded generator so a failure is reproducible.
  let seed = 20261004;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

  const base: OpPage[] = [
    ...fixturePages(),
    { id: "p2", name: "Page 2", nodes: [node("x", { visibility: "internal" }), node("y")], edges: [edge("e20", "y", "x")] },
  ];
  const expectedHidden = internalIds(base);

  for (let session = 0; session < 300; session++) {
    let pages = base;
    for (let step = 0; step < 12; step++) {
      const visible = pages.flatMap((p) => p.nodes.filter((n) => n.data?.visibility !== "internal").map((n) => ({ page: p.id, id: n.id })));
      const allIds = pages.flatMap((p) => p.nodes.map((n) => ({ page: p.id, id: n.id })));
      const kind = Math.floor(rand() * 8);
      const target = kind % 2 === 0 && visible.length ? pick(visible) : pick(allIds); // sometimes aim at hidden ones on purpose
      const op: WorkflowOp =
        kind === 0 ? addNodeOp(`gen${session}_${step}`)
        : kind === 1 ? { op: "updateNode", pageId: target.page, nodeId: target.id, patch: { label: "r" } }
        : kind === 2 ? { op: "moveNode", pageId: target.page, nodeId: target.id, position: { x: 1, y: 2 } }
        : kind === 3 ? { op: "deleteNode", pageId: target.page, nodeId: target.id }
        : kind === 4 ? { op: "deletePage", pageId: pick(pages).id }
        : kind === 5 ? { op: "renamePage", pageId: pick(pages).id, name: "n" }
        : kind === 6 ? { op: "addEdge", pageId: target.page, edge: { id: `eg${session}_${step}`, source: target.id, target: pick(allIds.filter((n) => n.page === target.page)).id } }
        : { op: "updateNode", pageId: target.page, nodeId: target.id, patch: { visibility: "internal" } };
      try {
        pages = applyOps(pages, [op], editorDirect);
      } catch (e) {
        assert.ok(e instanceof OpError, "only controlled refusals, never a crash");
      }
      assert.deepEqual(internalIds(pages), expectedHidden, `session ${session} step ${step}: ${JSON.stringify(op)}`);
    }
  }
});
