import type { CustomTabColumn } from "./types";

/**
 * Turns an uploaded CSV/XLSX grid into a proposed custom-tab schema.
 *
 * Everything here is pure so it can be exercised without exceljs or a request.
 * The caller (the /infer route) is responsible for reading the file into a
 * `RawGrid`; this module decides what the columns mean.
 *
 * Column types are settled in three passes, best evidence first:
 *   1. declared   — the header cell says so, e.g. "Status [select: New, Hired]"
 *   2. validation — the sheet has a real Excel dropdown on that column
 *   3. inferred   — read from the values themselves
 */

export type ColumnType = CustomTabColumn["type"];

/** Hard limits, so a client dropping in a 50k-row export can't wedge the UI. */
export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_COLUMNS = 30;

/** How many rows to sample when inferring a type. */
const INFER_SAMPLE_SIZE = 200;

/** Above this many distinct values, a column is free text rather than a choice. */
const MAX_SELECT_OPTIONS = 12;

/** A column only becomes a dropdown if values genuinely repeat. */
const MAX_SELECT_DISTINCT_RATIO = 0.5;

/** Long or multi-line content gets a textarea instead of a single-line input. */
const TEXTAREA_AVG_LENGTH = 60;

const MULTISELECT_DELIMITERS = [";", "|", ","] as const;

export interface RawGrid {
  /** Worksheet this grid came from. */
  sheetName: string;
  /** Every worksheet in the file, so the UI can offer a picker. */
  sheetNames: string[];
  /** First row — the header labels. */
  header: unknown[];
  /** Remaining rows, already capped by the caller if needed. */
  rows: unknown[][];
  /** Total data rows in the file before any cap was applied. */
  totalRows: number;
  /**
   * Native Excel data-validation dropdown options, keyed by zero-based column
   * index. CSV files have none.
   */
  validationOptions?: Record<number, string[]>;
}

export interface InferredColumn {
  key: string;
  label: string;
  type: ColumnType;
  required: boolean;
  options?: string[];
  /** Where the type came from — surfaced in the review step. */
  source: "declared" | "validation" | "inferred";
  /**
   * "low" means the guess is worth a second look: a column that was entirely
   * empty, or one where the evidence was thin.
   */
  confidence: "high" | "low";
}

export interface SpreadsheetProposal {
  sheetName: string;
  sheetNames: string[];
  columns: InferredColumn[];
  rows: Record<string, unknown>[];
  totalRowsInFile: number;
  /** True when the file had more rows than MAX_IMPORT_ROWS. */
  truncated: boolean;
  /** Human-readable notes to show above the review table. */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Cell normalization
// ---------------------------------------------------------------------------

/**
 * Flattens whatever a cell holds into a trimmed string.
 *
 * exceljs hands back plain values for simple cells but objects for rich text,
 * hyperlinks, formulas and errors, so those shapes are duck-typed here rather
 * than importing exceljs into what is otherwise a pure module.
 */
export function normalizeCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return value.toISOString();

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // Rich text: { richText: [{ text }, ...] }
    if (Array.isArray(obj.richText)) {
      return obj.richText
        .map((part) => normalizeCellValue((part as Record<string, unknown>)?.text))
        .join("")
        .trim();
    }
    // Hyperlink: { text, hyperlink }
    if (typeof obj.hyperlink === "string") {
      return normalizeCellValue(obj.text ?? obj.hyperlink);
    }
    // Formula: { formula, result }
    if ("result" in obj) return normalizeCellValue(obj.result);
    // Error: { error: '#N/A' }
    if ("error" in obj) return "";
    if ("text" in obj) return normalizeCellValue(obj.text);
  }

  return String(value).trim();
}

// ---------------------------------------------------------------------------
// Keys and header declarations
// ---------------------------------------------------------------------------

/** "Job Title (External)" → "job_title_external" */
export function toColumnKey(label: string): string {
  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return key || "column";
}

