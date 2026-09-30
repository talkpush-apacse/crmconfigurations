import type { ColumnDef } from "./types";

/**
 * Escapes a CSV field value by wrapping it in quotes if it contains
 * commas, quotes, or newlines.
 */
function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generates a CSV template string with headers from column definitions
 * and one sample data row.
 */
export function generateCsvTemplate(
  columns: ColumnDef[],
  sampleRow: Record<string, string>
): string {
  const headers = columns.map((col) => escapeCsvField(col.label));
  const sampleValues = columns.map((col) => escapeCsvField(sampleRow[col.key] || ""));

  return [headers.join(","), sampleValues.join(",")].join("\n");
}

export function generateCsv(
  columns: ColumnDef[],
  rows: Record<string, string>[]
): string {
  const headers = columns.map((col) => escapeCsvField(col.label));
  const body = rows.map((row) =>
    columns.map((col) => escapeCsvField(row[col.key] || "")).join(",")
  );

  return [headers.join(","), ...body].join("\n");
}

export interface CsvParseReport {
  rows: Record<string, string>[];
  headers: string[];
  matchedHeaders: string[];
  ignoredHeaders: string[];
  missingHeaders: string[];
  totalDataRows: number;
}

/**
 * Parses a CSV string and reports how headers map to configured columns.
 */
export function parseCsvWithReport(
  csvText: string,
  columns: ColumnDef[]
): CsvParseReport {
  const lines = parseCsvLines(csvText);
  if (lines.length < 2) {
    return { rows: [], headers: [], matchedHeaders: [], ignoredHeaders: [], missingHeaders: columns.map((col) => col.label), totalDataRows: 0 };
  }

  const headerRow = lines[0].map((header) => header.trim());
  const headerToKey: Record<number, string> = {};
  const matchedColumnKeys = new Set<string>();
  const matchedHeaders: string[] = [];
  const ignoredHeaders: string[] = [];

  for (let i = 0; i < headerRow.length; i++) {
    const headerLabel = headerRow[i];
    const matchedCol = columns.find(
      (col) => col.label.toLowerCase() === headerLabel.toLowerCase()
    );
    if (matchedCol) {
      headerToKey[i] = matchedCol.key;
      matchedColumnKeys.add(matchedCol.key);
      matchedHeaders.push(matchedCol.label);
    } else if (headerLabel) {
      ignoredHeaders.push(headerLabel);
    }
  }

  const rows: Record<string, string>[] = [];
  let totalDataRows = 0;
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i];
    if (values.length === 0 || (values.length === 1 && values[0].trim() === "")) continue;
    totalDataRows++;

    const row: Record<string, string> = {};
    let hasMatchedData = false;
    for (const [colIdx, key] of Object.entries(headerToKey)) {
      const val = values[Number(colIdx)]?.trim() || "";
      row[key] = val;
      if (val) hasMatchedData = true;
    }
    for (const col of columns) {
      if (!(col.key in row)) {
        row[col.key] = "";
      }
    }
    if (hasMatchedData) rows.push(row);
  }

  const missingHeaders = columns
    .filter((col) => !matchedColumnKeys.has(col.key))
    .map((col) => col.label);

  return { rows, headers: headerRow, matchedHeaders, ignoredHeaders, missingHeaders, totalDataRows };
}

/**
 * Parses a CSV string into an array of row objects, mapping CSV headers
 * to column keys. Handles quoted fields with commas and escaped quotes.
 */
export function parseCsv(
  csvText: string,
  columns: ColumnDef[]
): Record<string, string>[] {
  return parseCsvWithReport(csvText, columns).rows;
}

/**
 * Parses CSV text into a 2D array, properly handling quoted fields.
 *
 * Exported as `parseCsvGrid` for callers that need the raw grid rather than
 * rows mapped onto a known column set (e.g. custom-tab spreadsheet import,
 * where the columns are not known until the header row is read).
 */
export function parseCsvGrid(csvText: string): string[][] {
  return parseCsvLines(csvText);
}

function parseCsvLines(csvText: string): string[][] {
  const lines: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++; // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        current.push(field);
        field = "";
      } else if (ch === "\r" && next === "\n") {
        current.push(field);
        field = "";
        lines.push(current);
        current = [];
        i++; // skip \n
      } else if (ch === "\n") {
        current.push(field);
        field = "";
        lines.push(current);
        current = [];
      } else {
        field += ch;
      }
    }
  }

  // Push last field and line
  current.push(field);
  if (current.length > 0 && !(current.length === 1 && current[0] === "")) {
    lines.push(current);
  }

  return lines;
}

/**
 * Triggers a browser download of a CSV file.
 */
export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
