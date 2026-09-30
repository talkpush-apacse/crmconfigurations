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

import type {
  CustomData,
  CustomFieldDef,
  CustomFieldType,
  CustomFormFileValue,
  CustomTab,
  CustomTabColumn,
  CustomTabRow,
  FieldCondition,
  RepeaterColumn,
  ValidationGroup,
  ValidationGroupType,
} from "./types";

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
  mode: "table" | "form";
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
  /** Only present for kind "form" — the field ids a caller needs to preserve values across update_custom_tab. */
  fields?: Array<{
    id: string;
    key: string;
    label: string;
    type: string;
    required: boolean;
    helpText?: string;
    placeholder?: string;
    options?: string[];
    min?: number;
    max?: number;
    integerOnly?: boolean;
    allowedExtensions?: string[];
    allowedMimeTypes?: string[];
    maxFileSizeMb?: number;
    multiple?: boolean;
    visibleWhen?: FieldCondition;
    requiredWhen?: FieldCondition;
    columns?: RepeaterColumn[];
    minRows?: number;
    maxRows?: number;
    tableColumns?: string[];
    /** The field's current value from customData, when the caller supplied it (see includeFieldValues). */
    value?: unknown;
  }>;
  validationGroups?: ValidationGroup[];
  templateSource?: CustomTab["templateSource"];
}

export function summarizeTab(
  tab: CustomTab,
  customData?: Record<string, unknown> | null
): CustomTabSummary {
  const columns = tab.columns ?? [];
  const mode = getCustomTabMode(tab);
  const isForm = mode === "form";
  const formValues = isForm ? getCustomTabFormValues(tab, customData) : {};
  return {
    id: tab.id,
    slug: tab.slug,
    url_slug: `custom-${tab.slug}`,
    label: tab.label,
    description: tab.description ?? null,
    icon: tab.icon,
    mode,
    kind: isForm ? "form" : "table",
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
    ...(tab.templateSource ? { templateSource: tab.templateSource } : {}),
    ...(isForm
      ? {
          fields: tab.fields.map((field) => ({
            id: field.id,
            key: getCustomFieldKey(field),
            label: field.label,
            type: field.type,
            required: !!field.required,
            ...(field.helpText ? { helpText: field.helpText } : {}),
            ...(field.placeholder ? { placeholder: field.placeholder } : {}),
            ...(field.options?.length ? { options: field.options } : {}),
            ...(typeof field.min === "number" ? { min: field.min } : {}),
            ...(typeof field.max === "number" ? { max: field.max } : {}),
            ...(field.integerOnly ? { integerOnly: true } : {}),
            ...(field.allowedExtensions?.length ? { allowedExtensions: field.allowedExtensions } : {}),
            ...(field.allowedMimeTypes?.length ? { allowedMimeTypes: field.allowedMimeTypes } : {}),
            ...(field.maxFileSizeMb ? { maxFileSizeMb: field.maxFileSizeMb } : {}),
            ...(field.multiple !== undefined ? { multiple: field.multiple } : {}),
            ...(field.visibleWhen ? { visibleWhen: field.visibleWhen } : {}),
            ...(field.requiredWhen ? { requiredWhen: field.requiredWhen } : {}),
            ...(Array.isArray(field.columns) && field.columns.length > 0 ? { columns: field.columns as RepeaterColumn[] } : {}),
            ...(typeof field.minRows === "number" ? { minRows: field.minRows } : {}),
            ...(typeof field.maxRows === "number" ? { maxRows: field.maxRows } : {}),
            ...(field.tableColumns?.length
              ? { tableColumns: field.tableColumns.map((c) => c.label) }
              : {}),
            ...(getCustomFieldKey(field) in formValues ? { value: formValues[getCustomFieldKey(field)] } : {}),
          })),
          ...(tab.validationGroups?.length ? { validationGroups: tab.validationGroups } : {}),
        }
      : {}),
  };
}

/** A table-based tab is the only kind these tools can safely rewrite. */
export function assertTableTab(tab: CustomTab): CustomTabColumn[] {
  if (getCustomTabMode(tab) !== "table") {
    throw new CustomTabError(
      `Custom tab "${tab.label}" is a document-style tab (fields), not a table. ` +
        `Row and column tools don't apply to it.`
    );
  }
  return tab.columns ?? [];
}

