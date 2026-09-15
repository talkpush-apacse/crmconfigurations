/**
 * Custom tab schema + row handling.
 *
 * Custom tabs are the escape hatch for implementations the 19 standard tabs
 * don't fit: rather than growing another default tab for every client variation,
 * an SE describes a table and it becomes a real tab on that client's checklist.
 *
 * Everything here is pure, so the MCP tools, the preview path and the importer
 * all agree on what a column means and what a cell is allowed to hold. The MCP
 * tools accept whatever a model hands them, so validation lives here rather
 * than in the tool bodies — a wrong dropdown value must come back as a readable
 * error, not a silently blank cell in front of the client.
 */

import type { CustomTab, CustomTabColumn, CustomTabRow } from "./types";

export const CUSTOM_TAB_COLUMN_TYPES = [
  "text",
  "textarea",
  "number",
  "date",
  "select",
  "multiselect",
  "email",
  "url",
  "checkbox",
] as const;

export type CustomTabColumnType = (typeof CUSTOM_TAB_COLUMN_TYPES)[number];

/** Matches the spreadsheet importer's ceiling so both paths behave the same. */
export const MAX_CUSTOM_TAB_COLUMNS = 30;
/** A tab is a working list, not a data warehouse. */
export const MAX_CUSTOM_TAB_ROWS = 2000;

/** `id` is the row's own identity — a column can't claim it. */
const RESERVED_COLUMN_KEYS = new Set(["id"]);

const CHOICE_TYPES = new Set<CustomTabColumnType>(["select", "multiselect"]);

/** How many values a multiselect cell may be split on. */
const MULTISELECT_SPLIT = /[;|,]/;

/** Thrown for a spec or value the caller must fix. Message is client-readable. */
export class CustomTabError extends Error {
  readonly issues: string[];

  constructor(message: string, issues: string[] = []) {
    super(issues.length > 0 ? `${message}\n- ${issues.join("\n- ")}` : message);
    this.name = "CustomTabError";
    this.issues = issues;
  }
}

export interface ColumnSpec {
  key?: string;
  label: string;
  type: CustomTabColumnType;
  required?: boolean;
  options?: string[];
  description?: string;
  example?: string;
  width?: number;
}

