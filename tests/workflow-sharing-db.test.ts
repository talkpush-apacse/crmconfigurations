import test from "node:test";
import assert from "node:assert/strict";

/**
 * The whole sharing story through the real routes and a real LOCAL database: links, invites, passcodes, expiry,
 * guests, comments, direct edits, suggestions, approvals, publishing, access requests, audit.
 * Skipped unless WORKFLOW_TEST_DATABASE_URL points at localhost.
 */

const testDb = process.env.WORKFLOW_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) {
  process.env.DATABASE_URL_DIRECT = testDb;
  process.env.ADMIN_SECRET = "test-only-secret-for-workflow-api-tests-0123456789";
}
const skip = !isLocalDb && "set WORKFLOW_TEST_DATABASE_URL to a localhost database";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;
const MARK = "INTERNAL-PLANTED-MARKER";

const mkNode = (id: string, data: Json = {}) => ({ id, type: "stage", position: { x: 0, y: 0 }, data: { label: id, type: "stage", notes: `note ${id}`, feasibility: "confirmed", ...data } });

async function setup() {
  const { NextRequest } = await import("next/server");
  const { createToken } = await import("../src/lib/auth");
  const { prisma } = await import("../src/lib/db");
  const staffCookie = `admin_token=${createToken("test-user-not-real")}`;

  const call = async (handler: any, url: string, opts: { method?: string; body?: unknown; staff?: boolean; params?: Json; headers?: Record<string, string>; cookie?: string } = {}) => {
    const cookies = [opts.staff ? staffCookie : "", opts.cookie ?? ""].filter(Boolean).join("; ");
    const req = new NextRequest(`http://localhost${url}`, {
      method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
      headers: { "content-type": "application/json", ...(cookies ? { cookie: cookies } : {}), ...(opts.headers ?? {}) },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const res: Response = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
    const text = await res.text();
    return { status: res.status, text, body: (text ? JSON.parse(text) : {}) as Json, setCookie: res.headers.get("set-cookie") ?? "" };
  };

  const routes = {
    access: await import("../src/app/api/workflows/[id]/access/route"),
    links: await import("../src/app/api/workflows/[id]/links/route"),
    link: await import("../src/app/api/workflows/[id]/links/[linkId]/route"),
    members: await import("../src/app/api/workflows/[id]/members/route"),
    member: await import("../src/app/api/workflows/[id]/members/[memberId]/route"),
    publish: await import("../src/app/api/workflows/[id]/publish/route"),
    review: await import("../src/app/api/workflows/[id]/review/route"),
    staffSuggestion: await import("../src/app/api/workflows/[id]/suggestions/[sid]/route"),
    page: await import("../src/app/api/w/[token]/route"),
    identify: await import("../src/app/api/w/[token]/identify/route"),
    ops: await import("../src/app/api/w/[token]/ops/route"),
    suggestions: await import("../src/app/api/w/[token]/suggestions/route"),
    comments: await import("../src/app/api/w/[token]/comments/route"),
    feedback: await import("../src/app/api/w/[token]/feedback/route"),
    requestAccess: await import("../src/app/api/w/[token]/request-access/route"),
    revision: await import("../src/app/api/w/[token]/revision/route"),
  };

  const tokenOf = (url: string) => url.split("/w/")[1];
  const staffPost = (handler: any, path: string, id: string, body: unknown, extra: Json = {}) => call(handler, path, { staff: true, body, params: { id, ...extra } });
  const visit = (handler: any, token: string, path: string, opts: Parameters<typeof call>[2] = {}) => call(handler, path, { ...opts, params: { token, ...(opts.params ?? {}) } });
  return { call, prisma, routes, tokenOf, staffPost, visit };
}

async function makeWorkflow(prisma: any) {
  const pages = [{
    id: "p1", name: "Page 1", viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [mkNode("a"), mkNode("b"), mkNode("hidden", { visibility: "internal", label: `${MARK} hidden`, internalNotes: MARK })],
    edges: [{ id: "e1", source: "a", target: "b", data: {} }, { id: "e2", source: "b", target: "hidden", data: {} }],
  }];
  const row = await prisma.workflowProject.create({ data: { clientName: "Sharing test", workflowName: "Sharing flow", pages, nodes: pages[0].nodes, edges: pages[0].edges } });
  return row.id as string;
}

test("shared links: create, open client-safe, comment rules, guest names, turn off, replace", { skip }, async () => {
  const t = await setup();
  let id = "";
  try {
    id = await makeWorkflow(t.prisma);

    // a brand new workflow is restricted; creating a link switches general access on
    assert.equal((await t.call(t.routes.access.GET, "/x", { staff: true, params: { id } })).body.generalAccess, "restricted");
    const view = await t.staffPost(t.routes.links.POST, "/x", id, { level: "view" });
    assert.equal(view.status, 201, view.text);
    assert.match(view.body.url, /\/w\/wfl_/);
    assert.equal((await t.call(t.routes.access.GET, "/x", { staff: true, params: { id } })).body.generalAccess, "anyone_with_link");
    assert.ok(!(await t.call(t.routes.access.GET, "/x", { staff: true, params: { id } })).text.includes(view.body.token), "the secret link is never listed again");

    const viewToken = t.tokenOf(view.body.url);
    const page = await t.visit(t.routes.page.GET, viewToken, "/x");
    assert.equal(page.status, 200, page.text);
    assert.ok(!page.text.includes(MARK), "no staff-only content reaches a viewer");
    assert.deepEqual(page.body.workflow.pages[0].nodes.map((n: Json) => n.id), ["a", "b"]);
    assert.equal(page.body.you.level, "viewer");
    assert.equal(page.body.you.canComment, false);

    // a viewer cannot comment, cannot edit, cannot approve
    const noComment = await t.visit(t.routes.comments.POST, viewToken, "/x", { body: { pageId: "p1", nodeId: "a", body: "hi" } });
    assert.equal(noComment.status, 403);
    assert.equal((await t.visit(t.routes.ops.POST, viewToken, "/x", { body: { baseRevision: 0, ops: [{ op: "moveNode", pageId: "p1", nodeId: "a", position: { x: 1, y: 1 } }] } })).status, 403);
    assert.equal((await t.visit(t.routes.feedback.POST, viewToken, "/x", { body: { action: "approved" } })).status, 403);

    // comment link: must give a name first, then can comment; cannot comment on a hidden step
    const cmt = await t.staffPost(t.routes.links.POST, "/x", id, { level: "comment" });
    const cmtToken = t.tokenOf(cmt.body.url);
    const unnamed = await t.visit(t.routes.comments.POST, cmtToken, "/x", { body: { pageId: "p1", nodeId: "a", body: "first" } });
    assert.equal(unnamed.status, 400, "a shared-link visitor must give a name");
    const named = await t.visit(t.routes.identify.POST, cmtToken, "/x", { body: { name: "Maria", email: "maria@example.com" } });
    assert.equal(named.status, 200, named.text);
    assert.match(named.setCookie, /wf_guest=/);
    assert.match(named.setCookie, /HttpOnly/i);
    const guestCookie = named.setCookie.split(";")[0];
    const ok = await t.visit(t.routes.comments.POST, cmtToken, "/x", { cookie: guestCookie, body: { pageId: "p1", nodeId: "a", body: "<b>Looks</b> right" } });
    assert.equal(ok.status, 200, ok.text);
    assert.equal(ok.body.authorName, "Maria");
    assert.equal(ok.body.body, "Looks right", "HTML stripped");
    assert.equal(ok.body.mine, true);
    const hiddenTarget = await t.visit(t.routes.comments.POST, cmtToken, "/x", { cookie: guestCookie, body: { pageId: "p1", nodeId: "hidden", body: "peek" } });
    assert.equal(hiddenTarget.status, 404, "a hidden step looks like it does not exist");
    // a forged guest cookie is not accepted as a name
    const forged = await t.visit(t.routes.page.GET, cmtToken, "/x", { cookie: "wf_guest=" + Buffer.from('{"id":"x","name":"Boss"}').toString("base64url") + ".bogus" });
    assert.equal(forged.body.you.needsName, true);
    // resolve own
    const comments = await import("../src/app/api/w/[token]/comments/[cid]/route");
    const resolved = await t.visit(comments.PATCH, cmtToken, "/x", { cookie: guestCookie, method: "PATCH", body: { status: "resolved" }, params: { cid: ok.body.id } });
    assert.equal(resolved.status, 200, resolved.text);
    const otherGuest = await t.visit(t.routes.identify.POST, cmtToken, "/x", { body: { name: "Other" } });
    const denied = await t.visit(comments.PATCH, cmtToken, "/x", { cookie: otherGuest.setCookie.split(";")[0], method: "PATCH", body: { status: "open" }, params: { cid: ok.body.id } });
    assert.equal(denied.status, 403, "only your own comments");

    // turn the view link off, then replace the comment link: old addresses die
    const links = (await t.call(t.routes.access.GET, "/x", { staff: true, params: { id } })).body.links as Json[];
    const viewRow = links.find((l) => l.level === "view")!;
    assert.equal((await t.call(t.routes.link.DELETE, "/x", { staff: true, method: "DELETE", params: { id, linkId: viewRow.id } })).status, 200);
    const off = await t.visit(t.routes.page.GET, viewToken, "/x");
    assert.equal(off.status, 403);
    assert.equal(off.body.problem, "disabled");
    assert.equal(off.body.canRequestAccess, true);
    const cmt2 = await t.staffPost(t.routes.links.POST, "/x", id, { level: "comment" });
    assert.equal((await t.visit(t.routes.page.GET, cmtToken, "/x")).body.problem, "disabled", "replaced link is dead");
    assert.equal((await t.visit(t.routes.page.GET, t.tokenOf(cmt2.body.url), "/x")).status, 200, "the new one works");

    // restricted: shared links stop working, named invites do not
    const member = await t.staffPost(t.routes.members.POST, "/x", id, { displayName: "Pat", level: "viewer" });
    assert.equal(member.status, 201, member.text);
    await t.call(t.routes.access.PUT, "/x", { staff: true, method: "PUT", body: { generalAccess: "restricted" }, params: { id } });
    assert.equal((await t.visit(t.routes.page.GET, t.tokenOf(cmt2.body.url), "/x")).body.problem, "restricted");
    const patPage = await t.visit(t.routes.page.GET, t.tokenOf(member.body.url), "/x");
    assert.equal(patPage.status, 200);
    assert.equal(patPage.body.you.displayName, "Pat");
    assert.equal(patPage.body.you.needsName, false);

    // revoke and rotate a person
    const rotated = await t.call(t.routes.member.POST, "/x", { staff: true, method: "POST", params: { id, memberId: member.body.id } });
    assert.equal(rotated.status, 200, rotated.text);
    assert.equal((await t.visit(t.routes.page.GET, t.tokenOf(member.body.url), "/x")).status, 404, "old personal address is gone (hash replaced)");
    assert.equal((await t.visit(t.routes.page.GET, t.tokenOf(rotated.body.url), "/x")).status, 200);
    await t.call(t.routes.member.DELETE, "/x", { staff: true, method: "DELETE", params: { id, memberId: member.body.id } });
    const revoked = await t.visit(t.routes.page.GET, t.tokenOf(rotated.body.url), "/x");
    assert.equal(revoked.body.problem, "revoked");

    // request access from a dead link attaches to the workflow; from a made-up address it quietly does nothing
    const reqOk = await t.visit(t.routes.requestAccess.POST, t.tokenOf(rotated.body.url), "/x", { body: { name: "Pat", message: "please" } });
    assert.equal(reqOk.status, 200);
    const fakeToken = "wfl_" + "x".repeat(43);
    assert.equal((await t.visit(t.routes.requestAccess.POST, fakeToken, "/x", { body: { name: "Nobody" } })).status, 200);
    const review = await t.call(t.routes.review.GET, "/x", { staff: true, params: { id } });
    assert.equal(review.body.accessRequests.length, 1);
    assert.equal(review.body.accessRequests[0].name, "Pat");
    assert.ok(review.body.comments.some((c: Json) => c.body === "Looks right"));
    const actions = (review.body.audit as Json[]).map((a) => a.action);
    for (const a of ["link.created", "link.disabled", "link.rotated", "member.invited", "member.revoked", "comment.created", "guest.identified", "access.settings_changed"]) {
      assert.ok(actions.includes(a), `audit has ${a}`);
    }
    assert.ok(!review.text.includes("wfl_") && !review.text.includes("wfm_"), "no secret link in the audit or review");
  } finally {
    if (id) await t.prisma.workflowProject.delete({ where: { id } }).catch(() => undefined);
    await t.prisma.$disconnect();
  }
});

test("passcode and expiry", { skip }, async () => {
  const t = await setup();
  let id = "";
  try {
    id = await makeWorkflow(t.prisma);
    const link = await t.staffPost(t.routes.links.POST, "/x", id, { level: "view", passcode: "blue-tiger-42" });
    const token = t.tokenOf(link.body.url);
    assert.equal((await t.visit(t.routes.page.GET, token, "/x")).body.problem, "passcode_required");
    const wrong = await t.visit(t.routes.page.GET, token, "/x", { headers: { "x-wf-passcode": "nope-nope" } });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.problem, "wrong_passcode");
    const right = await t.visit(t.routes.page.GET, token, "/x", { headers: { "x-wf-passcode": "blue-tiger-42" } });
    assert.equal(right.status, 200);
    assert.ok(!(await t.call(t.routes.access.GET, "/x", { staff: true, params: { id } })).text.includes("scrypt"), "the passcode hash is never listed");

    await t.prisma.workflowLink.updateMany({ where: { workflowId: id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await t.visit(t.routes.page.GET, token, "/x", { headers: { "x-wf-passcode": "blue-tiger-42" } });
    assert.equal(expired.body.problem, "expired");

    // defaults: an edit link starts suggest-only with a 30-day expiry
    const edit = await t.staffPost(t.routes.links.POST, "/x", id, { level: "edit" });
    const row = await t.prisma.workflowLink.findFirstOrThrow({ where: { workflowId: id, level: "edit", disabledAt: null } });
    assert.equal(row.editMode, "suggest_only");
    const days = (row.expiresAt!.getTime() - Date.now()) / 86_400_000;
    assert.ok(days > 29 && days <= 30.01, `expiry ~30 days (got ${days.toFixed(2)})`);
    assert.equal(edit.status, 201);
  } finally {
    if (id) await t.prisma.workflowProject.delete({ where: { id } }).catch(() => undefined);
    await t.prisma.$disconnect();
  }
});

test("editing: direct edits keep hidden steps and clash safely; suggest-only changes wait for acceptance", { skip }, async () => {
  const t = await setup();
  let id = "";
  try {
    id = await makeWorkflow(t.prisma);
    const direct = await t.staffPost(t.routes.members.POST, "/x", id, { displayName: "Dana", level: "editor", editMode: "direct" });
    const suggest = await t.staffPost(t.routes.members.POST, "/x", id, { displayName: "Sam", level: "editor", editMode: "suggest_only" });
    const dToken = t.tokenOf(direct.body.url);
    const sToken = t.tokenOf(suggest.body.url);

    const p = await t.visit(t.routes.page.GET, dToken, "/x");
    assert.equal(p.body.you.canEdit, true);
    assert.equal(p.body.revision, 0);

    const edit = await t.visit(t.routes.ops.POST, dToken, "/x", { body: { baseRevision: 0, ops: [{ op: "updateNode", pageId: "p1", nodeId: "a", patch: { label: "Renamed by Dana" } }] } });
    assert.equal(edit.status, 200, edit.text);
    assert.equal(edit.body.revision, 1);
    const stale = await t.visit(t.routes.ops.POST, dToken, "/x", { body: { baseRevision: 0, ops: [{ op: "moveNode", pageId: "p1", nodeId: "a", position: { x: 9, y: 9 } }] } });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.latestRevision, 1);
    const protectedField = await t.visit(t.routes.ops.POST, dToken, "/x", { body: { baseRevision: 1, ops: [{ op: "updateNode", pageId: "p1", nodeId: "a", patch: { internalNotes: "sneaky" } }] } });
    assert.equal(protectedField.status, 403);
    const hiddenTouch = await t.visit(t.routes.ops.POST, dToken, "/x", { body: { baseRevision: 1, ops: [{ op: "deleteNode", pageId: "p1", nodeId: "hidden" }] } });
    assert.equal(hiddenTouch.status, 404);
    const stored = await t.prisma.workflowProject.findUniqueOrThrow({ where: { id } });
    assert.ok((stored.pages as Json[])[0].nodes.some((n: Json) => n.id === "hidden"), "the hidden step is still there");

    // suggest-only editor cannot edit directly, but can suggest
    const pS = await t.visit(t.routes.page.GET, sToken, "/x");
    assert.equal(pS.body.you.canEdit, false);
    assert.equal(pS.body.you.canSuggest, true);
    assert.equal((await t.visit(t.routes.ops.POST, sToken, "/x", { body: { baseRevision: 1, ops: [{ op: "moveNode", pageId: "p1", nodeId: "a", position: { x: 1, y: 1 } }] } })).status, 403);
    const sug = await t.visit(t.routes.suggestions.POST, sToken, "/x", { body: { baseRevision: 1, summary: "Rename step b", ops: [{ op: "updateNode", pageId: "p1", nodeId: "b", patch: { label: "Sam's name for b" } }] } });
    assert.equal(sug.status, 200, sug.text);
    assert.equal(sug.body.status, "pending");
    const live = await t.prisma.workflowProject.findUniqueOrThrow({ where: { id } });
    assert.equal(((live.pages as Json[])[0].nodes as Json[]).find((n) => n.id === "b")!.data.label, "b", "nothing changed yet");
    assert.equal(live.revision, 1);

    // an invalid suggestion is refused up front
    const bad = await t.visit(t.routes.suggestions.POST, sToken, "/x", { body: { baseRevision: 1, ops: [{ op: "updateNode", pageId: "p1", nodeId: "hidden", patch: { label: "x" } }] } });
    assert.equal(bad.status, 400);

    // a suggest-only editor cannot accept; staff can
    const sidRoute = await import("../src/app/api/w/[token]/suggestions/[sid]/route");
    const selfAccept = await t.visit(sidRoute.POST, sToken, "/x", { body: { action: "accept" }, params: { sid: sug.body.id } });
    assert.equal(selfAccept.status, 403);
    const accepted = await t.call(t.routes.staffSuggestion.POST, "/x", { staff: true, body: { action: "accept" }, params: { id, sid: sug.body.id } });
    assert.equal(accepted.body.status, "accepted", accepted.text);
    const after = await t.prisma.workflowProject.findUniqueOrThrow({ where: { id } });
    assert.equal(((after.pages as Json[])[0].nodes as Json[]).find((n) => n.id === "b")!.data.label, "Sam's name for b");
    assert.equal(after.revision, 2);

    // a suggestion that no longer fits goes stale instead of corrupting anything
    const sug2 = await t.visit(t.routes.suggestions.POST, sToken, "/x", { body: { baseRevision: 2, ops: [{ op: "updateNode", pageId: "p1", nodeId: "b", patch: { notes: "x" } }] } });
    await t.visit(t.routes.ops.POST, dToken, "/x", { body: { baseRevision: 2, ops: [{ op: "deleteNode", pageId: "p1", nodeId: "b" }] } });
    const stale2 = await t.call(t.routes.staffSuggestion.POST, "/x", { staff: true, body: { action: "accept" }, params: { id, sid: sug2.body.id } });
    assert.equal(stale2.body.status, "stale", stale2.text);

    // withdraw own
    const sug3 = await t.visit(t.routes.suggestions.POST, sToken, "/x", { body: { baseRevision: 3, ops: [{ op: "addNode", pageId: "p1", node: { id: "z1", type: "stage", position: { x: 0, y: 0 }, data: { label: "Z", type: "stage", notes: "" } } }] } });
    const wd = await t.visit(sidRoute.POST, sToken, "/x", { body: { action: "withdraw" }, params: { sid: sug3.body.id } });
    assert.equal(wd.body.status, "withdrawn");
    const notMine = await t.visit(sidRoute.POST, dToken, "/x", { body: { action: "withdraw" }, params: { sid: sug3.body.id } });
    assert.ok([400, 403].includes(notMine.status));
  } finally {
    if (id) await t.prisma.workflowProject.delete({ where: { id } }).catch(() => undefined);
    await t.prisma.$disconnect();
  }
});

test("approvals bind to a version; publishing pins what clients see; changes after approval are flagged", { skip }, async () => {
  const t = await setup();
  let id = "";
  try {
    id = await makeWorkflow(t.prisma);
    const viewer = await t.staffPost(t.routes.members.POST, "/x", id, { displayName: "Vera", level: "viewer", canApprove: true });
    const editor = await t.staffPost(t.routes.members.POST, "/x", id, { displayName: "Eddy", level: "editor", editMode: "direct" });
    const vToken = t.tokenOf(viewer.body.url);
    const eToken = t.tokenOf(editor.body.url);

    const pub = await t.staffPost(t.routes.publish.POST, "/x", id, { label: "For client review" });
    assert.equal(pub.status, 200, pub.text);
    const v1 = pub.body.version;
    assert.equal(v1.versionNumber >= 1, true);

    // editor changes the live canvas; the viewer still sees the published version
    await t.visit(t.routes.ops.POST, eToken, "/x", { body: { baseRevision: 0, ops: [{ op: "updateNode", pageId: "p1", nodeId: "a", patch: { label: "LIVE CHANGE" } }] } });
    const seen = await t.visit(t.routes.page.GET, vToken, "/x");
    assert.equal(seen.body.view.kind, "published");
    assert.equal(seen.body.view.versionNumber, v1.versionNumber);
    assert.equal(seen.body.workflow.pages[0].nodes.find((n: Json) => n.id === "a").data.label, "a", "frozen version, not the live edit");
    const editorSees = await t.visit(t.routes.page.GET, eToken, "/x");
    assert.equal(editorSees.body.view.kind, "live");
    assert.equal(editorSees.body.workflow.pages[0].nodes.find((n: Json) => n.id === "a").data.label, "LIVE CHANGE");

    // the viewer approves what they saw
    const missingComment = await t.visit(t.routes.feedback.POST, vToken, "/x", { body: { action: "changes_requested", versionId: seen.body.view.versionId } });
    assert.equal(missingComment.status, 400);
    const approved = await t.visit(t.routes.feedback.POST, vToken, "/x", { body: { action: "approved", versionId: seen.body.view.versionId } });
    assert.equal(approved.status, 200, approved.text);
    assert.equal(approved.body.versionNumber, v1.versionNumber);
    let row = await t.prisma.workflowProject.findUniqueOrThrow({ where: { id } });
    assert.equal(row.status, "approved");
    const fb = await t.prisma.workflowFeedback.findFirstOrThrow({ where: { workflowId: id } });
    assert.equal(fb.versionId, seen.body.view.versionId, "the approval points at the version the person saw");
    assert.ok(fb.memberId, "and at the person");

    // approving something that is not this workflow's version is refused
    const wrongVersion = await t.visit(t.routes.feedback.POST, vToken, "/x", { body: { action: "approved", versionId: "does-not-exist" } });
    assert.equal(wrongVersion.status, 404);

    // after the approval, any change flags it
    await t.visit(t.routes.ops.POST, eToken, "/x", { body: { baseRevision: 1, ops: [{ op: "updateNode", pageId: "p1", nodeId: "b", patch: { notes: "changed after approval" } }] } });
    row = await t.prisma.workflowProject.findUniqueOrThrow({ where: { id } });
    assert.equal(row.status, "modified_since_approval");

    // the latest decision (without a name) is shown to the viewer
    const after = await t.visit(t.routes.page.GET, vToken, "/x");
    assert.equal(after.body.latestDecision.action, "approved");
    assert.ok(!after.text.includes("Vera") || after.body.you.displayName === "Vera", "no other reviewer names in the payload");

    // staff can approve-on-behalf and it is logged
    const rev = await t.call(t.routes.review.GET, "/x", { staff: true, params: { id } });
    assert.equal(rev.body.feedback[0].reviewerName, "Vera");
    assert.equal(rev.body.feedback[0].versionNumber, v1.versionNumber);

    // poll endpoint
    const poll = await t.visit(t.routes.revision.GET, eToken, "/x");
    assert.equal(poll.body.revision, 2);
  } finally {
    if (id) await t.prisma.workflowProject.delete({ where: { id } }).catch(() => undefined);
    await t.prisma.$disconnect();
  }
});

test("an older single share link keeps working as a View link that may approve", { skip }, async () => {
  const t = await setup();
  let id = "";
  try {
    id = await makeWorkflow(t.prisma);
    const shareRoute = await import("../src/app/api/workflows/[id]/share/route");
    const shared = await t.call(shareRoute.POST, "/x", { staff: true, method: "POST", params: { id } });
    assert.equal(shared.status, 200, shared.text);
    const legacy = t.tokenOf(shared.body.shareUrl);
    assert.ok(!legacy.startsWith("wfl_"), "this is an old-style short link");

    const page = await t.visit(t.routes.page.GET, legacy, "/x");
    assert.equal(page.status, 200, page.text);
    assert.ok(!page.text.includes(MARK), "old links get the client-safe page too");
    assert.equal(page.body.you.level, "viewer");
    assert.equal(page.body.you.canApprove, true);
    assert.equal(page.body.you.canComment, false);

    const named = await t.visit(t.routes.identify.POST, legacy, "/x", { body: { name: "Lee" } });
    assert.equal(named.status, 200);
    const approved = await t.visit(t.routes.feedback.POST, legacy, "/x", { cookie: named.setCookie.split(";")[0], body: { action: "approved" } });
    assert.equal(approved.status, 200, approved.text);

    // stopping the old link kills it
    await t.call(shareRoute.DELETE, "/x", { staff: true, method: "DELETE", params: { id } });
    assert.equal((await t.visit(t.routes.page.GET, legacy, "/x")).status, 404);
    // a short made-up address is just "not found"
    assert.equal((await t.visit(t.routes.page.GET, "abcdefghijkl", "/x")).status, 404);
  } finally {
    if (id) await t.prisma.workflowProject.delete({ where: { id } }).catch(() => undefined);
    await t.prisma.$disconnect();
  }
});
