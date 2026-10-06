import ExcelJS from "exceljs";
import type { serializeItem } from "./serialize";
import { ITEM_STATUS_LABELS, ITEM_TYPE_LABELS, OPEN_ITEM_STATUSES, type ItemStatus, type ItemType } from "./constants";
import { overdueDays } from "./dates";
import { parseJiraUrl } from "./jira";

/**
 * The List view as an Excel file. Staff only: it carries team-only items, blocker reasons and Jira links, exactly as
 * the List tab does. The file says so at the top so it is not mistaken for a client document.
 */

type Item = ReturnType<typeof serializeItem>;

const SIDE_LABEL: Record<string, string> = { talkpush: "Talkpush", client: "Client", vendor: "Vendor" };
const PRIORITY_LABEL: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };

export const LIST_EXPORT_HEADERS = [
  "Item",
  "Status",
  "Owner",
  "Side",
  "Phase",
  "Type",
  "Priority",
  "Start",
  "Due",
  "Milestone",
  "Team only",
  "Blocker reason",
  "Waiting on",
  "Depends on",
  "Jira tickets",
] as const;

type Cell = string | Date | null;

/** "2026-11-14" as a real Excel date (UTC midnight, so no time zone can move it by a day). */
function dateCell(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

export function jiraKeys(links: unknown): string[] {
  if (!Array.isArray(links)) return [];
  return links.flatMap((l) => {
    const url = l && typeof l === "object" ? (l as { url?: unknown }).url : null;
    if (typeof url !== "string") return [];
    const parsed = parseJiraUrl(url);
    return parsed.ok ? [parsed.link.url] : [];
  });
}

/** One spreadsheet row per item, in the order given. `all` resolves "Depends on" titles, including items filtered out of the list. */
export function listExportRows(items: readonly Item[], all: readonly Item[]): Cell[][] {
  const titleById = new Map(all.map((i) => [i.id, i.title]));
  return items.map((i) => [
    i.title,
    ITEM_STATUS_LABELS[i.status as ItemStatus] ?? i.status,
    i.ownerName ?? "Unassigned",
    i.ownerSide ? (SIDE_LABEL[i.ownerSide] ?? i.ownerSide) : "",
    i.phaseName ?? "No phase",
    ITEM_TYPE_LABELS[i.type as ItemType] ?? i.type ?? "",
    PRIORITY_LABEL[i.priority] ?? i.priority ?? "",
    dateCell(i.startDate),
    dateCell(i.dueDate),
    i.isMilestone ? "Yes" : "No",
    i.visibility === "internal" ? "Yes" : "No",
    i.status === "blocked" ? (i.blockerReason ?? "") : "",
    i.status === "waiting_on_client" ? (i.waitingOn ?? "") : "",
    i.blockedByItemIds.map((id) => titleById.get(id) ?? "").filter(Boolean).join("; "),
    jiraKeys(i.links).join("\n"),
  ]);
}

export interface ListWorkbookInput {
  account: string;
  project: string;
  today: string;
  /** Items to write, already in on-screen order. */
  items: readonly Item[];
  /** Every item in the project (used to name dependencies and to count "x of y"). */
  allItems: readonly Item[];
  /** Plain-language description of the filters on screen, for example "Open items, owner Sam". */
  filterLabel: string;
}

const COLUMN_WIDTHS = [46, 18, 20, 11, 22, 15, 10, 13, 13, 10, 10, 34, 26, 40, 34];
const HEADER_ROW = 4;

export async function buildListWorkbook(input: ListWorkbookInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Talkpush Project Tracker";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Items", {
    views: [{ state: "frozen", ySplit: HEADER_ROW, xSplit: 1 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, printTitlesRow: `${HEADER_ROW}:${HEADER_ROW}` },
  });

  const lastCol = LIST_EXPORT_HEADERS.length;
  sheet.getCell("A1").value = `${input.account}: ${input.project}`;
  sheet.getCell("A1").font = { bold: true, size: 14 };
  sheet.getCell("A2").value =
    `Internal, not for clients. Includes team-only items and blocker reasons. Exported ${input.today}. ` +
    `Showing ${input.items.length} of ${input.allItems.length} items. Filters: ${input.filterLabel.replace(/[.\s]+$/, "") || "none"}.`;
  sheet.getCell("A2").font = { italic: true, color: { argb: "FF6B6B6B" } };
  sheet.mergeCells(1, 1, 1, lastCol);
  sheet.mergeCells(2, 1, 2, lastCol);

  const header = sheet.getRow(HEADER_ROW);
  header.values = [...LIST_EXPORT_HEADERS];
  header.height = 22;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A1A1A" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  COLUMN_WIDTHS.forEach((w, i) => (sheet.getColumn(i + 1).width = w));

  const rows = listExportRows(input.items, input.allItems);
  rows.forEach((values, idx) => {
    const row = sheet.getRow(HEADER_ROW + 1 + idx);
    row.values = values;
    row.alignment = { vertical: "top", wrapText: true };
    if (idx % 2 === 1) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F8EE" } };
      });
    }
    for (const col of [8, 9]) sheet.getCell(row.number, col).numFmt = "d mmm yyyy";

    const item = input.items[idx];
    const open = (OPEN_ITEM_STATUSES as readonly string[]).includes(item.status);
    if (open && item.dueDate && overdueDays(item.dueDate, input.today) > 0) {
      sheet.getCell(row.number, 9).font = { bold: true, color: { argb: "FFD1483D" } };
    }
  });

  sheet.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW, column: lastCol } };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