export interface NormalizedColumns {
  columns: CustomTabColumn[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

export function normalizeColumnKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function cleanOptions(raw: string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const option of raw ?? []) {
    const value = String(option ?? "").trim();
    if (!value) continue;
    const dedupeKey = value.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(value);
  }
  return out;
}

function optionalText(value: string | undefined): string | undefined {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Validates a proposed column list and returns it in storage shape.
 *
 * Every problem is collected before throwing so a bad spec comes back as one
 * complete list of fixes instead of one error per round trip.
 */
export function normalizeColumns(specs: ColumnSpec[]): NormalizedColumns {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(specs) || specs.length === 0) {
    throw new CustomTabError("A custom tab needs at least one column.");
  }
  if (specs.length > MAX_CUSTOM_TAB_COLUMNS) {
    throw new CustomTabError(
      `A custom tab can have at most ${MAX_CUSTOM_TAB_COLUMNS} columns (got ${specs.length}).`
    );
  }

  const columns: CustomTabColumn[] = [];
  const usedKeys = new Map<string, string>();

  specs.forEach((spec, index) => {
    const position = `column ${index + 1}`;
    const label = String(spec?.label ?? "").trim();
    if (!label) {
      issues.push(`${position}: label is required.`);
      return;
    }

    const type = spec?.type;
    if (!CUSTOM_TAB_COLUMN_TYPES.includes(type as CustomTabColumnType)) {
      issues.push(
        `${position} ("${label}"): type "${String(type)}" is not one of ${CUSTOM_TAB_COLUMN_TYPES.join(", ")}.`
      );
      return;
    }

    const key = normalizeColumnKey(spec.key ? spec.key : label);
    if (!key) {
      issues.push(
        `${position} ("${label}"): can't derive a column key — give it an explicit snake_case key.`
      );
      return;
    }
    if (RESERVED_COLUMN_KEYS.has(key)) {
      issues.push(`${position} ("${label}"): "${key}" is reserved. Use a different key.`);
      return;
    }
    const clash = usedKeys.get(key);
    if (clash) {
      issues.push(
        `${position} ("${label}"): key "${key}" is already used by "${clash}". Keys must be unique.`
      );
      return;
    }
    usedKeys.set(key, label);

    if (spec.key && normalizeColumnKey(spec.key) !== spec.key) {
      warnings.push(`Column "${label}": key normalized to "${key}".`);
    }

    const options = cleanOptions(spec.options);
    const isChoice = CHOICE_TYPES.has(type as CustomTabColumnType);
    if (isChoice && options.length === 0) {
      issues.push(
        `${position} ("${label}"): type "${type}" needs at least one entry in options.`
      );
      return;
    }
    if (!isChoice && options.length > 0) {
      warnings.push(
        `Column "${label}": options were dropped — they only apply to select and multiselect.`
      );
    }

    const column: CustomTabColumn = {
      key,
      label,
      type: type as CustomTabColumnType,
    };
    if (spec.required) column.required = true;
    if (isChoice) column.options = options;

    const description = optionalText(spec.description);
    if (description) column.description = description;
    const example = optionalText(spec.example);
    if (example) column.example = example;

    if (typeof spec.width === "number" && Number.isFinite(spec.width) && spec.width > 0) {
      column.width = Math.round(spec.width);
    }

    columns.push(column);
  });

  if (issues.length > 0) {
    throw new CustomTabError("The column definitions have problems:", issues);
  }

  return { columns, warnings };
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

const TRUE_WORDS = new Set(["true", "yes", "y", "1", "x", "checked", "✓"]);
const FALSE_WORDS = new Set(["false", "no", "n", "0", "", "unchecked"]);

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function matchOption(value: string, options: string[]): string | null {
  const needle = value.trim().toLowerCase();
  const hit = options.find((option) => option.toLowerCase() === needle);
  return hit ?? null;
}

function isoFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Reads a loose date into `YYYY-MM-DD`.
 *
 * Deliberately avoids `toISOString()`: JS parses a bare date string like
 * "March 5 2026" as local midnight, so converting to UTC shifts it to the 4th
 * for anyone east of Greenwich — the whole team is UTC+8, so every date a
 * client typed would land a day early. String input is therefore read in local
 * time, while a real Date (what a spreadsheet parser hands over, at UTC
 * midnight) is read in UTC.
 */
function coerceDate(value: unknown): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return isoFromParts(
      value.getUTCFullYear(),
      value.getUTCMonth() + 1,
      value.getUTCDate()
    );
  }
  const raw = String(value ?? "").trim();
  const alreadyIso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (alreadyIso) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return isoFromParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
}

interface CellResult {
  value: string | boolean;
  error?: string;
  warning?: string;
}

/**
 * Turns one incoming cell value into what the grid stores.
 *
 * The grid holds strings (and booleans for checkboxes), so numbers and dates
 * are normalized to their display form here rather than at render time.
 */
