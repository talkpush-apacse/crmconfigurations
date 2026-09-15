import type { CustomTab, CustomTabColumn, ColumnDef } from "./types";

/** Map CustomTabColumn.type → ColumnDef.type + optional validation. */
export function mapColumnType(
  type: CustomTabColumn["type"]
): Pick<ColumnDef, "type" | "validation"> {
  switch (type) {
    case "textarea":
      return { type: "textarea" };
    case "checkbox":
      return { type: "boolean" };
    case "select":
      return { type: "dropdown" };
    case "multiselect":
      return { type: "multiselect" };
    case "email":
      return { type: "text", validation: "email" };
    case "url":
      return { type: "text", validation: "url" };
    case "text":
    case "number":
    case "date":
    default:
      return { type: "text" };
  }
}

/** Build EditableTable ColumnDefs from typed CustomTabColumn definitions. */
export function buildColumnDefs(columns: CustomTabColumn[]): ColumnDef[] {
  return columns.map((col) => {
    const mapped = mapColumnType(col.type);
    return {
      key: col.key,
      label: col.label,
      // Help text rides along as the column-header tooltip — a custom tab has no
      // hand-written intro copy to lean on, so the instruction for a column has
      // to live on the column itself. Column examples are surfaced through the
      // pinned sample row below, which is what the grid actually renders.
      description: col.description,
      type: mapped.type,
      validation: mapped.validation,
      required: col.required,
      options: col.options,
      width: col.width,
    };
  });
}

/** Default cell value for a new row, per column type — checkbox columns start unchecked. */
export function defaultCellValue(type: CustomTabColumn["type"]): string | boolean {
  return type === "checkbox" ? false : "";
}

// Re-exported for call sites that only had CustomTab["columns"] in scope before this helper existed.
export type CustomTabColumns = NonNullable<CustomTab["columns"]>;

const VALID_COLUMN_TYPES = new Set<CustomTabColumn["type"]>([
  "text",
  "textarea",
  "number",
  "date",
  "select",
  "multiselect",
  "email",
  "url",
  "checkbox",
]);

function slugifyColumnKey(label: string, index: number): string {
  const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return key || `col_${index}`;
}

/**
 * Parses the admin UI's compact "table" field column input: a comma-separated
 * list of column headers, each optionally suffixed with `:type` (one of
 * CustomTabColumn's types), e.g. `"Setting, Value, Approved?:checkbox"`. A bare
 * header (no colon) defaults to plain text — unchanged from the original
 * comma-separated-headers behavior. Returns the legacy `columns: string[]`
 * shape when every entry is a bare label, or `tableColumns` as soon as any
 * entry declares a type. `select`/`multiselect` columns get no options from
 * this compact syntax — edit the column afterward if options are needed.
 */
export function parseTableColumnsInput(
  input: string
): { columns?: string[]; tableColumns?: CustomTabColumn[] } {
  const entries = input.split(",").map((s) => s.trim()).filter(Boolean);
  if (entries.length === 0) return {};

  const hasAnyType = entries.some((e) => e.includes(":"));
  if (!hasAnyType) {
    return { columns: entries };
  }

  const tableColumns: CustomTabColumn[] = entries.map((entry, i) => {
    const [labelPart, typePart] = entry.split(":").map((s) => s.trim());
    const label = labelPart || `Column ${i + 1}`;
    const type = VALID_COLUMN_TYPES.has(typePart as CustomTabColumn["type"])
      ? (typePart as CustomTabColumn["type"])
      : "text";
    return { key: slugifyColumnKey(label, i), label, type };
  });
  return { tableColumns };
}

/** Reconstructs the compact column-input string for editing an existing table field. */
export function formatTableColumnsInput(field: {
  columns?: string[];
  tableColumns?: CustomTabColumn[];
}): string {
  if (field.tableColumns && field.tableColumns.length > 0) {
    return field.tableColumns
      .map((c) => (c.type === "text" ? c.label : `${c.label}:${c.type}`))
      .join(", ");
  }
  return field.columns?.join(", ") ?? "";
}
