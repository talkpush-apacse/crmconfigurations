import test from "node:test";
import assert from "node:assert/strict";
import { buildClientView, type ClientViewInput } from "../src/lib/tracker/client-view";
import { CLIENT_LIMITS, clientItemCreateSchema, clientItemUpdateSchema, clientRemarkSchema, contributorLinkCreateSchema } from "../src/lib/tracker/contributor-validations";
import { computeHealth } from "../src/lib/tracker/health";
import { needsStaffReview } from "../src/lib/tracker/review";
import { generateShareToken, linkProblem, looksLikeShareToken } from "../src/lib/tracker/share-token";
import { summarizeProject } from "../src/lib/tracker/summary";

const TODAY = "2026-10-10";
const project = { status: "active", targetDate: "2026-12-01", healthOverride: null, healthOverrideNote: null };

// ---------------------------------------------------------------- the two kinds of link stay apart

test("a contributor token is not a viewer token, and the other way round", () => {
  const viewer = generateShareToken("viewer");
  const contributor = generateShareToken("contributor");
  assert.ok(viewer.token.startsWith("tpv_"));
  assert.ok(contributor.token.startsWith("tpc_"));
  assert.equal(looksLikeShareToken(contributor.token, "viewer"), false);
  assert.equal(looksLikeShareToken(viewer.token, "contributor"), false);
  assert.equal(looksLikeShareToken(contributor.token, "contributor"), true);
  // The default is still a viewer token, so nothing that already used it changes.
  assert.ok(generateShareToken().token.startsWith("tpv_"));
  assert.equal(looksLikeShareToken(viewer.token), true);
});

test("a link of the wrong kind, revoked or expired is not usable", () => {
  const live = { kind: "contributor", revokedAt: null, expiresAt: new Date(Date.now() + 86_400_000) };
  assert.equal(linkProblem(live, "contributor"), null);
  assert.equal(linkProblem(live, "viewer"), "wrong_kind");
  assert.equal(linkProblem({ ...live, revokedAt: new Date() }, "contributor"), "revoked");
  assert.equal(linkProblem({ ...live, expiresAt: new Date(Date.now() - 1000) }, "contributor"), "expired");
});

// ---------------------------------------------------------------- what a client may send

test("a client can add an item with the allowed fields", () => {
  const ok = clientItemCreateSchema.parse({ title: "  Get DNS records  ", description: "IT will add them", priority: "high", dueDate: "2026-10-30", waitsOn: ["a", "b"] });
  assert.equal(ok.title, "Get DNS records");
  assert.equal(ok.priority, "high");
  assert.equal(ok.dueDate, "2026-10-30");
  const minimal = clientItemCreateSchema.parse({ title: "Just a title" });
  assert.equal(minimal.priority, "medium");
  assert.deepEqual(minimal.waitsOn, []);
  assert.equal(minimal.dueDate, null);
});

test("a client can never set visibility, owner, type, phase, milestone, status or start date", () => {
  for (const extra of [
    { visibility: "internal" },
    { ownerPersonId: "someone" },
    { type: "risk" },
    { phaseId: "p1" },
    { isMilestone: true },
    { status: "done" },
    { startDate: "2026-10-12" },
    { blockerReason: "x" },
    { createdVia: "web" },
    { staffReviewedAt: "2026-10-10T00:00:00Z" },
    { templateItemKey: "scoping-kickoff" },
  ]) {
    assert.equal(clientItemCreateSchema.safeParse({ title: "x", ...extra }).success, false, `should refuse ${Object.keys(extra)[0]}`);
  }
});

test("a new item needs a title, a real date, and at most five things to wait for", () => {
  assert.equal(clientItemCreateSchema.safeParse({}).success, false);
  assert.equal(clientItemCreateSchema.safeParse({ title: "   " }).success, false);
  assert.equal(clientItemCreateSchema.safeParse({ title: "x".repeat(201) }).success, false);
  assert.equal(clientItemCreateSchema.safeParse({ title: "x", dueDate: "2026-02-31" }).success, false);
  assert.equal(clientItemCreateSchema.safeParse({ title: "x", priority: "urgent" }).success, false);
  const many = Array.from({ length: CLIENT_LIMITS.maxWaitsOn + 1 }, (_, i) => `i${i}`);
  assert.equal(clientItemCreateSchema.safeParse({ title: "x", waitsOn: many }).success, false);
});

