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

/**
 * Parses a CSV string into an array of row objects, mapping CSV headers
 * to column keys. Handles quoted fields with commas and escaped quotes.
 */
export function parseCsv(
  csvText: string,
  columns: ColumnDef[]
): Record<string, string>[] {
  const lines = parseCsvLines(csvText);
  if (lines.length < 2) return [];

  const headerRow = lines[0];
  // Build a mapping from CSV header label to column key
  const headerToKey: Record<number, string> = {};
  for (let i = 0; i < headerRow.length; i++) {
    const headerLabel = headerRow[i].trim();
    const matchedCol = columns.find(
      (col) => col.label.toLowerCase() === headerLabel.toLowerCase()
    );
    if (matchedCol) {
      headerToKey[i] = matchedCol.key;
    }
  }

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i];
    if (values.length === 0 || (values.length === 1 && values[0].trim() === "")) continue;

    const row: Record<string, string> = {};
    let hasData = false;
    for (const [colIdx, key] of Object.entries(headerToKey)) {
      const val = values[Number(colIdx)]?.trim() || "";
      row[key] = val;
      if (val) hasData = true;
    }
    // Also initialize any columns that weren't in the CSV
    for (const col of columns) {
      if (!(col.key in row)) {
        row[col.key] = "";
      }
    }
    if (hasData) rows.push(row);
  }

  return rows;
}

/**
 * Parses CSV text into a 2D array, properly handling quoted fields.
 */
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
