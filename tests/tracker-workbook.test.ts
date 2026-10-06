import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { buildClientView, type ClientViewInput } from "../src/lib/tracker/client-view";
import { computeHealth } from "../src/lib/tracker/health";
import { buildSnapshot } from "../src/lib/tracker/snapshot";
import { describeActivity } from "../src/lib/tracker/activity-text";
import {
  WORKBOOK_LIST_HEADERS,
  WORKBOOK_SHEETS,
  buildWorkbook,
  clientWorkbookData,
  formatAsOf,
  type WorkbookData,
  type WorkbookItem,
} from "../src/lib/tracker/workbook-export";

/**
 * The Excel workbook: four sheets, and the client copy can never carry anything internal.
 * No database needed: the builder is pure.
 */

const TODAY = "2026-10-10";
const NOW = new Date("2026-10-06T07:42:00Z"); // 3:42 pm in Manila

// Every SECRET_* string stands for something a client must never see.
const SECRET_EMAIL = "jolo.yu@talkpush.com";
const SECRET_INTERNAL_ITEM = "SECRET_INTERNAL_ITEM";
const SECRET_BLOCKER = "SECRET_BLOCKER_REASON";
const SECRET_NOTE = "SECRET_OVERRIDE_NOTE";
const SECRET_METRIC = "SECRET_INTERNAL_METRIC";
const SECRET_JIRA = "https://talkpush.atlassian.net/browse/TP-11000";
const SECRET_DESCRIPTION = "SECRET_DESCRIPTION";

function clientInput(): ClientViewInput {
  const base = {
    description: SECRET_DESCRIPTION,
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
      healthOverrideNote: SECRET_NOTE,
    },
    items: [
      { ...base, id: "a", title: "Approve templates", status: "waiting_on_client", waitingOn: "Legal review", dueDate: "2026-10-20", blockedByItemIds: ["b"] },
      { ...base, id: "b", title: "Whitelist domain", status: "blocked", blockerReason: SECRET_BLOCKER, dueDate: "2026-10-01" },
      { ...base, id: "c", title: SECRET_INTERNAL_ITEM, status: "blocked", visibility: "internal", blockerReason: SECRET_BLOCKER, dueDate: "2026-09-01" },
      { ...base, id: "d", title: "Archived thing", status: "blocked", archived: true },
      { ...base, id: "e", title: "UAT sign-off", status: "not_started", isMilestone: true, dueDate: "2026-11-20", startDate: "2026-11-20" },
      { ...base, id: "f", title: "Undated task", status: "in_progress", startDate: null, dueDate: null },
    ],
    phases: [{ id: "p1", name: "Configuration", startDate: "2026-09-15", endDate: "2026-10-31" }],
    metrics: [
      { id: "m1", name: "Time to hire", unit: "days", direction: "lower_is_better", baselineValue: 21, targetValue: 14, currentValue: 18, currentAsOf: "2026-10-01", visibility: "client_visible", archived: false },
      { id: "m2", name: SECRET_METRIC, unit: "x", direction: "higher_is_better", baselineValue: 1, targetValue: 2, currentValue: 1, currentAsOf: null, visibility: "internal", archived: false },
    ],
    remarks: [],
    today: TODAY,
  };
}

