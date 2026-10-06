import ExcelJS from "exceljs";
import type { ClientView } from "./client-view";
import { ITEM_STATUS_LABELS, ITEM_TYPE_LABELS, OPEN_ITEM_STATUSES, PROJECT_STATUS_LABELS, type ItemStatus, type ItemType, type ProjectStatus } from "./constants";
import { addDays, overdueDays } from "./dates";
import { formatDate } from "./format";
import { jiraKeys } from "./list-export";
import type { serializeItem } from "./serialize";
import type { ProjectSnapshot } from "./snapshot";
import { buildTimeline, type TimelineItem } from "./timeline-layout";

/**
 * One Excel workbook with the four project views: Summary, List, Board and Timeline.
 *
 * There are two audiences and ONE builder:
 *  - "staff":  everything the staff screens show (team-only items, blocker reasons, Jira tickets).
 *  - "client": only what a client link shows.
 *
 * The client copy is built ONLY from the client-safe `ClientView` (see clientWorkbookData), never from the full
 * project data. That is what keeps internal items and notes out of it: the builder never sees them.
 */

export const WORKBOOK_SHEETS = ["Summary", "List", "Board", "Timeline"] as const;

export interface WorkbookItem {
  id: string;
  title: string;
  status: string;
  phaseId: string | null;
  phaseName: string | null;
  ownerName: string | null;
  ownerSide: string | null;
  startDate: string | null;
  dueDate: string | null;
  isMilestone: boolean;
  waitingOn: string | null;
  blockedByItemIds: string[];
  sortOrder: number;
  /** Staff copy only. Never set on a client copy. */
  staff?: {
    type: string;
    priority: string;
    teamOnly: boolean;
    blockerReason: string | null;
    jira: string[];
  };
}

export interface WorkbookData {
  audience: "staff" | "client";
  account: string;
  project: string;
  /** The tracker's "today" (a calendar date). */
  today: string;
  /** When the file was made. */
  generatedAt: Date;
  snapshot: ProjectSnapshot;
  phases: { id: string; name: string; sortOrder: number; startDate: string | null; endDate: string | null }[];
  dates: { startDate: string | null; targetDate: string | null; goLiveDate: string | null };
  items: WorkbookItem[];
}

// ------------------------------------------------------------------ data in

/** The client copy. Reads only the client-safe view, so nothing internal can reach the file. */
export function clientWorkbookData(view: ClientView, generatedAt: Date = new Date()): WorkbookData {
  return {
    audience: "client",
    account: view.project.account,
    project: view.project.title,
    today: view.asOf,
    generatedAt,
    snapshot: view,
    phases: view.plan.phases.map((p) => ({ id: p.id, name: p.name, sortOrder: p.sortOrder, startDate: p.startDate, endDate: p.endDate })),
    dates: { startDate: view.project.startDate, targetDate: view.project.targetDate, goLiveDate: view.project.goLiveDate },
    items: view.plan.items.map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      phaseId: i.phaseId,
      phaseName: i.phaseName,
      ownerName: i.ownerName,
      ownerSide: i.ownerSide,
      startDate: i.startDate,
      dueDate: i.dueDate,
      isMilestone: i.isMilestone,
      waitingOn: i.waitingOn,
      blockedByItemIds: [...i.blockedByItemIds],
      sortOrder: i.sortOrder,
    })),
  };
}

type StaffItem = ReturnType<typeof serializeItem>;

export interface StaffWorkbookInput {
  today: string;
  project: { accountName: string; title: string; startDate: string | null; targetDate: string | null; goLiveDate: string | null };
  phases: { id: string; name: string; sortOrder: number; startDate: string | null; endDate: string | null }[];
  items: readonly StaffItem[];
  snapshot: ProjectSnapshot;
}

