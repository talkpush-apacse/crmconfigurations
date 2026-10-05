import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { exportName, fileSlug, fitPxPerDay, paginateRows, truncateText, weekLabelStep } from "../src/lib/tracker/print-layout";
import { buildListWorkbook, listExportRows, LIST_EXPORT_HEADERS } from "../src/lib/tracker/list-export";

type Item = Parameters<typeof listExportRows>[0][number];

const item = (over: Partial<Item> & { id: string; title: string }): Item =>
  ({
    projectId: "p",
    phaseId: null,
    phaseName: null,
    description: null,
    type: "config",
    priority: "medium",
    status: "not_started",
    visibility: "client_visible",
    isMilestone: false,
    ownerPersonId: null,
    ownerName: null,
    ownerSide: null,
    startDate: null,
    dueDate: null,
    completedAt: null,
    blockerReason: null,
    waitingOn: null,
    externalDependency: null,
    links: [],
    checklistTabSlug: null,
    sortOrder: 0,
    archived: false,
    createdVia: "web",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    blockedByItemIds: [],
    remarkCount: 0,
    ...over,
  }) as Item;

test("file names are safe and predictable", () => {
  assert.equal(fileSlug("Acme Corp: CRM go-live!"), "Acme-Corp-CRM-go-live");
  assert.equal(fileSlug("Café Niño"), "Cafe-Nino");
  assert.equal(fileSlug("???"), "export");
  assert.equal(exportName({ account: "Acme", project: "CRM go-live", view: "List", date: "2026-10-06" }), "Acme-CRM-go-live-List-2026-10-06");
});

test("the timeline always fits the page width, and week labels thin out when days get narrow", () => {
  assert.equal(fitPxPerDay(100, 800), 8);
  assert.ok(fitPxPerDay(100000, 800) > 0);
  assert.equal(weekLabelStep(24), 1);
  assert.ok(weekLabelStep(2) > 1);
});

test("pagination fills pages by height and never strands a phase heading at the bottom", () => {
  const rows = [
    { kind: "phase" as const, id: "ph1" },
    { kind: "item" as const, id: "a" },
    { kind: "item" as const, id: "b" },
    { kind: "phase" as const, id: "ph2" },
    { kind: "item" as const, id: "c" },
  ];
  const heights = { phase: 10, item: 10 };
  // Room for exactly four rows on the first page: the 4th row is a phase, so it moves to page two with its item.
  const pages = paginateRows(rows, heights, 40, 40);
  assert.deepEqual(pages.map((p) => p.map((r) => r.id)), [["ph1", "a", "b"], ["ph2", "c"]]);
  // Everything fits: one page. Nothing is lost or repeated.
  assert.equal(paginateRows(rows, heights, 100, 100).length, 1);
  assert.deepEqual(paginateRows([], heights, 40, 40), []);
  // A row taller than the budget still gets a page instead of looping.
  assert.equal(paginateRows([{ kind: "item" as const, id: "x" }], { phase: 10, item: 999 }, 40, 40).length, 1);
  // The first page can be smaller than the rest.
  const many = Array.from({ length: 10 }, (_, i) => ({ kind: "item" as const, id: String(i) }));
  const split = paginateRows(many, heights, 20, 50);
  assert.deepEqual(split.map((p) => p.length), [2, 5, 3]);
  assert.equal(split.flat().length, 10);
});

test("long labels are cut with an ellipsis", () => {
  assert.equal(truncateText("short", 10), "short");
  assert.equal(truncateText("a very long item title", 10), "a very lo…");
});

test("spreadsheet rows follow the order given and say who, what and when", () => {
  const a = item({ id: "a", title: "Whitelist domain", status: "in_progress", ownerName: "Sam", ownerSide: "client", phaseName: "Integration", dueDate: "2026-10-20", links: [{ label: "TP-1", url: "https://talkpush.atlassian.net/browse/TP-11000" }] });
  const b = item({ id: "b", title: "Build sync", status: "blocked", blockerReason: "Waiting for keys", visibility: "internal", isMilestone: true, blockedByItemIds: ["a", "gone"] });
  const c = item({ id: "c", title: "Ask client", status: "waiting_on_client", waitingOn: "Sam's IT team" });
  const rows = listExportRows([b, a, c], [a, b, c]);

  assert.equal(rows.length, 3);
  assert.equal(rows[0].length, LIST_EXPORT_HEADERS.length);
  assert.deepEqual(rows.map((r) => r[0]), ["Build sync", "Whitelist domain", "Ask client"]);
  const col = (name: (typeof LIST_EXPORT_HEADERS)[number]) => LIST_EXPORT_HEADERS.indexOf(name);

  assert.equal(rows[0][col("Status")], "Blocked");
  assert.equal(rows[0][col("Blocker reason")], "Waiting for keys");
  assert.equal(rows[0][col("Team only")], "Yes");
  assert.equal(rows[0][col("Milestone")], "Yes");
  assert.equal(rows[0][col("Depends on")], "Whitelist domain"); // the unknown id is ignored
  assert.equal(rows[0][col("Owner")], "Unassigned");

  assert.equal(rows[1][col("Owner")], "Sam");
  assert.equal(rows[1][col("Side")], "Client");
  assert.equal(rows[1][col("Phase")], "Integration");
  assert.equal(rows[1][col("Jira tickets")], "https://talkpush.atlassian.net/browse/TP-11000");
  assert.equal((rows[1][col("Due")] as Date).toISOString(), "2026-10-20T00:00:00.000Z");
  assert.equal(rows[1][col("Blocker reason")], ""); // only shown while blocked

  assert.equal(rows[2][col("Waiting on")], "Sam's IT team");
});

test("a Jira link that is not a Talkpush ticket never reaches the file", () => {
  const x = item({ id: "x", title: "X", links: [{ label: "evil", url: "https://example.com/browse/TP-1" }, "nonsense"] });
  assert.equal(listExportRows([x], [x])[0][LIST_EXPORT_HEADERS.indexOf("Jira tickets")], "");
});

test("the Excel file opens, labels itself internal, and keeps real dates and a filter row", async () => {
  const a = item({ id: "a", title: "=SUM(A1)", status: "in_progress", dueDate: "2026-10-01" });
  const b = item({ id: "b", title: "Done thing", status: "done", dueDate: "2026-09-01" });
  const buffer = await buildListWorkbook({ account: "Acme", project: "Go-live", today: "2026-10-06", items: [a], allItems: [a, b], filterLabel: "Open items." });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = wb.getWorksheet("Items");
  assert.ok(sheet);
  assert.equal(sheet.getCell("A1").value, "Acme: Go-live");
  const note = String(sheet.getCell("A2").value);
  assert.match(note, /Internal, not for clients/);
  assert.match(note, /Showing 1 of 2 items/);
  assert.match(note, /Filters: Open items\.$/); // one full stop, not two
  assert.equal(sheet.getRow(4).getCell(1).value, "Item");
  // A title that looks like a formula is stored as plain text, never evaluated.
  const first = sheet.getRow(5).getCell(1).value;
  assert.equal(typeof first, "string");
  assert.equal(first, "=SUM(A1)");
  assert.ok(sheet.getRow(5).getCell(9).value instanceof Date);
  assert.equal(sheet.getRow(6).getCell(1).value, null); // only the one filtered item was written
  assert.ok(sheet.autoFilter);
});
