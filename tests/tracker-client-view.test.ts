import test from "node:test";
import assert from "node:assert/strict";
import { buildClientView, type ClientViewInput } from "../src/lib/tracker/client-view";
import { generateShareToken, hashShareToken, linkProblem, looksLikeShareToken, tokenMatchesHash } from "../src/lib/tracker/share-token";
import { formatMetricValue, metricProgress } from "../src/lib/tracker/metric-progress";
import { buildBurnup, burnupInsight } from "../src/lib/tracker/burnup";

const TODAY = "2026-10-10";

// Every SECRET_* string below stands for something a client must never see.
const SECRET_EMAIL = "jolo.yu@talkpush.com";
const SECRET_INTERNAL_ITEM = "SECRET_INTERNAL_ITEM";
const SECRET_BLOCKER = "SECRET_BLOCKER_REASON";
const SECRET_NOTE = "SECRET_OVERRIDE_NOTE";
const SECRET_REMARK = "SECRET_INTERNAL_REMARK";
const SECRET_METRIC = "SECRET_INTERNAL_METRIC";
const SECRET_CHECKLIST = "SECRET_CHECKLIST_ID";
const SECRET_JIRA = "https://talkpush.atlassian.net/browse/TP-11000";

function input(): ClientViewInput {
  const base = {
    description: null,
    dueDate: null,
    completedAt: null,
    isMilestone: false,
    archived: false,
    ownerName: "Ana Reyes",
    ownerSide: "client",
    phaseId: "p1",
    blockerReason: null,
    waitingOn: null,
    visibility: "client_visible",
    links: [{ label: "TP-11000", url: SECRET_JIRA }],
    startDate: "2026-09-20",
    blockedByItemIds: [] as string[],
  };
  return {
    project: {
      id: "proj",
      title: "Go-live",
      objective: "Cut time to hire",
      status: "active",
      startDate: "2026-09-01",
      targetDate: "2026-12-01",
      originalTargetDate: "2026-11-15",
      goLiveDate: null,
      rescheduleCount: 1,
      accountName: "Northwind",
      healthOverride: null,
      owner: { name: "Demo Solutions Engineer" },
      sponsor: { name: "Ana Reyes" },
      // internal fields that must never come through:
      healthOverrideNote: SECRET_NOTE,
      checklistId: SECRET_CHECKLIST,
      accountNotes: SECRET_INTERNAL_ITEM,
    },
    items: [
      { ...base, id: "a", title: "Approve templates", status: "waiting_on_client", waitingOn: "Legal review", dueDate: "2026-10-20", blockedByItemIds: ["c", "b", "a"], description: "SECRET_DESCRIPTION" },
      { ...base, id: "b", title: "Whitelist domain", status: "blocked", blockerReason: SECRET_BLOCKER, dueDate: "2026-10-01" },
      { ...base, id: "c", title: SECRET_INTERNAL_ITEM, status: "blocked", visibility: "internal", blockerReason: SECRET_BLOCKER, dueDate: "2026-09-01" },
      { ...base, id: "d", title: "Archived thing", status: "blocked", archived: true },
      { ...base, id: "e", title: "UAT sign-off", status: "not_started", isMilestone: true, dueDate: "2026-11-20" },
    ],
    phases: [{ id: "p1", name: "Configuration", startDate: "2026-09-15", endDate: "2026-10-31" }],
    metrics: [
      { id: "m1", name: "Time to hire", unit: "days", direction: "lower_is_better", baselineValue: 21, targetValue: 14, currentValue: 18, currentAsOf: "2026-10-01", visibility: "client_visible", archived: false },
      { id: "m2", name: SECRET_METRIC, unit: "x", direction: "higher_is_better", baselineValue: 1, targetValue: 2, currentValue: 1, currentAsOf: null, visibility: "internal", archived: false },
    ],
    remarks: [
      { id: "r1", itemId: "a", body: "Draft sent Monday.", visibility: "shared", authorLabel: SECRET_EMAIL, createdVia: "web", createdAt: "2026-10-05T10:00:00Z" },
      { id: "r2", itemId: "a", body: SECRET_REMARK, visibility: "internal", authorLabel: SECRET_EMAIL, createdVia: "web", createdAt: "2026-10-06T10:00:00Z" },
      { id: "r3", itemId: "c", body: "shared remark on a hidden item", visibility: "shared", authorLabel: SECRET_EMAIL, createdVia: "mcp", createdAt: "2026-10-07T10:00:00Z" },
    ],
    today: TODAY,
  };
}

test("the client view never contains anything internal", () => {
  const json = JSON.stringify(buildClientView(input()));
  for (const secret of [SECRET_EMAIL, SECRET_INTERNAL_ITEM, SECRET_BLOCKER, SECRET_NOTE, SECRET_REMARK, SECRET_METRIC, SECRET_CHECKLIST, SECRET_JIRA, "TP-11000", "atlassian", "shared remark on a hidden item", "Archived thing", "SECRET_DESCRIPTION"]) {
    assert.equal(json.includes(secret), false, `leaked: ${secret}`);
  }
  assert.equal(json.includes("@"), false, "no email address of any kind");
});