/** The staff copy: every live item, with the internal columns. */
export function staffWorkbookData(input: StaffWorkbookInput, generatedAt: Date = new Date()): WorkbookData {
  return {
    audience: "staff",
    account: input.project.accountName,
    project: input.project.title,
    today: input.today,
    generatedAt,
    snapshot: input.snapshot,
    phases: input.phases.map((p) => ({ id: p.id, name: p.name, sortOrder: p.sortOrder, startDate: p.startDate, endDate: p.endDate })),
    dates: { startDate: input.project.startDate, targetDate: input.project.targetDate, goLiveDate: input.project.goLiveDate },
    items: input.items.map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      phaseId: i.phaseId,
      phaseName: i.phaseName,
      ownerName: i.ownerName,
      ownerSide: i.ownerSide,
      startDate: i.startDate,
      dueDate: i.dueDate,
      isMilestone: i.isMilestone,
      waitingOn: i.waitingOn,
      blockedByItemIds: [...i.blockedByItemIds],
      sortOrder: i.sortOrder,
      staff: {
        type: i.type,
        priority: i.priority,
        teamOnly: i.visibility === "internal",
        blockerReason: i.blockerReason,
        jira: jiraKeys(i.links),
      },
    })),
  };
}

// ------------------------------------------------------------------ small helpers

const SIDE_LABEL: Record<string, string> = { talkpush: "Talkpush", client: "Client", vendor: "Vendor" };
const PRIORITY_LABEL: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const INK = "FF1A1A1A";
const MUTED = "FF6B6B6B";
const ROW_ALT = "FFF8F8EE";
const STATUS_FILL: Record<string, string> = {
  not_started: "FFE6E6E6",
  in_progress: "FFD6E4F7",
  waiting_on_client: "FFFBE3BD",
  blocked: "FFF3C6C2",
  done: "FFCDE8CF",
  dropped: "FFEEEEEE",
};
const STATUS_BAR: Record<string, string> = {
  not_started: "FF9E9E9E",
  in_progress: "FF4A7FC1",
  waiting_on_client: "FFE0A030",
  blocked: "FFD1483D",
  done: "FF4C9A55",
  dropped: "FFBDBDBD",
};

const statusLabel = (s: string) => ITEM_STATUS_LABELS[s as ItemStatus] ?? s;
const sideLabel = (s: string | null) => (s ? (SIDE_LABEL[s] ?? s) : "");