/** A form-based tab is the only kind that has `fields` to rewrite. */
export function assertFormTab(tab: CustomTab): CustomFieldDef[] {
  if (getCustomTabMode(tab) !== "form") {
    throw new CustomTabError(
      `Custom tab "${tab.label}" is a table-based tab (columns/rows). Field tools don't apply to it.`
    );
  }
  return tab.fields;
}

// ---------------------------------------------------------------------------
// Form fields (document-style custom tabs — Main Script, sign-off notes, etc.)
// ---------------------------------------------------------------------------

export const CUSTOM_FIELD_TYPES = [
  "text",
  "textarea",
  "richtext",
  "number",
  "date",
  "select",
  "email",
  "url",
  "checkbox",
  "file",
  "table",
  "repeater",
] as const;

// Compile-time check that the list above stays in sync with CustomFieldType.
const _typeCheck: readonly CustomFieldType[] = CUSTOM_FIELD_TYPES;
void _typeCheck;

/** Field types whose initial value is coerced via the same rules a table cell uses. */
const SHIM_COERCED_TYPES = new Set<CustomFieldType>(["checkbox", "number", "date", "select"]);

export const FORM_FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "date",
  "select",
  "email",
  "url",
  "checkbox",
  "file",
  "repeater",
] as const;

const REPEATER_COLUMN_TYPES = [
  "text",
  "textarea",
  "number",
  "email",
  "url",
  "select",
  "date",
  "checkbox",
] as const;

const CONDITION_OPERATORS = ["equals", "not_equals", "is_empty", "is_not_empty", "contains"] as const;
const VALIDATION_GROUP_TYPES = ["at_least_one", "exactly_one", "all_or_none"] as const;
const EXECUTABLE_EXTENSIONS = new Set(["exe", "bat", "cmd", "com", "scr", "js", "jar", "sh", "ps1", "app", "dmg"]);
const EXECUTABLE_MIME_PREFIXES = ["application/x-msdownload", "application/x-sh", "application/x-msdos-program"];

export interface FieldSpec {
  /**
   * Preserves an existing field's identity (and its customData) across an
   * update — pass a field's current id back to keep it, omit for a new field.
   * `update_custom_tab` is a full replacement, so a field whose id isn't
   * carried over is treated as removed (its customData is orphaned, same as a
   * dropped table column).
   */
  id?: string;
  key?: string;
  label: string;
  type: CustomFieldType;
  required?: boolean;
  helpText?: string;
  placeholder?: string;
  /** Choices — required for type "select". */
  options?: string[];
  min?: number;
  max?: number;
  integerOnly?: boolean;
  allowedExtensions?: string[];
  allowedMimeTypes?: string[];
  maxFileSizeMb?: number;
  multiple?: boolean;
  visibleWhen?: FieldCondition;
  requiredWhen?: FieldCondition;
  columns?: RepeaterColumn[];
  minRows?: number;
  maxRows?: number;
  /** Column definitions — required for type "table". */
  tableColumns?: ColumnSpec[];
  /**
   * Starting value. Shape depends on `type`: a string for
   * text/textarea/richtext/file, a boolean for checkbox, a plain value for
   * number/date/select (coerced the same way a table cell is), or an array of
   * row objects (matching tableColumns' keys) for "table".
   */
  initialValue?: unknown;
}

export interface NormalizedFields {
  fields: CustomFieldDef[];
  /** Keyed by each field's generated id — merge this into the checklist's customData. */
  initialData: Record<string, unknown>;
  warnings: string[];
}

export interface NormalizedValidationGroups {
  validationGroups: ValidationGroup[];
}

export interface NormalizeFieldsOptions {
  /** Generates ids for fields, and for rows inside any "table"-type field. */
  makeId: () => string;
}

interface FieldValueResult {
  value: unknown;
  warning?: string;
  error?: string;
}