/** The staff copy of the same project: it keeps the internal item, the blocker reason and the Jira ticket. */
function staffData(): WorkbookData {
  const input = clientInput();
  const items: WorkbookItem[] = input.items
    .filter((i) => !i.archived)
    .map((i, index) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      phaseId: i.phaseId,
      phaseName: "Configuration",
      ownerName: i.ownerName,
      ownerSide: i.ownerSide,
      startDate: i.startDate ?? null,
      dueDate: i.dueDate,
      isMilestone: i.isMilestone,
      waitingOn: i.waitingOn,
      blockedByItemIds: [...(i.blockedByItemIds ?? [])],
      sortOrder: index,
      staff: {
        type: "config",
        priority: "high",
        teamOnly: i.visibility === "internal",
        blockerReason: i.blockerReason,
        jira: [SECRET_JIRA],
      },
    }));
  const snapshotItems = items.map((i) => ({
    id: i.id,
    title: i.title,
    status: i.status,
    dueDate: i.dueDate,
    completedAt: null,
    isMilestone: i.isMilestone,
    archived: false,
    ownerName: i.ownerName,
    ownerSide: i.ownerSide,
    phaseId: i.phaseId,
    blockerReason: i.staff?.blockerReason ?? null,
    waitingOn: i.waitingOn,
    visibility: i.staff?.teamOnly ? "internal" : "client_visible",
  }));
  const health = computeHealth({ status: "active", targetDate: "2026-12-01", healthOverride: null, healthOverrideNote: null }, snapshotItems, TODAY);
  const snapshot = buildSnapshot({
    project: {
      id: "proj",
      title: "Go-live",
      accountName: "Northwind",
      status: "active",
      startDate: "2026-09-01",
      targetDate: "2026-12-01",
      originalTargetDate: null,
      goLiveDate: null,
      rescheduleCount: 0,
      owner: { name: "Demo Solutions Engineer" },
      sponsor: null,
    },
    health,
    items: snapshotItems,
    phases: [{ id: "p1", name: "Configuration" }],
    today: TODAY,
  });
  return {
    audience: "staff",
    account: "Northwind",
    project: "Go-live",
    today: TODAY,
    generatedAt: NOW,
    snapshot,
    phases: [{ id: "p1", name: "Configuration", sortOrder: 0, startDate: "2026-09-15", endDate: "2026-10-31" }],
    dates: { startDate: "2026-09-01", targetDate: "2026-12-01", goLiveDate: null },
    items,
  };
}

async function open(data: WorkbookData): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await buildWorkbook(data)) as unknown as ArrayBuffer);
  return wb;
}