export function coerceCellValue(column: CustomTabColumn, raw: unknown): CellResult {
  const label = column.label;

  if (raw === null || raw === undefined) {
    return { value: column.type === "checkbox" ? false : "" };
  }

  switch (column.type) {
    case "checkbox": {
      if (typeof raw === "boolean") return { value: raw };
      const word = String(raw).trim().toLowerCase();
      if (TRUE_WORDS.has(word)) return { value: true };
      if (FALSE_WORDS.has(word)) return { value: false };
      return {
        value: false,
        warning: `"${label}": couldn't read "${String(raw)}" as yes/no — stored as unchecked.`,
      };
    }

    case "number": {
      const text = String(raw).trim();
      if (text === "") return { value: "" };
      const cleaned = text.replace(/,/g, "");
      if (!Number.isFinite(Number(cleaned))) {
        return {
          value: text,
          warning: `"${label}": "${text}" is not a number — stored as typed.`,
        };
      }
      return { value: cleaned };
    }

    case "date": {
      const text = String(raw).trim();
      if (text === "") return { value: "" };
      const iso = coerceDate(raw);
      if (!iso) {
        return {
          value: text,
          warning: `"${label}": couldn't read "${text}" as a date — stored as typed. Use YYYY-MM-DD.`,
        };
      }
      return { value: iso };
    }

    case "select": {
      const text = String(raw).trim();
      if (text === "") return { value: "" };
      const options = column.options ?? [];
      const hit = matchOption(text, options);
      if (!hit) {
        return {
          value: "",
          error: `"${label}": "${text}" is not one of ${options.join(", ")}.`,
        };
      }
      return { value: hit };
    }

    case "multiselect": {
      const text = String(raw).trim();
      if (text === "") return { value: "" };
      const options = column.options ?? [];
      const picked: string[] = [];
      const unknown: string[] = [];
      for (const part of text.split(MULTISELECT_SPLIT)) {
        const candidate = part.trim();
        if (!candidate) continue;
        const hit = matchOption(candidate, options);
        if (hit) {
          if (!picked.includes(hit)) picked.push(hit);
        } else {
          unknown.push(candidate);
        }
      }
      if (unknown.length > 0) {
        return {
          value: picked.join(", "),
          error: `"${label}": ${unknown.map((u) => `"${u}"`).join(", ")} not in ${options.join(", ")}.`,
        };
      }
      return { value: picked.join(", ") };
    }

    case "email": {
      const text = String(raw).trim();
      if (text === "") return { value: "" };
      if (!EMAIL_SHAPE.test(text)) {
        return { value: text, warning: `"${label}": "${text}" doesn't look like an email address.` };
      }
      return { value: text };
    }

    case "url": {
      const text = String(raw).trim();
      if (text === "") return { value: "" };
      if (!/^https?:\/\/\S+$/i.test(text)) {
        return {
          value: text,
          warning: `"${label}": "${text}" doesn't look like a URL (expected http:// or https://).`,
        };
      }
      return { value: text };
    }

    default:
      return { value: String(raw) };
  }
}

export interface NormalizeRowsResult {
  rows: CustomTabRow[];
  warnings: string[];
}

export interface NormalizeRowsOptions {
  /** Generates ids for rows that don't carry one. */
  makeId: () => string;
  /** Keep a caller-supplied `id` (used when updating existing rows). */
  preserveIds?: boolean;
  /** Only fill the keys present in the input — for partial row updates. */
  partial?: boolean;
  /** Row numbers in error messages start here. */
  rowOffset?: number;
}

/**
 * Validates and coerces incoming rows against the tab's columns.
 *
 * Unknown keys are dropped with a warning rather than stored: a value under a
 * key no column renders is invisible to the client but still shows up in
 * exports, which reads as data loss from either side.
 */
export function normalizeRows(
  columns: CustomTabColumn[],
  rawRows: Array<Record<string, unknown>>,
  options: NormalizeRowsOptions
): NormalizeRowsResult {
  const { makeId, preserveIds = false, partial = false, rowOffset = 1 } = options;
  const issues: string[] = [];
  const warnings: string[] = [];

  if (rawRows.length > MAX_CUSTOM_TAB_ROWS) {
    throw new CustomTabError(
      `That's ${rawRows.length} rows — the ceiling is ${MAX_CUSTOM_TAB_ROWS} per tab.`
    );
  }

  const byKey = new Map(columns.map((column) => [column.key, column]));
  const rows: CustomTabRow[] = [];

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + rowOffset;
    const source = rawRow && typeof rawRow === "object" ? rawRow : {};
    const row: CustomTabRow = { id: "" };

    for (const key of Object.keys(source)) {
      if (key === "id") continue;
      if (!byKey.has(key)) {
        warnings.push(
          `Row ${rowNumber}: no column "${key}" on this tab — value ignored. Known keys: ${columns
            .map((c) => c.key)
            .join(", ")}.`
        );
      }
    }

    for (const column of columns) {
      const present = Object.prototype.hasOwnProperty.call(source, column.key);
      if (partial && !present) continue;

      const result = coerceCellValue(column, present ? source[column.key] : null);
      if (result.error) issues.push(`Row ${rowNumber} ${result.error}`);
      if (result.warning) warnings.push(`Row ${rowNumber} ${result.warning}`);
      row[column.key] = result.value;
    }

    const suppliedId = typeof source.id === "string" ? source.id.trim() : "";
    row.id = preserveIds && suppliedId ? suppliedId : makeId();
    rows.push(row);
  });

  if (issues.length > 0) {
    throw new CustomTabError("Some cell values don't match the tab's columns:", issues);
  }

  return { rows, warnings };
}