function coerceFieldInitialValue(
  type: CustomFieldType,
  tableColumns: CustomTabColumn[] | undefined,
  fieldOptions: string[] | undefined,
  raw: unknown,
  makeId: () => string
): FieldValueResult {
  if (type === "table") {
    if (!Array.isArray(raw)) {
      return { value: [], error: `initialValue for a "table" field must be an array of row objects.` };
    }
    if (!tableColumns) return { value: [] };
    const { rows, warnings } = normalizeRows(tableColumns, raw as Array<Record<string, unknown>>, {
      makeId,
    });
    return { value: rows, warning: warnings[0] };
  }

  if (SHIM_COERCED_TYPES.has(type)) {
    // Reuse the table-cell coercion rules — a scalar form field behaves the
    // same as a scalar table column for checkbox/number/date/select.
    const shim: CustomTabColumn = {
      key: "_value",
      label: "value",
      type: type as CustomTabColumn["type"],
      ...(type === "select" ? { options: fieldOptions ?? [] } : {}),
    };
    return coerceCellValue(shim, raw);
  }

  // text / textarea / richtext / file: stored as plain text, no coercion.
  return { value: raw === null || raw === undefined ? "" : String(raw) };
}

function cleanStringArray(raw: string[] | undefined, transform?: (value: string) => string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw ?? []) {
    const value = transform ? transform(String(entry ?? "").trim()) : String(entry ?? "").trim();
    if (!value) continue;
    const dedupe = value.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push(value);
  }
  return out;
}

function normalizeExtension(value: string): string {
  return value.trim().replace(/^\./, "").toLowerCase();
}

function isSupportedFieldCondition(value: unknown): value is FieldCondition {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const condition = value as FieldCondition;
  return (
    typeof condition.fieldKey === "string" &&
    condition.fieldKey.trim() !== "" &&
    CONDITION_OPERATORS.includes(condition.operator as (typeof CONDITION_OPERATORS)[number])
  );
}

function normalizeCondition(
  condition: FieldCondition | undefined,
  owner: string,
  knownKeys: Set<string>,
  issues: string[]
): FieldCondition | undefined {
  if (!condition) return undefined;
  if (!isSupportedFieldCondition(condition)) {
    issues.push(`${owner}: condition must include fieldKey and one of ${CONDITION_OPERATORS.join(", ")}.`);
    return undefined;
  }

  const fieldKey = normalizeColumnKey(condition.fieldKey);
  if (!knownKeys.has(fieldKey)) {
    issues.push(`${owner}: condition references unknown field "${condition.fieldKey}".`);
    return undefined;
  }
  if ((condition.operator === "equals" || condition.operator === "not_equals" || condition.operator === "contains") &&
      condition.value === undefined) {
    issues.push(`${owner}: operator "${condition.operator}" needs a value.`);
    return undefined;
  }
  return {
    fieldKey,
    operator: condition.operator,
    ...(condition.value !== undefined ? { value: condition.value } : {}),
  };
}

function normalizeRepeaterColumns(
  specs: RepeaterColumn[] | undefined,
  position: string
): RepeaterColumn[] {
  const issues: string[] = [];
  if (!Array.isArray(specs) || specs.length === 0) {
    throw new CustomTabError(`${position}: type "repeater" needs at least one column.`);
  }
  if (specs.length > MAX_CUSTOM_TAB_COLUMNS) {
    throw new CustomTabError(`${position}: a repeater can have at most ${MAX_CUSTOM_TAB_COLUMNS} columns.`);
  }

  const used = new Map<string, string>();
  const columns: RepeaterColumn[] = [];
  specs.forEach((spec, index) => {
    const label = String(spec?.label ?? "").trim();
    const colPos = `${position} column ${index + 1}`;
    if (!label) {
      issues.push(`${colPos}: label is required.`);
      return;
    }
    const type = spec?.type;
    if (!REPEATER_COLUMN_TYPES.includes(type as (typeof REPEATER_COLUMN_TYPES)[number])) {
      issues.push(`${colPos} ("${label}"): type "${String(type)}" is not one of ${REPEATER_COLUMN_TYPES.join(", ")}.`);
      return;
    }
    const key = normalizeColumnKey(spec.key ? spec.key : label);
    if (!key) {
      issues.push(`${colPos} ("${label}"): give it a usable key.`);
      return;
    }
    const clash = used.get(key);
    if (clash) {
      issues.push(`${colPos} ("${label}"): key "${key}" is already used by "${clash}".`);
      return;
    }
    used.set(key, label);
    const options = cleanOptions(spec.options);
    if (type === "select" && options.length === 0) {
      issues.push(`${colPos} ("${label}"): type "select" needs options.`);
      return;
    }
    const column: RepeaterColumn = {
      key,
      label,
      type: type as RepeaterColumn["type"],
      ...(spec.required ? { required: true } : {}),
      ...(optionalText(spec.helpText) ? { helpText: optionalText(spec.helpText) } : {}),
      ...(optionalText(spec.placeholder) ? { placeholder: optionalText(spec.placeholder) } : {}),
      ...(type === "select" ? { options } : {}),
      ...(typeof spec.min === "number" && Number.isFinite(spec.min) ? { min: spec.min } : {}),
      ...(typeof spec.max === "number" && Number.isFinite(spec.max) ? { max: spec.max } : {}),
      ...(spec.integerOnly ? { integerOnly: true } : {}),
    };
    columns.push(column);
  });

  if (issues.length > 0) {
    throw new CustomTabError("The repeater column definitions have problems:", issues);
  }
  return columns;
}

