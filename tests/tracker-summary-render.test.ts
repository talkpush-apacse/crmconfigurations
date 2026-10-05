import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExecSummary } from "../src/components/tracker/ExecSummary";
import { buildClientView, type ClientViewInput } from "../src/lib/tracker/client-view";

const TODAY = "2026-10-06";

const item = (over: Record<string, unknown>) => ({
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
  status: "in_progress",
  startDate: null,
  blockedByItemIds: [] as string[],
  ...over,
});

function fixture(metrics: ClientViewInput["metrics"] = []): ClientViewInput {
  return {
    project: {
      id: "proj",
      title: "AI Call Pilot",
      objective: null,
      status: "active",
      startDate: "2026-09-29",
      targetDate: "2026-10-12",
      originalTargetDate: "2026-10-15",
      goLiveDate: null,
      rescheduleCount: 1,
      accountName: "TP Philippines",
      healthOverride: null,
      owner: null,
      sponsor: null,
    } as ClientViewInput["project"],
    items: [
      item({ id: "a", title: "Approve templates", status: "waiting_on_client", waitingOn: "Legal", dueDate: "2026-10-09" }),
      item({ id: "b", title: "Chatbot phase 2", status: "not_started", ownerName: null, ownerSide: null }),
      item({ id: "c", title: "Sign-off", status: "not_started", isMilestone: true, dueDate: "2026-10-09" }),
      item({ id: "d", title: "Scoping doc", status: "done", dueDate: "2026-09-30", completedAt: "2026-09-30T10:00:00Z" }),
    ] as unknown as ClientViewInput["items"],
    phases: [
      { id: "p1", name: "Configuration" },
      { id: "p2", name: "Training" },
    ],
    metrics,
    remarks: [],
    today: TODAY,
  };
}

const metric = (id: string, name: string, over: Partial<ClientViewInput["metrics"][number]> = {}): ClientViewInput["metrics"][number] => ({
  id,
  name,
  unit: "%",
  direction: "higher_is_better",
  baselineValue: null,
  targetValue: null,
  currentValue: null,
  currentAsOf: null,
  visibility: "client_visible",
  archived: false,
  ...over,
});

const render = (context: "client" | "staff", metrics?: ClientViewInput["metrics"]) =>
  renderToStaticMarkup(createElement(ExecSummary, { data: buildClientView(fixture(metrics)), context }));

test("client summary leaves out staff housekeeping and zero counts", () => {
  const html = render("client");
  for (const gone of ["Open items by owner", "Data notes", "no due date", "Unassigned", "nothing late", "items still to do"]) {
    assert.equal(html.includes(gone), false, `client summary still shows: ${gone}`);
  }
});

test("client summary says when each waiting item is needed by, and shows the next milestone", () => {
  const html = render("client");
  assert.match(html, /Needed by 9 Oct/);
  assert.match(html, /Next milestone/);
  assert.match(html, /moved from 15 Oct 2026/);
});

test("client summary lists only phases that have items, and says which are empty", () => {
  const html = render("client");
  assert.match(html, /No items yet in Training\./);
  assert.equal(html.includes(">Training<"), false);
});

test("staff summary keeps the full view", () => {
  const html = render("staff");
  for (const kept of ["Open items by owner", "Data notes", "nothing late", "items still to do"]) {
    assert.equal(html.includes(kept), true, `staff summary lost: ${kept}`);
  }
});

test("metrics with no readings collapse to one line instead of a table of 'No data'", () => {
  const metrics = [metric("1", "Leads"), metric("2", "Scheduling"), metric("3", "Pickup"), metric("4", "Completion")];
  const html = render("client", metrics);
  assert.equal(html.includes("<table"), false);
  assert.match(html, /4 success metrics are listed \(Leads, Scheduling, Pickup and 1 more\) with no readings yet\. Baselines or targets are still to be set\./);
});

test("metrics with a reading keep the table", () => {
  const html = render("client", [metric("1", "Leads", { baselineValue: 10, targetValue: 20, currentValue: 12, currentAsOf: "2026-10-01" })]);
  assert.equal(html.includes("<table"), true);
});