/** "2026-11-14" as a real Excel date (UTC midnight, so no time zone can move it by a day). */
function dateCell(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

/** "6 Oct 2026, 3:42 pm" in Manila time, whatever time zone the server runs in. */
export function formatAsOf(when: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(when);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")} ${get("dayPeriod").toLowerCase()}`;
}

function audienceNote(data: WorkbookData): string {
  const asOf = `As of ${formatAsOf(data.generatedAt)} (Manila time).`;
  return data.audience === "client"
    ? `${asOf} This file is a snapshot of what the project link shows. The link always has the latest status.`
    : `${asOf} Internal, not for clients: includes team-only items, blocker reasons and Jira tickets. The tracker always has the latest status.`;
}

function titleBlock(sheet: ExcelJS.Worksheet, data: WorkbookData, lastCol: number, note: string) {
  sheet.getCell("A1").value = `${data.account}: ${data.project}`;
  sheet.getCell("A1").font = { bold: true, size: 14 };
  sheet.getCell("A2").value = note;
  sheet.getCell("A2").font = { italic: true, color: { argb: MUTED } };
  sheet.getCell("A2").alignment = { wrapText: true, vertical: "top" };
  sheet.mergeCells(1, 1, 1, lastCol);
  sheet.mergeCells(2, 1, 2, lastCol);
  sheet.getRow(2).height = 32;
}

function headerRow(sheet: ExcelJS.Worksheet, rowNumber: number, labels: readonly string[], startCol = 1) {
  const row = sheet.getRow(rowNumber);
  labels.forEach((label, i) => {
    const cell = row.getCell(startCol + i);
    cell.value = label;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  row.height = 22;
}

function fill(cell: ExcelJS.Cell, argb: string) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function pageSetup(titleRow?: number): Partial<ExcelJS.PageSetup> {
  return { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, ...(titleRow ? { printTitlesRow: `${titleRow}:${titleRow}` } : {}) };
}

/** Rough height for wrapped text, so the sheet looks right before anyone resizes a row. */
function wrappedHeight(texts: readonly string[], widthChars: number, minimum = 18): number {
  const lines = Math.max(...texts.map((t) => t.split("\n").reduce((n, line) => n + Math.max(1, Math.ceil(line.length / Math.max(widthChars, 8))), 0)), 1);
  return Math.max(minimum, lines * 15 + 3);
}

// ------------------------------------------------------------------ Summary

function addSummarySheet(workbook: ExcelJS.Workbook, data: WorkbookData) {
  const sheet = workbook.addWorksheet("Summary", { pageSetup: pageSetup() });
  const widths = [44, 22, 16, 14, 14, 42];
  widths.forEach((w, i) => (sheet.getColumn(i + 1).width = w));
  const LAST = widths.length;
  titleBlock(sheet, data, LAST, audienceNote(data));

  const s = data.snapshot;
  let r = 4;

  const section = (title: string) => {
    r += 1;
    const cell = sheet.getCell(r, 1);
    cell.value = title;
    cell.font = { bold: true, size: 12 };
    for (let c = 1; c <= LAST; c++) sheet.getCell(r, c).border = { bottom: { style: "thin", color: { argb: "FFCCCCCC" } } };
    r += 1;
  };

  const kv = (label: string, value: string | number | Date | null) => {
    if (value === null || value === "") return;
    const a = sheet.getCell(r, 1);
    a.value = label;
    a.font = { bold: true };
    a.alignment = { vertical: "top" };
    const b = sheet.getCell(r, 2);
    b.value = value;
    if (value instanceof Date) b.numFmt = "d mmm yyyy";
    b.alignment = { horizontal: "left", vertical: "top", wrapText: true };
    sheet.mergeCells(r, 2, r, LAST);
    if (typeof value === "string") sheet.getRow(r).height = wrappedHeight([value], 100);
    r += 1;
  };

  section("Where the project stands");
  kv("Headline", s.headline);
  kv("Health", s.health.label);
  if (s.health.reasons.length > 0) kv("Why", s.health.reasons.join(" "));
  if (data.audience === "staff" && s.health.overridden && s.health.overrideNote) kv("Health note (internal)", s.health.overrideNote);
  kv("Project status", PROJECT_STATUS_LABELS[s.project.status as ProjectStatus] ?? s.project.status);
  kv("Start", dateCell(s.project.startDate));
  kv("Target", dateCell(s.project.targetDate));
  if (s.project.rescheduleCount > 0 && s.project.originalTargetDate) {
    kv("First planned for", dateCell(s.project.originalTargetDate));
    kv("Times moved", s.project.rescheduleCount);
  }
  kv("Go-live", dateCell(s.project.goLiveDate));
  kv("Owner", s.project.owner);
  kv("Sponsor", s.project.sponsor);
  if (data.audience === "staff" && s.linkedChecklist) kv("CRM configuration", `${s.linkedChecklist.complete} of ${s.linkedChecklist.total} sections complete (${s.linkedChecklist.clientName})`);

  section("Progress");
  const p = s.progress;
  kv("Done", `${p.done} of ${p.total} items (${p.percentDone}%)`);
  kv("Still open", p.open);
  kv("Overdue", p.overdue);
  kv("Blocked", p.blocked);
  kv("Waiting on client", p.waitingOnClient);
  kv("Days to target", p.daysToTarget);

  if (s.nextMilestone) {
    section("Next milestone");
    kv("Milestone", s.nextMilestone.title);
    kv("Owner", s.nextMilestone.owner);
    kv("Due", dateCell(s.nextMilestone.dueDate));
    kv("Status", s.nextMilestone.dueNote);
  }

  const table = (labels: readonly string[], rows: (string | number | Date | null)[][], dateCols: readonly number[] = [], noteSpansToEnd = false) => {
    headerRow(sheet, r, labels);
    if (noteSpansToEnd) sheet.mergeCells(r, labels.length, r, LAST);
    r += 1;
    rows.forEach((values, idx) => {
      const row = sheet.getRow(r);
      values.forEach((v, c) => {
        const cell = row.getCell(c + 1);
        cell.value = v;
        cell.alignment = { vertical: "top", wrapText: true, horizontal: "left" };
        if (idx % 2 === 1) fill(cell, ROW_ALT);
      });
      for (const col of dateCols) sheet.getCell(r, col).numFmt = "d mmm yyyy";
      if (noteSpansToEnd) sheet.mergeCells(r, labels.length, r, LAST);
      const first = String(values[0] ?? "");
      const last = String(values[values.length - 1] ?? "");
      row.height = wrappedHeight([first, last], 42);
      r += 1;
    });
  };

  if (s.phases.length > 0) {
    section("Phases");
    table(
      ["Phase", "Start", "End", "Done", "Total", "Still open"],
      s.phases.map((ph, i) => [ph.name, dateCell(data.phases[i]?.startDate ?? null), dateCell(data.phases[i]?.endDate ?? null), ph.done, ph.total, ph.open]),
      [2, 3]
    );
  }

  const attention: { title: string; list: typeof s.needsAttention.overdue; note: (b: (typeof s.needsAttention.overdue)[number]) => string }[] = [
    { title: "Overdue", list: s.needsAttention.overdue, note: (b) => b.dueNote ?? "" },
    { title: "Blocked", list: s.needsAttention.blocked, note: (b) => (data.audience === "staff" ? (b.blockerReason ?? "") : "") },
    { title: "Waiting on client", list: s.needsAttention.waitingOnClient, note: (b) => b.waitingOn ?? "" },
    { title: "Due soon", list: s.needsAttention.dueSoon, note: (b) => b.dueNote ?? "" },
  ];
  for (const group of attention) {
    if (group.list.length === 0) continue;
    section(`Needs attention: ${group.title} (${group.list.length})`);
    table(
      ["Item", "Owner", "Due", "Note"],
      group.list.map((b) => [b.title, b.owner ?? "Unassigned", dateCell(b.dueDate), group.note(b)]),
      [3],
      true
    );
  }

  section("Open items by owner");
  table(
    ["Owner side", "Open items"],
    (["talkpush", "client", "vendor", "unassigned"] as const).map((k) => [k === "unassigned" ? "Unassigned" : sideLabel(k), s.openItemsByOwnerSide[k]?.count ?? 0])
  );

  if (s.metrics.length > 0) {
    section("Success metrics");
    table(
      ["Metric", "Unit", "Baseline", "Current", "Target", "As of"],
      s.metrics.map((m) => [m.name, m.unit, m.baseline, m.current, m.target, m.asOf ? formatDate(m.asOf) : ""])
    );
  }

  if (s.dataNotes.length > 0) {
    section("Notes");
    for (const note of s.dataNotes) {
      sheet.getCell(r, 1).value = note;
      sheet.mergeCells(r, 1, r, LAST);
      r += 1;
    }
  }
}

// ------------------------------------------------------------------ List

const CLIENT_LIST_HEADERS = ["Item", "Status", "Owner", "Side", "Phase", "Start", "Due", "Milestone", "Waiting on", "Depends on"] as const;
const STAFF_LIST_HEADERS = ["Item", "Status", "Owner", "Side", "Phase", "Type", "Priority", "Start", "Due", "Milestone", "Team only", "Blocker reason", "Waiting on", "Depends on", "Jira tickets"] as const;

export const WORKBOOK_LIST_HEADERS = { client: CLIENT_LIST_HEADERS, staff: STAFF_LIST_HEADERS } as const;

type Cell = string | Date | null;

export function workbookListRows(data: WorkbookData): Cell[][] {
  const titleById = new Map(data.items.map((i) => [i.id, i.title]));
  const dependsOn = (i: WorkbookItem) => i.blockedByItemIds.map((id) => titleById.get(id) ?? "").filter(Boolean).join("; ");
  const waiting = (i: WorkbookItem) => (i.status === "waiting_on_client" ? (i.waitingOn ?? "") : "");
  return data.items.map((i) => {
    if (data.audience === "client" || !i.staff) {
      return [i.title, statusLabel(i.status), i.ownerName ?? "Unassigned", sideLabel(i.ownerSide), i.phaseName ?? "No phase", dateCell(i.startDate), dateCell(i.dueDate), i.isMilestone ? "Yes" : "No", waiting(i), dependsOn(i)];
    }
    return [
      i.title,
      statusLabel(i.status),
      i.ownerName ?? "Unassigned",
      sideLabel(i.ownerSide),
      i.phaseName ?? "No phase",
      ITEM_TYPE_LABELS[i.staff.type as ItemType] ?? i.staff.type,
      PRIORITY_LABEL[i.staff.priority] ?? i.staff.priority,
      dateCell(i.startDate),
      dateCell(i.dueDate),
      i.isMilestone ? "Yes" : "No",
      i.staff.teamOnly ? "Yes" : "No",
      i.status === "blocked" ? (i.staff.blockerReason ?? "") : "",
      waiting(i),
      dependsOn(i),
      i.staff.jira.join("\n"),
    ];
  });
}

function addListSheet(workbook: ExcelJS.Workbook, data: WorkbookData) {
  const headers = data.audience === "client" ? CLIENT_LIST_HEADERS : STAFF_LIST_HEADERS;
  const widths = data.audience === "client" ? [46, 18, 20, 11, 22, 13, 13, 10, 26, 40] : [46, 18, 20, 11, 22, 15, 10, 13, 13, 10, 10, 34, 26, 40, 34];
  const dateCols = data.audience === "client" ? [6, 7] : [8, 9];
  const dueCol = dateCols[1];
  const HEADER = 4;
  const sheet = workbook.addWorksheet("List", {
    views: [{ state: "frozen", ySplit: HEADER, xSplit: 1 }],
    pageSetup: pageSetup(HEADER),
  });
  titleBlock(sheet, data, headers.length, `${audienceNote(data)} ${data.items.length} ${data.items.length === 1 ? "item" : "items"}.`);
  headerRow(sheet, HEADER, headers);
  widths.forEach((w, i) => (sheet.getColumn(i + 1).width = w));

  workbookListRows(data).forEach((values, idx) => {
    const row = sheet.getRow(HEADER + 1 + idx);
    row.values = values;
    row.alignment = { vertical: "top", wrapText: true };
    if (idx % 2 === 1) row.eachCell({ includeEmpty: true }, (cell) => fill(cell, ROW_ALT));
    for (const col of dateCols) sheet.getCell(row.number, col).numFmt = "d mmm yyyy";
    const item = data.items[idx];
    const open = (OPEN_ITEM_STATUSES as readonly string[]).includes(item.status);
    if (open && item.dueDate && overdueDays(item.dueDate, data.today) > 0) {
      sheet.getCell(row.number, dueCol).font = { bold: true, color: { argb: "FFD1483D" } };
    }
  });
  sheet.autoFilter = { from: { row: HEADER, column: 1 }, to: { row: HEADER, column: headers.length } };
}

// ------------------------------------------------------------------ Board

const BOARD_COLUMNS: ItemStatus[] = ["not_started", "in_progress", "waiting_on_client", "blocked", "done"];

function boardCardText(item: WorkbookItem, audience: WorkbookData["audience"]): string {
  const meta = [item.ownerName ?? "Unassigned", item.dueDate ? `Due ${formatDate(item.dueDate)}` : null, item.phaseName].filter(Boolean).join(" · ");
  const lines = [`${item.isMilestone ? "◆ " : ""}${item.title}`, meta];
  if (audience === "staff" && item.staff) {
    if (item.status === "blocked" && item.staff.blockerReason) lines.push(`Blocked: ${item.staff.blockerReason}`);
    if (item.staff.teamOnly) lines.push("Team only");
  }
  if (item.status === "waiting_on_client" && item.waitingOn) lines.push(`Waiting on: ${item.waitingOn}`);
  return lines.join("\n");
}

function addBoardSheet(workbook: ExcelJS.Workbook, data: WorkbookData) {
  const HEADER = 4;
  const WIDTH = 40;
  const sheet = workbook.addWorksheet("Board", {
    views: [{ state: "frozen", ySplit: HEADER }],
    pageSetup: pageSetup(HEADER),
  });
  titleBlock(sheet, data, BOARD_COLUMNS.length, `${audienceNote(data)} The same columns as the Board tab. Dropped items are not shown.`);

  const columns = BOARD_COLUMNS.map((status) => ({ status, items: data.items.filter((i) => i.status === status).sort((a, b) => a.sortOrder - b.sortOrder) }));
  headerRow(sheet, HEADER, columns.map((c) => `${statusLabel(c.status)} (${c.items.length})`));
  BOARD_COLUMNS.forEach((_, i) => (sheet.getColumn(i + 1).width = WIDTH));

  const rowCount = Math.max(...columns.map((c) => c.items.length), 0);
  for (let n = 0; n < rowCount; n++) {
    const row = sheet.getRow(HEADER + 1 + n);
    const texts: string[] = [];
    columns.forEach((col, c) => {
      const item = col.items[n];
      if (!item) return;
      const text = boardCardText(item, data.audience);
      texts.push(text);
      const cell = row.getCell(c + 1);
      cell.value = text;
      cell.alignment = { vertical: "top", wrapText: true };
      fill(cell, STATUS_FILL[col.status] ?? "FFFFFFFF");
      cell.border = { top: { style: "thin", color: { argb: "FFFFFFFF" } }, bottom: { style: "thin", color: { argb: "FFFFFFFF" } }, left: { style: "thin", color: { argb: "FFFFFFFF" } }, right: { style: "thin", color: { argb: "FFFFFFFF" } } };
    });
    row.height = wrappedHeight(texts, WIDTH);
  }
}

// ------------------------------------------------------------------ Timeline

const FIXED_COLS = 5; // Phase / item, Owner, Start, Due, Status
const WEEK_COL_WIDTH = 4.5;

export function addTimelineSheet(workbook: ExcelJS.Workbook, data: WorkbookData) {
  const sheet = workbook.addWorksheet("Timeline", { pageSetup: pageSetup() });
  const timelineItems: TimelineItem[] = data.items.map((i) => ({
    id: i.id,
    title: i.title,
    status: i.status,
    startDate: i.startDate,
    dueDate: i.dueDate,
    isMilestone: i.isMilestone,
    blockedByItemIds: i.blockedByItemIds,
    phaseId: i.phaseId,
    ownerName: i.ownerName,
    sortOrder: i.sortOrder,
  }));
  const tl = buildTimeline({ items: timelineItems, phases: data.phases, project: data.dates, today: data.today });

  const weekCount = tl ? Math.ceil(tl.days / 7) : 0;
  const lastCol = FIXED_COLS + Math.max(weekCount, 1);
  titleBlock(sheet, data, Math.max(lastCol, FIXED_COLS + 1), `${audienceNote(data)} Each shaded cell is a week the item is planned. ◆ marks a milestone.`);
  [44, 18, 12, 12, 17].forEach((w, i) => (sheet.getColumn(i + 1).width = w));

  const MONTH_ROW = 4;
  const WEEK_ROW = 5;
  const KEY_ROW = 6;

  const unscheduled = tl ? tl.unscheduled : timelineItems.filter((i) => i.status !== "dropped");

  if (tl) {
    // Header: month band, week-start dates (turned sideways so many weeks fit), and a row for today / target / go-live.
    headerRow(sheet, WEEK_ROW, ["Phase / item", "Owner", "Start", "Due", "Status"]);
    sheet.getRow(WEEK_ROW).height = 48;
    const weekStart = (w: number) => addDays(tl.rangeStart, w * 7);
    let groupStart = 0;
    for (let w = 0; w <= weekCount; w++) {
      const monthOf = (idx: number) => weekStart(idx).slice(0, 7);
      if (w === weekCount || monthOf(w) !== monthOf(groupStart)) {
        const first = FIXED_COLS + 1 + groupStart;
        const last = FIXED_COLS + w;
        const date = weekStart(groupStart);
        const cell = sheet.getCell(MONTH_ROW, first);
        cell.value = `${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
        cell.font = { bold: true };
        cell.alignment = { horizontal: "left" };
        if (last > first) sheet.mergeCells(MONTH_ROW, first, MONTH_ROW, last);
        groupStart = w;
      }
    }
    for (let w = 0; w < weekCount; w++) {
      const col = sheet.getColumn(FIXED_COLS + 1 + w);
      col.width = WEEK_COL_WIDTH;
      const d = weekStart(w);
      const cell = sheet.getCell(WEEK_ROW, FIXED_COLS + 1 + w);
      cell.value = `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
      fill(cell, INK);
      cell.alignment = { textRotation: 90, vertical: "middle", horizontal: "center" };
    }

    const todayWeek = tl.markers.today === null ? null : Math.floor(tl.markers.today / 7);
    const keyDates = new Map<number, string[]>();
    const addKey = (day: number | null, label: string) => {
      if (day === null) return;
      const w = Math.floor(day / 7);
      keyDates.set(w, [...(keyDates.get(w) ?? []), label]);
    };
    addKey(tl.markers.today, "Today");
    addKey(tl.markers.target, "Target");
    addKey(tl.markers.goLive, "Go-live");
    sheet.getCell(KEY_ROW, 1).value = "Today, target and go-live";
    sheet.getCell(KEY_ROW, 1).font = { italic: true, color: { argb: MUTED } };
    for (const [w, labels] of keyDates) {
      const cell = sheet.getCell(KEY_ROW, FIXED_COLS + 1 + w);
      cell.value = labels.join(" / ");
      cell.font = { bold: true, size: 9, color: { argb: labels.includes("Today") ? "FFD1483D" : INK } };
      cell.alignment = { textRotation: 90, vertical: "bottom", horizontal: "center" };
    }
    if (keyDates.size > 0) sheet.getRow(KEY_ROW).height = 54;
    sheet.views = [{ state: "frozen", xSplit: FIXED_COLS, ySplit: KEY_ROW }];

    let r = KEY_ROW + 1;
    const paintWeeks = (row: number, fromDay: number, toDay: number, argb: string, milestoneAt?: number) => {
      for (let w = Math.floor(fromDay / 7); w <= Math.floor(toDay / 7); w++) {
        if (w < 0 || w >= weekCount) continue;
        fill(sheet.getCell(row, FIXED_COLS + 1 + w), argb);
      }
      if (milestoneAt !== undefined) {
        const cell = sheet.getCell(row, FIXED_COLS + 1 + Math.floor(milestoneAt / 7));
        cell.value = "◆";
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      }
    };

    for (const tr of tl.rows) {
      const row = sheet.getRow(r);
      if (tr.kind === "phase") {
        row.getCell(1).value = tr.name;
        for (let c = 1; c <= FIXED_COLS; c++) fill(row.getCell(c), "FFEDEDE4");
        row.getCell(1).font = { bold: true };
        if (tr.startDay !== null && tr.endDay !== null) paintWeeks(r, tr.startDay, tr.endDay, "FFBDBDB2");
      } else {
        const item = tr.item;
        row.getCell(1).value = `${item.isMilestone ? "◆ " : ""}${item.title}`;
        row.getCell(1).alignment = { indent: 1, wrapText: true, vertical: "top" };
        row.getCell(2).value = item.ownerName ?? "Unassigned";
        row.getCell(3).value = dateCell(item.startDate);
        row.getCell(4).value = dateCell(item.dueDate);
        row.getCell(3).numFmt = "d mmm yyyy";
        row.getCell(4).numFmt = "d mmm yyyy";
        row.getCell(5).value = statusLabel(item.status);
        paintWeeks(r, tr.startDay, tr.endDay, STATUS_BAR[item.status] ?? "FF9E9E9E", item.isMilestone ? tr.endDay : undefined);
        row.height = wrappedHeight([String(row.getCell(1).value)], 44, 16);
      }
      r += 1;
    }

    if (todayWeek !== null && todayWeek >= 0 && todayWeek < weekCount) {
      for (let rr = KEY_ROW + 1; rr < r; rr++) {
        const cell = sheet.getCell(rr, FIXED_COLS + 1 + todayWeek);
        if (!cell.fill || (cell.fill as ExcelJS.FillPattern).pattern !== "solid") fill(cell, "FFFFF1C9");
      }
    }

    if (unscheduled.length > 0) {
      r += 1;
      sheet.getCell(r, 1).value = `No dates set (${unscheduled.length})`;
      sheet.getCell(r, 1).font = { bold: true };
      r += 1;
      for (const item of unscheduled) {
        sheet.getCell(r, 1).value = item.title;
        sheet.getCell(r, 1).alignment = { indent: 1, wrapText: true, vertical: "top" };
        sheet.getCell(r, 2).value = item.ownerName ?? "Unassigned";
        sheet.getCell(r, 5).value = statusLabel(item.status);
        r += 1;
      }
    }
  } else {
    sheet.getCell(4, 1).value = "No dates are set on any item yet, so there is no timeline to draw. Items are listed below.";
    sheet.getCell(4, 1).font = { italic: true };
    sheet.mergeCells(4, 1, 4, FIXED_COLS);
    headerRow(sheet, 6, ["Item", "Owner", "Start", "Due", "Status"]);
    let r = 7;
    for (const item of unscheduled) {
      sheet.getCell(r, 1).value = item.title;
      sheet.getCell(r, 2).value = item.ownerName ?? "Unassigned";
      sheet.getCell(r, 5).value = statusLabel(item.status);
      r += 1;
    }
  }
}

// ------------------------------------------------------------------ the workbook

export async function buildWorkbook(data: WorkbookData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Talkpush Project Tracker";
  workbook.title = `${data.account}: ${data.project}`;
  workbook.created = data.generatedAt;
  addSummarySheet(workbook, data);
  addListSheet(workbook, data);
  addBoardSheet(workbook, data);
  addTimelineSheet(workbook, data);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