export function normalizeValidationGroups(
  specs: ValidationGroup[] | undefined,
  fields: CustomFieldDef[]
): ValidationGroup[] {
  const issues: string[] = [];
  const groups: ValidationGroup[] = [];
  const fieldKeys = new Set(fields.map((field) => getCustomFieldKey(field)));
  const ids = new Set<string>();

  for (const [index, spec] of (specs ?? []).entries()) {
    const position = `validation group ${index + 1}`;
    const id = normalizeColumnKey(spec?.id ?? "");
    if (!id) {
      issues.push(`${position}: id is required.`);
      continue;
    }
    if (ids.has(id)) {
      issues.push(`${position}: id "${id}" is duplicated.`);
      continue;
    }
    ids.add(id);

    if (!VALIDATION_GROUP_TYPES.includes(spec?.type as ValidationGroupType)) {
      issues.push(`${position} ("${id}"): type must be one of ${VALIDATION_GROUP_TYPES.join(", ")}.`);
      continue;
    }
    const keys = cleanStringArray(spec.fieldKeys, normalizeColumnKey);
    if (keys.length < 2) {
      issues.push(`${position} ("${id}"): fieldKeys needs at least two fields.`);
      continue;
    }
    const unknown = keys.filter((key) => !fieldKeys.has(key));
    if (unknown.length > 0) {
      issues.push(`${position} ("${id}"): unknown field key(s): ${unknown.join(", ")}.`);
      continue;
    }
    const message = String(spec.message ?? "").trim();
    if (!message) {
      issues.push(`${position} ("${id}"): message is required.`);
      continue;
    }
    groups.push({ id, type: spec.type, fieldKeys: keys, message });
  }

  if (issues.length > 0) {
    throw new CustomTabError("The validation groups have problems:", issues);
  }
  return groups;
}

/**
 * Validates a proposed field list (a form-based/document-style tab) and
 * returns it in storage shape, alongside the initial `customData` values those
 * fields should carry — field *values* live in the checklist's top-level
 * customData map keyed by field id, not on the tab itself, so a caller wanting
 * pre-filled content needs both halves written together.
 */
