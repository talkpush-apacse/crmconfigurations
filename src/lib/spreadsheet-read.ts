import ExcelJS from "exceljs";
import { MAX_IMPORT_ROWS, type RawGrid } from "./spreadsheet-infer";
import { parseCsvGrid } from "./csv-utils";

/**
 * Reads an uploaded CSV/XLSX into the RawGrid that `buildProposal` consumes.
 *
 * Kept separate from the route so the file-format handling — validation,
 * worksheet selection, Excel's cell and data-validation shapes — is testable
 * without a request, and separate from `spreadsheet-infer` so that module
 * stays pure.
 */

export const MAX_SPREADSHEET_BYTES = 5 * 1024 * 1024; // 5 MB

const SPREADSHEET_EXTENSIONS = [".xlsx", ".xlsm", ".csv"];

/** Rows are read past the cap so the true total can be reported. */
const READ_ROW_LIMIT = MAX_IMPORT_ROWS * 20;

/** The parts of `File` this module needs — so tests don't need a real File. */
export interface UploadLike {
  name: string;
  size: number;
  text: () => Promise<string>;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

export type ReadResult =
  | { ok: true; grid: RawGrid }
  | { ok: false; status: 400 | 422; error: string };

export async function readSpreadsheet(
  file: UploadLike | null,
  requestedSheet?: string
): Promise<ReadResult> {
  if (!file) {
    return { ok: false, status: 400, error: "No file provided" };
  }
  if (file.size > MAX_SPREADSHEET_BYTES) {
    return { ok: false, status: 400, error: "File too large. Maximum size is 5 MB." };
  }

  const lowerName = file.name.toLowerCase();
  if (!SPREADSHEET_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    return {
      ok: false,
      status: 400,
      error: "Unsupported file. Upload a .csv, .xlsx or .xlsm file.",
    };
  }

  try {
    const grid = lowerName.endsWith(".csv")
      ? readCsv(await file.text())
      : await readWorkbook(await file.arrayBuffer(), requestedSheet);
    return { ok: true, grid };
  } catch (err) {
    // A corrupt or password-protected file is a user problem, not a 500.
    const message = err instanceof Error ? err.message : "could not be read";
    return { ok: false, status: 422, error: `Could not read that file: ${message}` };
  }
}

function readCsv(text: string): RawGrid {
  const lines = parseCsvGrid(text);
  const [header = [], ...rows] = lines;
  return {
    sheetName: "CSV",
    sheetNames: ["CSV"],
    header,
    rows: rows.slice(0, MAX_IMPORT_ROWS),
    totalRows: rows.length,
  };
}

async function readWorkbook(
  buffer: ArrayBuffer,
  requestedSheet?: string
): Promise<RawGrid> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheetNames = workbook.worksheets.map((ws) => ws.name);
  if (sheetNames.length === 0) {
    throw new Error("the workbook has no worksheets");
  }

  const sheet =
    (requestedSheet ? workbook.getWorksheet(requestedSheet) : undefined) ??
    workbook.worksheets[0];

  const header: unknown[] = [];
  const rows: unknown[][] = [];
  // Column index (zero-based) → the dropdown options Excel has on that column.
  const validationOptions: Record<number, string[]> = {};

  let totalRows = 0;
  let headerSeen = false;
  let headerWidth = 0;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > READ_ROW_LIMIT) return;

    if (!headerSeen) {
      // The first non-empty row is the header.
      headerWidth = Math.max(row.cellCount, row.actualCellCount);
      for (let c = 1; c <= headerWidth; c++) {
        header.push(row.getCell(c).value);
      }
      headerSeen = true;
      return;
    }

    totalRows++;
    if (rows.length >= MAX_IMPORT_ROWS) return;

    const values: unknown[] = [];
    for (let c = 1; c <= headerWidth; c++) {
      const cell = row.getCell(c);
      values.push(cell.value);
      collectValidationOptions(cell, c - 1, validationOptions);
    }
    rows.push(values);
  });

  if (!headerSeen) {
    throw new Error("the sheet is empty");
  }

  // Excel often attaches validation to the header cell or the whole column,
  // so check the header row too.
  const headerRow = sheet.getRow(1);
  for (let c = 1; c <= headerWidth; c++) {
    collectValidationOptions(headerRow.getCell(c), c - 1, validationOptions);
  }

  return { sheetName: sheet.name, sheetNames, header, rows, totalRows, validationOptions };
}

/**
 * Pulls the choices out of a native Excel dropdown ("Data Validation → List").
 *
 * A list formula is either an inline literal — `"New,In Review,Hired"` — or a
 * reference to a range elsewhere in the workbook. Only the inline form can be
 * resolved here; a range reference is skipped so the type falls through to
 * value-based inference rather than producing bogus options.
 */
function collectValidationOptions(
  cell: ExcelJS.Cell,
  colIdx: number,
  into: Record<number, string[]>
) {
  if (into[colIdx]) return; // first one wins

  const validation = cell.dataValidation;
  if (!validation || validation.type !== "list") return;

  const formulae = validation.formulae;
  if (!Array.isArray(formulae) || formulae.length === 0) return;

  const raw = String(formulae[0] ?? "").trim();
  if (!raw) return;

  const wasQuoted = raw.startsWith('"') && raw.endsWith('"');
  const unquoted = wasQuoted ? raw.slice(1, -1) : raw;

  if (!wasQuoted && /^=|[!$:]/.test(unquoted)) return;

  const options = unquoted
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (options.length > 0) into[colIdx] = options;
}