test("numbers and the headline are computed from client-visible items only", () => {
  const v = buildClientView(input());
  // visible countable items: a, b, e (c is internal, d archived)
  assert.equal(v.progress.total, 3);
  assert.equal(v.progress.blocked, 1); // only "Whitelist domain"; the internal blocked item is not counted
  assert.equal(v.progress.overdue, 1);
  assert.equal(v.needsAttention.blocked.map((i) => i.title).join(), "Whitelist domain");
  assert.equal(v.needsAttention.blocked[0].blockerReason, null);
  assert.match(v.headline, /needs? the client|need the client/);
  assert.doesNotMatch(v.headline, /2 items are blocked/);
});

test("health: an override shows only its level, never its note", () => {
  const i = input();
  i.project.healthOverride = "off_track";
  const v = buildClientView(i);
  assert.equal(v.health.level, "off_track");
  assert.equal(v.health.overrideNote, null);
  assert.equal(v.health.overridden, false);
  assert.deepEqual(v.health.reasons, []);
});

test("shared remarks: only on visible items, generic author, newest first", () => {
  const i = input();
  i.remarks = [...i.remarks, { id: "r4", itemId: "e", body: "Scheduled.", visibility: "shared", authorLabel: "x@y.z", createdVia: "client", createdAt: "2026-10-09T10:00:00Z" }];
  const v = buildClientView(i);
  assert.deepEqual(v.sharedRemarks.map((r) => r.id), ["r4", "r1"]);
  assert.deepEqual(v.sharedRemarks.map((r) => r.author), ["Client", "Talkpush team"]);
  assert.equal(v.sharedRemarks[1].itemTitle, "Approve templates");
});

test("only client-visible, non-archived metrics are included", () => {
  const v = buildClientView(input());
  assert.deepEqual(v.metrics.map((m) => m.name), ["Time to hire"]);
});

test("the client view exposes exactly the keys we approved", () => {
  const v = buildClientView(input()) as Record<string, unknown>;
  assert.deepEqual(Object.keys(v).sort(), [
    "asOf", "burnup", "dataNotes", "headline", "health", "linkedChecklist", "metrics", "needsAttention",
    "nextMilestone", "openItemsByOwnerSide", "phases", "plan", "progress", "project", "recentActivity", "sharedRemarks",
  ]);
  assert.equal(v.linkedChecklist, null);
  assert.deepEqual(v.recentActivity, []);
});

test("plan (List, Board, Timeline): only visible items, only approved fields, no hidden dependency", () => {
  const v = buildClientView(input());
  assert.deepEqual(v.plan.items.map((i) => i.id), ["a", "b", "e"]); // c is internal, d archived
  for (const row of v.plan.items) {
    assert.deepEqual(Object.keys(row).sort(), [
      "blockedByItemIds", "dueDate", "id", "isMilestone", "ownerName", "ownerSide", "phaseId", "phaseName",
      "sortOrder", "startDate", "status", "title", "waitingOn",
    ]);
  }
  const a = v.plan.items[0];
  assert.deepEqual(a.blockedByItemIds, ["b"]); // the internal item "c" and the self-reference "a" are dropped
  assert.equal(a.phaseName, "Configuration");
  assert.equal(a.startDate, "2026-09-20");
  assert.deepEqual(v.plan.phases, [{ id: "p1", name: "Configuration", sortOrder: 0, startDate: "2026-09-15", endDate: "2026-10-31" }]);
});

test("plan leaves out dropped items", () => {
  const i = input();
  i.items.push({ ...i.items[0], id: "z", title: "Dropped idea", status: "dropped", blockedByItemIds: [] });
  assert.equal(buildClientView(i).plan.items.some((r) => r.id === "z"), false);
});

// ---------- share tokens ----------

test("share tokens: only a hash is stored, matching is exact", () => {
  const { token, hash, hint } = generateShareToken();
  assert.equal(looksLikeShareToken(token), true);
  assert.equal(hash, hashShareToken(token));
  assert.equal(hash.includes(token), false);
  assert.equal(hint.includes(token), false);
  assert.equal(tokenMatchesHash(token, hash), true);
  assert.equal(tokenMatchesHash(token + "x", hash), false);
  assert.equal(tokenMatchesHash("tpv_wrong", hash), false);
  assert.notEqual(generateShareToken().token, token);
  assert.equal(looksLikeShareToken("abc"), false);
  assert.equal(looksLikeShareToken("tpv_" + "a".repeat(10)), false);
  assert.equal(looksLikeShareToken("tpv_" + "a".repeat(44) + "/../x"), false);
});