export function normalizeFields(
  specs: FieldSpec[],
  options: NormalizeFieldsOptions
): NormalizedFields {
  const { makeId } = options;
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(specs) || specs.length === 0) {
    throw new CustomTabError("A document-style custom tab needs at least one field.");
  }
  if (specs.length > MAX_CUSTOM_TAB_COLUMNS) {
    throw new CustomTabError(
      `A custom tab can have at most ${MAX_CUSTOM_TAB_COLUMNS} fields (got ${specs.length}).`
    );
  }

  const fields: CustomFieldDef[] = [];
  const initialData: Record<string, unknown> = {};
  const usedKeys = new Map<string, string>();
  const pendingConditions: Array<{
    field: CustomFieldDef;
    spec: FieldSpec;
    position: string;
    label: string;
  }> = [];

  specs.forEach((spec, index) => {
    const position = `field ${index + 1}`;
    const label = String(spec?.label ?? "").trim();
    if (!label) {
      issues.push(`${position}: label is required.`);
      return;
    }

    const type = spec?.type;
    if (!CUSTOM_FIELD_TYPES.includes(type)) {
      issues.push(
        `${position} ("${label}"): type "${String(type)}" is not one of ${CUSTOM_FIELD_TYPES.join(", ")}.`
      );
      return;
    }

    const key = normalizeColumnKey(spec.key ? spec.key : label);
    if (!key) {
      issues.push(`${position} ("${label}"): can't derive a field key — give it an explicit snake_case key.`);
      return;
    }
    const clash = usedKeys.get(key);
    if (clash) {
      issues.push(`${position} ("${label}"): key "${key}" is already used by "${clash}". Keys must be unique.`);
      return;
    }
    usedKeys.set(key, label);

    const cleanedOptions = cleanOptions(spec.options);
    if (type === "select" && cleanedOptions.length === 0) {
      issues.push(`${position} ("${label}"): type "select" needs at least one entry in options.`);
      return;
    }

    let tableColumns: CustomTabColumn[] | undefined;
    if (type === "table") {
      if (!spec.tableColumns || spec.tableColumns.length === 0) {
        issues.push(`${position} ("${label}"): type "table" needs at least one entry in tableColumns.`);
        return;
      }
      try {
        const normalized = normalizeColumns(spec.tableColumns);
        tableColumns = normalized.columns;
        warnings.push(...normalized.warnings.map((w) => `${position} ("${label}"): ${w}`));
      } catch (error) {
        const message = error instanceof CustomTabError ? error.message : String(error);
        issues.push(`${position} ("${label}"): ${message}`);
        return;
      }
    }

    let repeaterColumns: RepeaterColumn[] | undefined;
    if (type === "repeater") {
      try {
        repeaterColumns = normalizeRepeaterColumns(spec.columns, `${position} ("${label}")`);
      } catch (error) {
        const message = error instanceof CustomTabError ? error.message : String(error);
        issues.push(message);
        return;
      }
      if (typeof spec.minRows === "number" && typeof spec.maxRows === "number" && spec.minRows > spec.maxRows) {
        issues.push(`${position} ("${label}"): minRows cannot be greater than maxRows.`);
        return;
      }
    }

    const allowedExtensions = cleanStringArray(spec.allowedExtensions, normalizeExtension);
    const allowedMimeTypes = cleanStringArray(spec.allowedMimeTypes, (value) => value.toLowerCase());
    const blockedExt = allowedExtensions.find((ext) => EXECUTABLE_EXTENSIONS.has(ext));
    if (blockedExt) {
      issues.push(`${position} ("${label}"): executable extension ".${blockedExt}" is not allowed.`);
      return;
    }
    const blockedMime = allowedMimeTypes.find((mime) => EXECUTABLE_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix)));
    if (blockedMime) {
      issues.push(`${position} ("${label}"): executable MIME type "${blockedMime}" is not allowed.`);
      return;
    }
    if (typeof spec.min === "number" && typeof spec.max === "number" && spec.min > spec.max) {
      issues.push(`${position} ("${label}"): min cannot be greater than max.`);
      return;
    }

    const id = optionalText(spec.id) ?? makeId();
    const field: CustomFieldDef = {
      id,
      key,
      label,
      type,
      required: !!spec.required,
    };
    const helpText = optionalText(spec.helpText);
    if (helpText) field.helpText = helpText;
    const placeholder = optionalText(spec.placeholder);
    if (placeholder) field.placeholder = placeholder;
    if (type === "select") field.options = cleanedOptions;
    if (tableColumns) field.tableColumns = tableColumns;
    if (repeaterColumns) field.columns = repeaterColumns;
    if (typeof spec.min === "number" && Number.isFinite(spec.min)) field.min = spec.min;
    if (typeof spec.max === "number" && Number.isFinite(spec.max)) field.max = spec.max;
    if (spec.integerOnly) field.integerOnly = true;
    if (allowedExtensions.length > 0) field.allowedExtensions = allowedExtensions;
    if (allowedMimeTypes.length > 0) field.allowedMimeTypes = allowedMimeTypes;
    if (typeof spec.maxFileSizeMb === "number" && Number.isFinite(spec.maxFileSizeMb) && spec.maxFileSizeMb > 0) {
      field.maxFileSizeMb = spec.maxFileSizeMb;
    }
    if (spec.multiple !== undefined) field.multiple = !!spec.multiple;
    if (typeof spec.minRows === "number" && Number.isFinite(spec.minRows)) field.minRows = Math.max(0, Math.floor(spec.minRows));
    if (typeof spec.maxRows === "number" && Number.isFinite(spec.maxRows)) field.maxRows = Math.max(0, Math.floor(spec.maxRows));

    if (spec.initialValue !== undefined) {
      const coerced = coerceFieldInitialValue(type, tableColumns, cleanedOptions, spec.initialValue, makeId);
      if (coerced.error) {
        issues.push(`${position} ("${label}"): ${coerced.error}`);
        return;
      }
      if (coerced.warning) warnings.push(`${position} ("${label}"): ${coerced.warning}`);
      initialData[key] = coerced.value;
    }

    fields.push(field);
    pendingConditions.push({ field, spec, position, label });
  });

  if (issues.length === 0) {
    const knownKeys = new Set(fields.map((field) => getCustomFieldKey(field)));
    for (const pending of pendingConditions) {
      const visibleWhen = normalizeCondition(
        pending.spec.visibleWhen,
        `${pending.position} ("${pending.label}") visibleWhen`,
        knownKeys,
        issues
      );
      const requiredWhen = normalizeCondition(
        pending.spec.requiredWhen,
        `${pending.position} ("${pending.label}") requiredWhen`,
        knownKeys,
        issues
      );
      if (visibleWhen) pending.field.visibleWhen = visibleWhen;
      if (requiredWhen) pending.field.requiredWhen = requiredWhen;
    }
  }

  if (issues.length > 0) {
    throw new CustomTabError("The field definitions have problems:", issues);
  }

  return { fields, initialData, warnings };
}