/** Keeps generated keys unique, since two headers can normalize to the same key. */
function uniqueKey(base: string, taken: Set<string>): string {
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  for (let n = 2; ; n++) {
    const candidate = `${base}_${n}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
}

const TYPE_ALIASES: Record<string, ColumnType> = {
  text: "text",
  string: "text",
  textarea: "textarea",
  longtext: "textarea",
  paragraph: "textarea",
  number: "number",
  numeric: "number",
  int: "number",
  integer: "number",
  decimal: "number",
  date: "date",
  datetime: "date",
  select: "select",
  dropdown: "select",
  singleselect: "select",
  choice: "select",
  multiselect: "multiselect",
  multiple: "multiselect",
  multi: "multiselect",
  checkbox: "checkbox",
  bool: "checkbox",
  boolean: "checkbox",
  yesno: "checkbox",
  email: "email",
  url: "url",
  link: "url",
};

export interface HeaderDeclaration {
  label: string;
  type?: ColumnType;
  options?: string[];
  required: boolean;
  /** True when the header carried a bracket hint we could not understand. */
  unknownType?: string;
}

/**
 * Reads an optional type hint out of a header cell so the type can be stated
 * rather than guessed:
 *
 *   "Job Title"                          → no hint
 *   "Job Title*"                         → required
 *   "Start Date [date]"                  → date
 *   "Status [select: New, In Review]"    → select with options
 *   "Skills [multiselect: Voice | Chat]" → multiselect with options
 */
export function parseHeaderDeclaration(raw: string): HeaderDeclaration {
  let label = raw.trim();
  let type: ColumnType | undefined;
  let options: string[] | undefined;
  let unknownType: string | undefined;

  const bracket = label.match(/\[([^\]]*)\]\s*$/);
  if (bracket) {
    label = label.slice(0, bracket.index).trim();
    const body = bracket[1].trim();
    const [rawType, rawOptions] = body.split(":", 2);
    const normalized = rawType.trim().toLowerCase().replace(/[\s_-]/g, "");
    const resolved = TYPE_ALIASES[normalized];

    if (resolved) {
      type = resolved;
      if (rawOptions) {
        options = splitOptionList(rawOptions);
      }
    } else if (body) {
      unknownType = body;
    }
  }

  // A trailing asterisk is the near-universal spreadsheet convention for required.
  let required = false;
  if (label.endsWith("*")) {
    required = true;
    label = label.slice(0, -1).trim();
  }

  return { label, type, options, required, unknownType };
}

/** Splits an inline option list on | or ; or , — whichever the author used. */
function splitOptionList(raw: string): string[] {
  const delimiter = raw.includes("|") ? "|" : raw.includes(";") ? ";" : ",";
  return dedupePreservingOrder(
    raw.split(delimiter).map((o) => o.trim()).filter(Boolean)
  );
}

function dedupePreservingOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const fingerprint = v.toLowerCase();
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    out.push(v);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Value-based inference
// ---------------------------------------------------------------------------

const BOOLEAN_WORDS = new Set([
  "yes", "no", "y", "n", "true", "false", "1", "0", "✓", "x", "checked", "unchecked",
]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/\S+$/i;
const NUMBER_RE = /^-?\d{1,3}(,\d{3})*(\.\d+)?$|^-?\d+(\.\d+)?$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]|$)/;
const SLASH_DATE_RE = /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/;

function looksLikeDate(value: string): boolean {
  if (ISO_DATE_RE.test(value) || SLASH_DATE_RE.test(value)) return true;
  // Written-out dates like "12 Jan 2026" / "Jan 12, 2026"
  if (/^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}$/.test(value)) return true;
  if (/^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}$/.test(value)) return true;
  return false;
}

/**
 * Detects a delimited multi-value column: cells like "Voice, Chat" where the
 * individual tokens repeat across rows and form a small shared vocabulary.
 */
function detectMultiselect(values: string[]): string[] | null {
  for (const delimiter of MULTISELECT_DELIMITERS) {
    const withDelimiter = values.filter((v) => v.includes(delimiter));
    // Needs to be the column's habit, not one stray cell.
    if (withDelimiter.length < 2 || withDelimiter.length < values.length * 0.3) continue;

    const tokens = values.flatMap((v) =>
      v.split(delimiter).map((t) => t.trim()).filter(Boolean)
    );
    if (tokens.length === 0) continue;

    const vocabulary = dedupePreservingOrder(tokens);
    if (vocabulary.length > MAX_SELECT_OPTIONS) continue;
    // Tokens must recur — otherwise it's prose that happens to contain commas.
    if (vocabulary.length >= tokens.length) continue;
    // Multi-word tokens usually mean prose, not tags.
    const avgWords =
      vocabulary.reduce((sum, t) => sum + t.split(/\s+/).length, 0) / vocabulary.length;
    if (avgWords > 3) continue;

    return vocabulary;
  }
  return null;
}

interface TypeGuess {
  type: ColumnType;
  options?: string[];
  confidence: "high" | "low";
}

/** Decides a column's type from its values alone. */
export function inferColumnType(rawValues: string[]): TypeGuess {
  const values = rawValues.map((v) => v.trim()).filter((v) => v !== "");

  // Nothing to go on — a header with no data under it.
  if (values.length === 0) return { type: "text", confidence: "low" };

  const every = (predicate: (v: string) => boolean) => values.every(predicate);

  if (every((v) => BOOLEAN_WORDS.has(v.toLowerCase()))) {
    return { type: "checkbox", confidence: "high" };
  }
  if (every((v) => EMAIL_RE.test(v))) {
    return { type: "email", confidence: "high" };
  }
  if (every((v) => URL_RE.test(v))) {
    return { type: "url", confidence: "high" };
  }
  if (every(looksLikeDate)) {
    return { type: "date", confidence: "high" };
  }
  if (every((v) => NUMBER_RE.test(v))) {
    return { type: "number", confidence: "high" };
  }

  const multiselect = detectMultiselect(values);
  if (multiselect) {
    return { type: "multiselect", options: multiselect, confidence: "high" };
  }

  const distinct = dedupePreservingOrder(values);
  const repeats = distinct.length < values.length;
  const isChoice =
    repeats &&
    distinct.length <= MAX_SELECT_OPTIONS &&
    distinct.length / values.length <= MAX_SELECT_DISTINCT_RATIO &&
    // A dropdown of paragraphs is not a dropdown.
    distinct.every((v) => v.length <= 60 && !v.includes("\n"));

  if (isChoice) {
    return { type: "select", options: distinct, confidence: "high" };
  }

  const hasNewline = values.some((v) => v.includes("\n"));
  const avgLength = values.reduce((sum, v) => sum + v.length, 0) / values.length;
  if (hasNewline || avgLength > TEXTAREA_AVG_LENGTH) {
    return { type: "textarea", confidence: "high" };
  }

  return { type: "text", confidence: "high" };
}

/**
 * Starting width, in px, for an imported column.
 *
 * Without this the grid falls back to type defaults, which is fine — but an
 * imported sheet often has one long-text column (a job description) and
 * several short ones, and giving the long one room up front avoids the client
 * having to resize before they can read their own data.
 */
export function defaultWidthForType(type: ColumnType): number {
  switch (type) {
    case "textarea":
      return 320;
    case "checkbox":
      return 90;
    case "select":
      return 170;
    case "multiselect":
      return 200;
    case "date":
      return 140;
    case "number":
      return 120;
    case "url":
      return 240;
    case "email":
      return 220;
    default:
      return 190;
  }
}

// ---------------------------------------------------------------------------
// Proposal assembly
// ---------------------------------------------------------------------------

/**
 * Builds the full proposal: one column per header cell, plus the data rows
 * keyed by the generated column keys. Nothing is persisted — the caller shows
 * this for review and only then creates the tab.
 */
export function buildProposal(grid: RawGrid): SpreadsheetProposal {
  const warnings: string[] = [];

  // Trailing empty header cells are common in exported spreadsheets.
  const headerCells = grid.header.map(normalizeCellValue);
  while (headerCells.length > 0 && headerCells[headerCells.length - 1] === "") {
    headerCells.pop();
  }

  if (headerCells.length === 0) {
    return {
      sheetName: grid.sheetName,
      sheetNames: grid.sheetNames,
      columns: [],
      rows: [],
      totalRowsInFile: grid.totalRows,
      truncated: false,
      warnings: ["The first row is empty, so there are no column headers to read."],
    };
  }

  let headers = headerCells;
  if (headers.length > MAX_IMPORT_COLUMNS) {
    warnings.push(
      `Only the first ${MAX_IMPORT_COLUMNS} columns were read — the file has ${headers.length}.`
    );
    headers = headers.slice(0, MAX_IMPORT_COLUMNS);
  }

  const unnamed = headers.filter((h) => h === "").length;
  if (unnamed > 0) {
    warnings.push(
      `${unnamed} column${unnamed === 1 ? "" : " s"} had no header text and were named automatically.`
    );
  }

  const cappedRows = grid.rows.slice(0, MAX_IMPORT_ROWS);
  const truncated = grid.totalRows > MAX_IMPORT_ROWS;
  if (truncated) {
    warnings.push(
      `Only the first ${MAX_IMPORT_ROWS} of ${grid.totalRows} rows were imported.`
    );
  }

  const takenKeys = new Set<string>();
  const columns: InferredColumn[] = headers.map((rawHeader, colIdx) => {
    const declaration = parseHeaderDeclaration(rawHeader || `Column ${colIdx + 1}`);
    const label = declaration.label || `Column ${colIdx + 1}`;
    const key = uniqueKey(toColumnKey(label), takenKeys);

    if (declaration.unknownType) {
      warnings.push(
        `"${label}": the hint [${declaration.unknownType}] isn't a recognized type, so the type was detected from the values instead.`
      );
    }

    const columnValues = cappedRows
      .slice(0, INFER_SAMPLE_SIZE)
      .map((row) => normalizeCellValue(row[colIdx]));

    // 1. The header declared the type.
    if (declaration.type) {
      const needsOptions =
        declaration.type === "select" || declaration.type === "multiselect";
      const options = declaration.options?.length
        ? declaration.options
        : needsOptions
          ? (inferColumnType(columnValues).options ?? [])
          : undefined;

      if (needsOptions && (!options || options.length === 0)) {
        warnings.push(
          `"${label}" was declared as ${declaration.type} but has no options — add them in the review step.`
        );
      }

      return {
        key,
        label,
        type: declaration.type,
        required: declaration.required,
        ...(options && options.length > 0 ? { options } : {}),
        source: "declared" as const,
        confidence: "high" as const,
      };
    }

    // 2. The sheet has a real Excel dropdown on this column.
    const validation = grid.validationOptions?.[colIdx];
    if (validation && validation.length > 0) {
      const options = dedupePreservingOrder(validation);
      const multi = detectMultiselect(columnValues.filter(Boolean));
      return {
        key,
        label,
        type: multi ? "multiselect" : "select",
        required: declaration.required,
        options,
        source: "validation" as const,
        confidence: "high" as const,
      };
    }

    // 3. Read it off the values.
    const guess = inferColumnType(columnValues);
    return {
      key,
      label,
      type: guess.type,
      required: declaration.required,
      ...(guess.options ? { options: guess.options } : {}),
      source: "inferred" as const,
      confidence: guess.confidence,
    };
  });

  const emptyColumns = columns.filter((c) => c.confidence === "low");
  if (emptyColumns.length > 0) {
    warnings.push(
      `No data found under: ${emptyColumns.map((c) => c.label).join(", ")}. These defaulted to plain text.`
    );
  }

  // Build the data rows, dropping any that are entirely blank.
  const rows: Record<string, unknown>[] = [];
  for (const rawRow of cappedRows) {
    const row: Record<string, unknown> = {};
    let hasValue = false;
    columns.forEach((col, colIdx) => {
      const value = coerceToColumnType(normalizeCellValue(rawRow[colIdx]), col);
      row[col.key] = value;
      if (value !== "" && value !== false) hasValue = true;
    });
    if (hasValue) rows.push(row);
  }

  return {
    sheetName: grid.sheetName,
    sheetNames: grid.sheetNames,
    columns,
    rows,
    totalRowsInFile: grid.totalRows,
    truncated,
    warnings,
  };
}

/**
 * Shapes a cell's string value into what the column's editor expects.
 *
 * Checkboxes become booleans; multi-selects are stored comma-joined (the same
 * shape EditableCell reads and writes), with tokens matched back to the
 * declared options so casing stays consistent. Everything else stays a string.
 */
export function coerceToColumnType(
  value: string,
  column: Pick<InferredColumn, "type" | "options">
): string | boolean {
  if (column.type === "checkbox") {
    const v = value.toLowerCase();
    return v === "yes" || v === "y" || v === "true" || v === "1" || v === "✓" || v === "x" || v === "checked";
  }

  if (column.type === "multiselect") {
    if (!value) return "";
    const delimiter = MULTISELECT_DELIMITERS.find((d) => value.includes(d)) ?? ",";
    const tokens = value.split(delimiter).map((t) => t.trim()).filter(Boolean);
    const canonical = tokens.map((token) => {
      const match = column.options?.find((o) => o.toLowerCase() === token.toLowerCase());
      return match ?? token;
    });
    return dedupePreservingOrder(canonical).join(", ");
  }

  return value;
}