// ---------------------------------------------------------------------------
// Preview + summaries
// ---------------------------------------------------------------------------

function cellText(value: unknown): string {
  if (value === true) return "Yes";
  if (value === false || value === null || value === undefined) return "";
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

/** Renders rows as a markdown table so a proposal can be read before it's real. */
export function renderPreviewTable(
  columns: CustomTabColumn[],
  rows: CustomTabRow[],
  limit = 10
): string {
  const header = `| ${columns.map((c) => cellText(c.label)).join(" | ")} |`;
  const divider = `| ${columns.map(() => "---").join(" | ")} |`;
  const shown = rows.slice(0, limit);
  const body =
    shown.length === 0
      ? `| ${columns.map(() => "_(empty)_").join(" | ")} |`
      : shown
          .map((row) => `| ${columns.map((c) => cellText(row[c.key])).join(" | ")} |`)
          .join("\n");
  const more =
    rows.length > shown.length ? `\n\n…and ${rows.length - shown.length} more row(s).` : "";
  return `${header}\n${divider}\n${body}${more}`;
}

/** One line per column, for confirming the shape before writing it. */
export function describeColumns(columns: CustomTabColumn[]): string {
  return columns
    .map((column) => {
      const bits: string[] = [column.type];
      if (column.required) bits.push("required");
      if (column.options?.length) bits.push(`options: ${column.options.join(" / ")}`);
      if (column.description) bits.push(`help: ${column.description}`);
      if (column.example) bits.push(`e.g. ${column.example}`);
      return `- ${column.label} (\`${column.key}\`) — ${bits.join("; ")}`;
    })
    .join("\n");
}

export interface CustomTabSummary {
  id: string;
  slug: string;
  url_slug: string;
  label: string;
  description: string | null;
  icon: string;
  kind: "table" | "form";
  columns: Array<{
    key: string;
    label: string;
    type: string;
    required: boolean;
    options?: string[];
    description?: string;
    example?: string;
  }>;
  rowCount: number;
  uploadedFile: string | null;
  createdAt: string | null;
}

export function summarizeTab(tab: CustomTab): CustomTabSummary {
  const columns = tab.columns ?? [];
  return {
    id: tab.id,
    slug: tab.slug,
    url_slug: `custom-${tab.slug}`,
    label: tab.label,
    description: tab.description ?? null,
    icon: tab.icon,
    kind: tab.columns !== undefined ? "table" : "form",
    columns: columns.map((column) => ({
      key: column.key,
      label: column.label,
      type: column.type,
      required: !!column.required,
      ...(column.options?.length ? { options: column.options } : {}),
      ...(column.description ? { description: column.description } : {}),
      ...(column.example ? { example: column.example } : {}),
    })),
    rowCount: (tab.rows ?? []).length,
    uploadedFile: tab.uploadedFile?.name ?? null,
    createdAt: tab.createdAt ?? null,
  };
}

/** A table-based tab is the only kind these tools can safely rewrite. */
export function assertTableTab(tab: CustomTab): CustomTabColumn[] {
  if (tab.columns === undefined) {
    throw new CustomTabError(
      `Custom tab "${tab.label}" is a form-based tab created in the admin UI, not a table. ` +
        `Row and column tools don't apply to it.`
    );
  }
  return tab.columns;
}