/** One line per field, for confirming the shape before writing it. */
export function describeFields(fields: CustomFieldDef[]): string {
  return fields
    .map((field) => {
      const bits: string[] = [field.type];
      if (field.required) bits.push("required");
      if (field.options?.length) bits.push(`options: ${field.options.join(" / ")}`);
      if (field.helpText) bits.push(`help: ${field.helpText}`);
      if (field.placeholder) bits.push(`placeholder: ${field.placeholder}`);
      if (typeof field.min === "number") bits.push(`min: ${field.min}`);
      if (typeof field.max === "number") bits.push(`max: ${field.max}`);
      if (field.integerOnly) bits.push("integer only");
      if (field.allowedExtensions?.length) bits.push(`extensions: ${field.allowedExtensions.join(", ")}`);
      if (field.allowedMimeTypes?.length) bits.push(`mime types: ${field.allowedMimeTypes.join(", ")}`);
      if (field.maxFileSizeMb) bits.push(`max file size: ${field.maxFileSizeMb} MB`);
      if (field.visibleWhen) bits.push(`visible when ${field.visibleWhen.fieldKey} ${field.visibleWhen.operator} ${field.visibleWhen.value ?? ""}`.trim());
      if (field.requiredWhen) bits.push(`required when ${field.requiredWhen.fieldKey} ${field.requiredWhen.operator} ${field.requiredWhen.value ?? ""}`.trim());
      if (field.tableColumns?.length) bits.push(`table columns: ${field.tableColumns.map((c) => c.label).join(", ")}`);
      if (Array.isArray(field.columns) && field.columns.length > 0) bits.push(`repeater columns: ${(field.columns as RepeaterColumn[]).map((c) => c.label).join(", ")}`);
      return `- ${field.label} (\`${getCustomFieldKey(field)}\`) — ${bits.join("; ")}`;
    })
    .join("\n");
}

export function getCustomTabMode(tab: CustomTab): "table" | "form" {
  if (tab.mode === "form" || tab.mode === "table") return tab.mode;
  return tab.columns !== undefined ? "table" : "form";
}