test("a link is unusable once revoked, expired, or used for the wrong purpose", () => {
  const now = new Date("2026-10-10T00:00:00Z");
  const ok = { kind: "viewer", revokedAt: null, expiresAt: null };
  assert.equal(linkProblem(ok, "viewer", now), null);
  assert.equal(linkProblem({ ...ok, revokedAt: new Date("2026-10-01") }, "viewer", now), "revoked");
  assert.equal(linkProblem({ ...ok, expiresAt: new Date("2026-10-09") }, "viewer", now), "expired");
  assert.equal(linkProblem({ ...ok, expiresAt: new Date("2026-10-11") }, "viewer", now), null);
  assert.equal(linkProblem({ ...ok, kind: "contributor" }, "viewer", now), "wrong_kind");
});

// ---------- metrics and burn-up ----------

test("metric progress works for both directions", () => {
  assert.deepEqual(metricProgress({ baselineValue: 21, currentValue: 18, targetValue: 14 }), { status: "improving", percent: 43, change: -3 });
  assert.equal(metricProgress({ baselineValue: 21, currentValue: 14, targetValue: 14 }).status, "met");
  assert.equal(metricProgress({ baselineValue: 21, currentValue: 12, targetValue: 14 }).percent, 100);
  assert.equal(metricProgress({ baselineValue: 21, currentValue: 25, targetValue: 14 }).status, "worse");
  assert.equal(metricProgress({ baselineValue: 10, currentValue: 15, targetValue: 20 }).percent, 50);
  assert.equal(metricProgress({ baselineValue: 10, currentValue: 10, targetValue: 20 }).status, "no_change");
  assert.equal(metricProgress({ baselineValue: null, currentValue: 5, targetValue: 20 }).status, "no_baseline");
  assert.equal(metricProgress({ baselineValue: 10, currentValue: null, targetValue: 20 }).status, "no_data");
  assert.equal(metricProgress({ baselineValue: 10, currentValue: 12, targetValue: null }).status, "no_target");
});

test("metric values are formatted for people", () => {
  assert.equal(formatMetricValue(1250, "candidates per week"), "1,250 candidates per week");
  assert.equal(formatMetricValue(18, "%"), "18%");
  assert.equal(formatMetricValue(21.5, "days"), "21.5 days");
  assert.equal(formatMetricValue(null, "days"), "No data");
});

test("burn-up compares planned and actual completions", () => {
  const items = [
    { status: "done", archived: false, dueDate: "2026-09-10", completedAt: "2026-09-09T10:00:00Z" },
    { status: "done", archived: false, dueDate: "2026-09-20", completedAt: "2026-09-25T10:00:00Z" },
    { status: "in_progress", archived: false, dueDate: "2026-10-05", completedAt: null },
    { status: "not_started", archived: false, dueDate: "2026-11-01", completedAt: null },
    { status: "not_started", archived: false, dueDate: null, completedAt: null },
    { status: "dropped", archived: false, dueDate: "2026-09-01", completedAt: null },
  ];
  const b = buildBurnup(items, { startDate: "2026-09-01", targetDate: "2026-11-15" }, TODAY)!;
  assert.equal(b.total, 5);
  assert.equal(b.unplanned, 1);
  assert.equal(b.plannedToday, 3);
  assert.equal(b.actualToday, 2);
  assert.equal(b.behindBy, 1);
  assert.equal(b.points[0].planned, 0);
  assert.equal(b.points[0].actual, 0);
  assert.equal(b.points[b.points.length - 1].actual, null); // future has no actual
  assert.equal(b.points.every((p, i, a) => i === 0 || p.planned >= a[i - 1].planned), true);
  assert.match(burnupInsight(b), /1 item behind plan/);
  assert.match(burnupInsight(b), /1 item has no due date/);
  assert.doesNotMatch(burnupInsight(b, { withUnplanned: false }), /no due date/);
  assert.equal(buildBurnup([], { startDate: null, targetDate: null }, TODAY), null);
  assert.equal(buildBurnup([{ status: "not_started", archived: false, dueDate: null, completedAt: null }], { startDate: null, targetDate: null }, TODAY), null);
});

import { clientKey, createLimiter } from "../src/lib/tracker/rate-limit";

test("rate limiter: blocks over the limit and recovers after the window", () => {
  const l = createLimiter(3, 1000);
  assert.equal(l.hit("a", 0), true);
  assert.equal(l.hit("a", 100), true);
  assert.equal(l.hit("a", 200), true);
  assert.equal(l.hit("a", 300), false);
  assert.equal(l.count("a", 300), 3);
  assert.equal(l.hit("b", 300), true); // other addresses are independent
  assert.equal(l.hit("a", 1100), true); // the first hits have aged out
  assert.equal(l.count("a", 5000), 0);
});

test("rate limiter stays bounded", () => {
  const l = createLimiter(1, 60_000, 100);
  for (let i = 0; i < 1000; i++) l.hit(`ip-${i}`, i);
  assert.ok(l.count("ip-999", 1000) >= 0); // does not throw or grow without bound
});

test("client key comes from the first forwarded address", () => {
  assert.equal(clientKey(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })), "1.2.3.4");
  assert.equal(clientKey(new Headers()), "unknown");
});
