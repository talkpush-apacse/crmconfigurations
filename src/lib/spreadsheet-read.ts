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

/** A workbook with more sheets than this has the extras reported as skipped. */
export const MAX_SHEETS = 20;

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

/** Extension and size checks shared by both readers. */
function validateUpload(
  file: UploadLike | null
): { ok: false; status: 400; error: string } | null {
  if (!file) {
    return { ok: false, status: 400, error: "No file provided" };
  }
  if (file.size > MAX_SPREADSHEET_BYTES) {
    return { ok: false, status: 400, error: "File too large. Maximum size is 5 MB." };
  }
  if (!SPREADSHEET_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))) {
    return {
      ok: false,
      status: 400,
      error: "Unsupported file. Upload a .csv, .xlsx or .xlsm file.",
    };
  }
  return null;
}

export async function readSpreadsheet(
  file: UploadLike | null,
  requestedSheet?: string
): Promise<ReadResult> {
  const guard = validateUpload(file);
  if (guard) return guard;
  const lowerName = (file as UploadLike).name.toLowerCase();

  try {
    const grid = lowerName.endsWith(".csv")
      ? readCsv(await (file as UploadLike).text())
      : await readWorkbook(await (file as UploadLike).arrayBuffer(), requestedSheet);
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

  return gridFromWorksheet(sheet, sheetNames);
}

/**
 * Reads EVERY worksheet in a workbook, one grid each.
 *
 * A client's workbook usually holds several related lists on separate tabs —
 * jobs on one, account names on another — and importing only the first quietly
 * dropped the rest. Sheets with no header row (a blank "Sheet3", say) are
 * reported as skipped rather than failing the whole upload.
 */
export async function readAllSheets(
  file: UploadLike | null
): Promise<
  | { ok: true; grids: RawGrid[]; skipped: Array<{ name: string; reason: string }> }
  | { ok: false; status: 400 | 422; error: string }
> {
  const guard = validateUpload(file);
  if (guard) return guard;

  const upload = file as UploadLike;

  // A CSV is a single unnamed sheet; reuse the single-grid path.
  if (upload.name.toLowerCase().endsWith(".csv")) {
    try {
      return { ok: true, grids: [readCsv(await upload.text())], skipped: [] };
    } catch (err) {
      const message = err instanceof Error ? err.message : "could not be read";
      return { ok: false, status: 422, error: `Could not read that file: ${message}` };
    }
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await upload.arrayBuffer());

    const sheetNames = workbook.worksheets.map((ws) => ws.name);
    if (sheetNames.length === 0) {
      return {
        ok: false,
        status: 422,
        error: "Could not read that file: the workbook has no worksheets.",
      };
    }

    const grids: RawGrid[] = [];
    const skipped: Array<{ name: string; reason: string }> = [];

    for (const sheet of workbook.worksheets.slice(0, MAX_SHEETS)) {
      try {
        grids.push(gridFromWorksheet(sheet, sheetNames));
      } catch (err) {
        skipped.push({
          name: sheet.name,
          reason: err instanceof Error ? err.message : "could not be read",
        });
      }
    }

    for (const sheet of workbook.worksheets.slice(MAX_SHEETS)) {
      skipped.push({
        name: sheet.name,
        reason: `only the first ${MAX_SHEETS} worksheets are read`,
      });
    }

    if (grids.length === 0) {
      return {
        ok: false,
        status: 422,
        error:
          "No worksheet had a header row. The first row of each sheet should hold the column names.",
      };
    }

    return { ok: true, grids, skipped };
  } catch (err) {
    const message = err instanceof Error ? err.message : "could not be read";
    return { ok: false, status: 422, error: `Could not read that file: ${message}` };
  }
}

/** Builds the grid for one worksheet. Throws when it has no header row. */
function gridFromWorksheet(
  sheet: ExcelJS.Worksheet,
  sheetNames: string[]
): RawGrid {
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