export function getCustomFieldKey(field: CustomFieldDef): string {
  return field.key || field.id;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getCustomTabFormValues(
  tab: CustomTab,
  customData: CustomData | null | undefined
): Record<string, unknown> {
  const data = (customData ?? {}) as Record<string, unknown>;
  const container = data[tab.id];
  const nestedValues =
    isRecord(container) && isRecord(container.values)
      ? (container.values as Record<string, unknown>)
      : {};
  const values: Record<string, unknown> = { ...nestedValues };

  for (const field of tab.fields ?? []) {
    const key = getCustomFieldKey(field);
    if (values[key] !== undefined) continue;
    if (data[key] !== undefined) values[key] = data[key];
    else if (data[field.id] !== undefined) values[key] = data[field.id];
  }
  return values;
}

export function buildCustomTabFormDataPatch(
  tab: CustomTab,
  values: Record<string, unknown>
): Record<string, unknown> {
  return {
    [tab.id]: {
      values,
      updatedAt: new Date().toISOString(),
    },
  };
}

function valueIsEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "boolean") return value === false;
  if (Array.isArray(value)) return value.length === 0;
  if (isRecord(value)) {
    if (typeof value.url === "string" && value.url.trim()) return false;
    return Object.keys(value).length === 0;
  }
  return false;
}

function conditionMatches(condition: FieldCondition | undefined, values: Record<string, unknown>): boolean {
  if (!condition) return true;
  const actual = values[condition.fieldKey];
  const expected = condition.value;

  switch (condition.operator) {
    case "equals":
      return String(actual ?? "") === String(expected ?? "");
    case "not_equals":
      return String(actual ?? "") !== String(expected ?? "");
    case "is_empty":
      return valueIsEmpty(actual);
    case "is_not_empty":
      return !valueIsEmpty(actual);
    case "contains":
      if (Array.isArray(actual)) return actual.some((item) => String(item) === String(expected ?? ""));
      return String(actual ?? "").includes(String(expected ?? ""));
  }
}

export function isCustomFieldVisible(field: CustomFieldDef, values: Record<string, unknown>): boolean {
  return conditionMatches(field.visibleWhen, values);
}

export function isCustomFieldRequired(field: CustomFieldDef, values: Record<string, unknown>): boolean {
  if (!isCustomFieldVisible(field, values)) return false;
  return !!field.required || (!!field.requiredWhen && conditionMatches(field.requiredWhen, values));
}

function fileValues(value: unknown): CustomFormFileValue[] {
  if (Array.isArray(value)) return value.filter(isRecord).map((v) => v as unknown as CustomFormFileValue);
  if (isRecord(value)) return [value as unknown as CustomFormFileValue];
  return [];
}

export function validateFileValue(field: CustomFieldDef, value: unknown): string[] {
  const errors: string[] = [];
  const files = fileValues(value);
  if (!field.multiple && files.length > 1) {
    errors.push(`${field.label}: only one file is allowed.`);
  }
  for (const file of files) {
    const fileName = String(file.fileName ?? "");
    const extension = normalizeExtension(fileName.split(".").pop() ?? "");
    const mimeType = String(file.mimeType ?? "").toLowerCase();
    const size = typeof file.size === "number" ? file.size : null;
    if (EXECUTABLE_EXTENSIONS.has(extension) || EXECUTABLE_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) {
      errors.push(`${field.label}: executable files are not allowed.`);
    }
    if (field.allowedExtensions?.length && !field.allowedExtensions.includes(extension)) {
      errors.push(`${field.label}: "${fileName}" must use one of these extensions: ${field.allowedExtensions.join(", ")}.`);
    }
    if (field.allowedMimeTypes?.length && (!mimeType || !field.allowedMimeTypes.includes(mimeType))) {
      errors.push(`${field.label}: "${fileName}" must use one of these MIME types: ${field.allowedMimeTypes.join(", ")}.`);
    }
    if (field.maxFileSizeMb && size !== null && size > field.maxFileSizeMb * 1024 * 1024) {
      errors.push(`${field.label}: "${fileName}" is larger than ${field.maxFileSizeMb} MB.`);
    }
  }
  return errors;
}