function textOf(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function allText(wb: ExcelJS.Workbook): string {
  const out: string[] = [];
  wb.eachSheet((sheet) => sheet.eachRow((row) => row.eachCell((cell) => out.push(textOf(cell.value)))));
  return out.join("\n");
}

function column(sheet: ExcelJS.Worksheet, col: number, from: number): string[] {
  const out: string[] = [];
  for (let r = from; r <= sheet.rowCount; r++) out.push(textOf(sheet.getCell(r, col).value));
  return out;
}

test("both copies have the four sheets, in order", async () => {
  const client = await open(clientWorkbookData(buildClientView(clientInput()), NOW));
  const staff = await open(staffData());
  assert.deepEqual(client.worksheets.map((s) => s.name), [...WORKBOOK_SHEETS]);
  assert.deepEqual(staff.worksheets.map((s) => s.name), [...WORKBOOK_SHEETS]);
});

test("the client copy never contains anything internal", async () => {
  const wb = await open(clientWorkbookData(buildClientView(clientInput()), NOW));
  const text = allText(wb);
  for (const secret of [SECRET_EMAIL, SECRET_INTERNAL_ITEM, SECRET_BLOCKER, SECRET_NOTE, SECRET_METRIC, SECRET_JIRA, "TP-11000", "atlassian", "Archived thing", SECRET_DESCRIPTION, "Team only", "Blocker reason", "Jira"]) {
    assert.equal(text.includes(secret), false, `leaked into the client workbook: ${secret}`);
  }
  assert.equal(text.includes("@"), false, "no email address of any kind");
  // What a client may see is there.
  for (const visible of ["Approve templates", "Whitelist domain", "UAT sign-off", "Time to hire"]) {
    assert.equal(text.includes(visible), true, `missing: ${visible}`);
  }
});

test("the client List has the client columns only", async () => {
  const wb = await open(clientWorkbookData(buildClientView(clientInput()), NOW));
  const list = wb.getWorksheet("List")!;
  const headers = list.getRow(4).values as (string | undefined)[];
  assert.deepEqual(headers.slice(1), [...WORKBOOK_LIST_HEADERS.client]);
  // 4 client-visible items (a, b, e, f); the internal and the archived ones are not rows.
  assert.equal(column(list, 1, 5).filter(Boolean).length, 4);
});

test("the staff copy keeps the internal columns and items", async () => {
  const wb = await open(staffData());
  const text = allText(wb);
  assert.equal(text.includes(SECRET_INTERNAL_ITEM), true);
  assert.equal(text.includes(SECRET_BLOCKER), true);
  assert.equal(text.includes("TP-11000") || text.includes(SECRET_JIRA), true);
  const list = wb.getWorksheet("List")!;
  assert.deepEqual((list.getRow(4).values as (string | undefined)[]).slice(1), [...WORKBOOK_LIST_HEADERS.staff]);
  assert.match(textOf(wb.getWorksheet("List")!.getCell("A2").value), /Internal, not for clients/);
});

test("every sheet says when it was made, in Manila time", async () => {
  const wb = await open(clientWorkbookData(buildClientView(clientInput()), NOW));
  for (const name of WORKBOOK_SHEETS) {
    assert.match(textOf(wb.getWorksheet(name)!.getCell("A2").value), /As of 6 Oct 2026, 3:42 pm \(Manila time\)/, name);
  }
  assert.equal(formatAsOf(new Date("2026-10-06T16:30:00Z")), "7 Oct 2026, 12:30 am");
});

test("the Board has one column per status with its count", async () => {
  const wb = await open(clientWorkbookData(buildClientView(clientInput()), NOW));
  const board = wb.getWorksheet("Board")!;
  const headers = (board.getRow(4).values as (string | undefined)[]).slice(1);
  assert.deepEqual(headers, ["Not started (1)", "In progress (1)", "Waiting on client (1)", "Blocked (1)", "Done (0)"]);
  assert.match(textOf(board.getCell("D5").value), /^Whitelist domain/);
});

test("the Timeline shades the planned weeks and lists items with no dates", async () => {
  const wb = await open(clientWorkbookData(buildClientView(clientInput()), NOW));
  const tl = wb.getWorksheet("Timeline")!;
  const titles = column(tl, 1, 7);
  const row = titles.findIndex((t) => t.includes("Approve templates")) + 7;
  assert.ok(row >= 7, "the dated item has a row");
  let shaded = 0;
  for (let c = 6; c <= tl.columnCount; c++) {
    const fill = tl.getCell(row, c).fill as ExcelJS.FillPattern | undefined;
    if (fill?.pattern === "solid") shaded += 1;
  }
  assert.ok(shaded >= 1, "at least one week is shaded");
  const milestoneRow = titles.findIndex((t) => t.includes("UAT sign-off")) + 7;
  assert.equal(titles.some((t) => t.startsWith("◆ UAT sign-off")), true);
  assert.ok(milestoneRow >= 7);
  assert.equal(titles.some((t) => t.startsWith("No dates set")), true);
  assert.equal(titles.includes("Undated task"), true);
});

test("a project with no items still makes a valid workbook", async () => {
  const input = clientInput();
  input.items = [];
  input.metrics = [];
  const wb = await open(clientWorkbookData(buildClientView(input), NOW));
  assert.deepEqual(wb.worksheets.map((s) => s.name), [...WORKBOOK_SHEETS]);
  assert.equal(allText(wb).includes("SECRET"), false);
});

test("a download is described in plain words", () => {
  assert.match(describeActivity({ action: "export.downloaded", entityTitle: null, before: null, after: { audience: "client" } }), /downloaded the client Excel workbook/);
  assert.match(describeActivity({ action: "export.downloaded", entityTitle: null, before: null, after: { audience: "staff" } }), /downloaded the staff Excel workbook/);
});