test("a client may set only in progress, waiting on client or done", () => {
  for (const status of ["in_progress", "waiting_on_client", "done"]) {
    assert.equal(clientItemUpdateSchema.safeParse({ status }).success, true);
  }
  for (const status of ["blocked", "dropped", "not_started", "nonsense"]) {
    assert.equal(clientItemUpdateSchema.safeParse({ status }).success, false, status);
  }
  // Nothing else can ride along.
  assert.equal(clientItemUpdateSchema.safeParse({ status: "done", title: "renamed" }).success, false);
  assert.equal(clientItemUpdateSchema.safeParse({ status: "done", visibility: "internal" }).success, false);
  assert.equal(clientItemUpdateSchema.safeParse({}).success, false);
});

test("a note is plain text of a sensible length with nothing else attached", () => {
  assert.equal(clientRemarkSchema.safeParse({ body: "Sent to IT" }).success, true);
  assert.equal(clientRemarkSchema.safeParse({ body: "" }).success, false);
  assert.equal(clientRemarkSchema.safeParse({ body: "x".repeat(1001) }).success, false);
  assert.equal(clientRemarkSchema.safeParse({ body: "ok", visibility: "internal" }).success, false);
});

test("a contributor link defaults to 90 days and is for one named contact", () => {
  const link = contributorLinkCreateSchema.parse({ personId: "p1" });
  assert.equal(link.expiresInDays, 90);
  assert.equal(link.assignUnassigned, false);
  assert.equal(contributorLinkCreateSchema.safeParse({}).success, false);
  assert.equal(contributorLinkCreateSchema.safeParse({ personId: "p1", expiresInDays: 400 }).success, false);
});

// ---------------------------------------------------------------- review and project health

test("an item is waiting for review only when a client created it and staff have not reviewed it", () => {
  assert.equal(needsStaffReview({ createdVia: "client", staffReviewedAt: null }), true);
  assert.equal(needsStaffReview({ createdVia: "client", staffReviewedAt: new Date() }), false);
  assert.equal(needsStaffReview({ createdVia: "web", staffReviewedAt: null }), false);
  assert.equal(needsStaffReview({ createdVia: "mcp", staffReviewedAt: null }), false);
});

const overdue = { title: "Client's own item", status: "not_started", dueDate: "2026-10-01", isMilestone: false, archived: false };

test("an overdue item a client added does not turn the project amber until staff review it", () => {
  const before = computeHealth(project, [{ ...overdue, needsReview: true }], TODAY);
  assert.equal(before.level, "on_track");
  assert.deepEqual(before.reasons, []);
  const after = computeHealth(project, [{ ...overdue, needsReview: false }], TODAY);
  assert.equal(after.level, "at_risk");
});

test("an unreviewed client milestone cannot turn the project red", () => {
  const late = { ...overdue, isMilestone: true, dueDate: "2026-09-01" };
  assert.equal(computeHealth(project, [{ ...late, needsReview: true }], TODAY).level, "on_track");
  assert.equal(computeHealth(project, [{ ...late, needsReview: false }], TODAY).level, "off_track");
});

test("the portfolio summary uses the same rule", () => {
  const items = [{ ...overdue, needsReview: true }];
  assert.equal(summarizeProject(project, items, TODAY).health.level, "on_track");
  assert.equal(summarizeProject(project, [{ ...overdue }], TODAY).health.level, "at_risk");
});

function viewInput(needsReview: boolean): ClientViewInput {
  return {
    project: {
      id: "proj",
      title: "Go-live",
      objective: null,
      status: "active",
      startDate: "2026-09-01",
      targetDate: "2026-12-01",
      originalTargetDate: "2026-12-01",
      goLiveDate: null,
      rescheduleCount: 0,
      accountName: "Northwind",
      healthOverride: null,
      owner: null,
      sponsor: null,
    },
    items: [
      {
        id: "x",
        title: "Client's own item",
        description: null,
        status: "not_started",
        dueDate: "2026-10-01",
        completedAt: null,
        isMilestone: false,
        archived: false,
        ownerName: "Ana Reyes",
        ownerSide: "client",
        phaseId: null,
        blockerReason: null,
        waitingOn: null,
        visibility: "client_visible",
        needsReview,
      },
    ],
    phases: [],
    metrics: [],
    remarks: [],
    today: TODAY,
  };
}

test("the client's own view also ignores their unreviewed items for health", () => {
  assert.equal(buildClientView(viewInput(true)).health.level, "on_track");
  assert.equal(buildClientView(viewInput(false)).health.level, "at_risk");
});