function validateScalarValue(
  label: string,
  type: CustomFieldType | RepeaterColumn["type"],
  value: unknown,
  config: {
    options?: string[];
    min?: number;
    max?: number;
    integerOnly?: boolean;
  } = {}
): string[] {
  if (valueIsEmpty(value)) return [];
  const errors: string[] = [];
  const text = String(value ?? "").trim();
  if (type === "email" && !EMAIL_SHAPE.test(text)) {
    errors.push(`${label}: enter a valid email address.`);
  }
  if (type === "url" && !/^https?:\/\/\S+$/i.test(text)) {
    errors.push(`${label}: enter a URL starting with http:// or https://.`);
  }
  if (type === "select" && config.options?.length && !config.options.includes(text)) {
    errors.push(`${label}: choose one of ${config.options.join(", ")}.`);
  }
  if (type === "number") {
    const number = typeof value === "number" ? value : Number(text);
    if (!Number.isFinite(number)) {
      errors.push(`${label}: enter a number.`);
    } else {
      if (config.integerOnly && !Number.isInteger(number)) errors.push(`${label}: enter a whole number.`);
      if (typeof config.min === "number" && number < config.min) errors.push(`${label}: must be at least ${config.min}.`);
      if (typeof config.max === "number" && number > config.max) errors.push(`${label}: must be at most ${config.max}.`);
    }
  }
  return errors;
}

function validateRepeaterRows(
  field: CustomFieldDef,
  value: unknown,
  options: { enforceRequired?: boolean } = {}
): string[] {
  const { enforceRequired = true } = options;
  const rows = Array.isArray(value) ? value : [];
  const columns = Array.isArray(field.columns) ? (field.columns as RepeaterColumn[]) : [];
  const errors: string[] = [];
  if (enforceRequired && typeof field.minRows === "number" && rows.length < field.minRows) {
    errors.push(`${field.label}: add at least ${field.minRows} row(s).`);
  }
  if (typeof field.maxRows === "number" && rows.length > field.maxRows) {
    errors.push(`${field.label}: use at most ${field.maxRows} row(s).`);
  }
  rows.forEach((row, rowIndex) => {
    const record = isRecord(row) ? row : {};
    for (const column of columns) {
      const value = record[column.key];
      const label = `${field.label} row ${rowIndex + 1} ${column.label}`;
      if (enforceRequired && column.required && valueIsEmpty(value)) {
        errors.push(`${label}: required.`);
        continue;
      }
      errors.push(...validateScalarValue(label, column.type, value, column));
    }
  });
  return errors;
}

export function validateCustomFormValues(
  tab: CustomTab,
  values: Record<string, unknown>,
  options: { enforceRequired?: boolean; enforceValidationGroups?: boolean } = {}
): { valid: boolean; errors: Record<string, string[]> } {
  const { enforceRequired = true, enforceValidationGroups = true } = options;
  const errors: Record<string, string[]> = {};

  for (const field of tab.fields ?? []) {
    const key = getCustomFieldKey(field);
    if (!isCustomFieldVisible(field, values)) continue;
    const value = values[key];
    const fieldErrors: string[] = [];
    if (enforceRequired && isCustomFieldRequired(field, values) && valueIsEmpty(value)) {
      fieldErrors.push(`${field.label}: required.`);
    }
    if (field.type === "file") fieldErrors.push(...validateFileValue(field, value));
    else if (field.type === "repeater") fieldErrors.push(...validateRepeaterRows(field, value, { enforceRequired }));
    else fieldErrors.push(...validateScalarValue(field.label, field.type, value, field));
    if (fieldErrors.length > 0) errors[key] = fieldErrors;
  }

  if (enforceValidationGroups) {
    for (const group of tab.validationGroups ?? []) {
      const populated = group.fieldKeys.filter((key) => !valueIsEmpty(values[key]));
      let failed = false;
      if (group.type === "at_least_one") failed = populated.length < 1;
      if (group.type === "exactly_one") failed = populated.length !== 1;
      if (group.type === "all_or_none") failed = populated.length > 0 && populated.length !== group.fieldKeys.length;
      if (failed) errors[`validationGroup:${group.id}`] = [group.message];
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateCustomTabsData(
  tabs: CustomTab[] | null | undefined,
  customData: CustomData | null | undefined,
  options: { enforceRequired?: boolean; enforceValidationGroups?: boolean } = {}
): string[] {
  const errors: string[] = [];
  for (const tab of tabs ?? []) {
    if (getCustomTabMode(tab) !== "form") continue;
    const values = getCustomTabFormValues(tab, customData);
    const validation = validateCustomFormValues(tab, values, options);
    if (!validation.valid) {
      for (const messages of Object.values(validation.errors)) {
        errors.push(...messages.map((message) => `${tab.label}: ${message}`));
      }
    }
  }
  return errors;
}
