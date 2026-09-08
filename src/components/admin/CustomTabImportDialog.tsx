"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Info,
  Loader2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { customTabSlugConflict, customTabSlugFromLabel } from "@/lib/tab-config";
import { defaultWidthForType } from "@/lib/spreadsheet-infer";
import type { CustomTab, CustomTabColumn, CustomTabRow } from "@/lib/types";
import type { ColumnType, SpreadsheetProposal } from "@/lib/spreadsheet-infer";

const COLUMN_TYPE_OPTIONS: { value: ColumnType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown (one)" },
  { value: "multiselect", label: "Dropdown (many)" },
  { value: "checkbox", label: "Yes / No" },
  { value: "email", label: "Email" },
  { value: "url", label: "Link" },
];

type ColumnSource = SpreadsheetProposal["columns"][number]["source"];

const SOURCE_LABEL: Record<ColumnSource, string> = {
  declared: "From header",
  validation: "From Excel dropdown",
  inferred: "Detected",
};

/** A column as the reviewer is editing it, before the tab is created. */
interface DraftColumn {
  key: string;
  label: string;
  type: ColumnType;
  required: boolean;
  /** Comma-separated while editing; split on create. */
  optionsText: string;
  source: ColumnSource;
  confidence: "high" | "low";
  include: boolean;
}

/** One worksheet, as a candidate tab. */
interface DraftSheet {
  sheetName: string;
  include: boolean;
  tabName: string;
  importRows: boolean;
  expanded: boolean;
  columns: DraftColumn[];
  rows: Record<string, unknown>[];
  warnings: string[];
  totalRowsInFile: number;
  truncated: boolean;
}

interface InferResponse {
  sheets: SpreadsheetProposal[];
  skipped: Array<{ name: string; reason: string }>;
}

function needsOptions(type: ColumnType): boolean {
  return type === "select" || type === "multiselect";
}

function toDraftSheets(sheets: SpreadsheetProposal[]): DraftSheet[] {
  return sheets.map((sheet, index) => ({
    sheetName: sheet.sheetName,
    // Everything is included by default — the point is to stop losing sheets.
    include: true,
    tabName: sheet.sheetName === "CSV" ? "" : sheet.sheetName,
    importRows: true,
    // Only the first is open, so a five-sheet workbook isn't a wall of tables.
    expanded: index === 0,
    rows: sheet.rows,
    warnings: sheet.warnings,
    totalRowsInFile: sheet.totalRowsInFile,
    truncated: sheet.truncated,
    columns: sheet.columns.map((col) => ({
      key: col.key,
      label: col.label,
      type: col.type,
      required: col.required,
      optionsText: (col.options ?? []).join(", "),
      source: col.source,
      confidence: col.confidence,
      include: true,
    })),
  }));
}

interface CustomTabImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Checklist whose custom tabs are being extended. */
  checklistId: string;
  /** Existing tabs, for the slug collision check. */
  existingTabs: CustomTab[];
  onCreate: (tabs: CustomTab[]) => void;
}

export function CustomTabImportDialog({
  open,
  onOpenChange,
  checklistId,
  existingTabs,
  onCreate,
}: CustomTabImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheets, setSheets] = useState<DraftSheet[] | null>(null);
  const [skipped, setSkipped] = useState<Array<{ name: string; reason: string }>>([]);

  const reset = useCallback(() => {
    setFileName(null);
    setLoading(false);
    setError(null);
    setSheets(null);
    setSkipped([]);
  }, []);

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  /** Uploads the file for parsing. Nothing is saved until Create. */
  const analyze = useCallback(
    async (selected: File) => {
      setLoading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("file", selected);

        const res = await fetch(
          `/api/checklists/${checklistId}/custom-tabs/infer`,
          { method: "POST", body: formData }
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Could not read that file");

        const next = body as InferResponse;
        setSheets(toDraftSheets(next.sheets));
        setSkipped(next.skipped ?? []);
        setFileName(selected.name);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not read that file");
        setSheets(null);
        setSkipped([]);
      } finally {
        setLoading(false);
      }
    },
    [checklistId]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (selected) analyze(selected);
  };

  const patchSheet = (index: number, patch: Partial<DraftSheet>) => {
    setSheets((prev) =>
      prev
        ? prev.map((sheet, i) => (i === index ? { ...sheet, ...patch } : sheet))
        : prev
    );
  };

  const patchColumn = (
    sheetIndex: number,
    colIndex: number,
    patch: Partial<DraftColumn>
  ) => {
    setSheets((prev) =>
      prev
        ? prev.map((sheet, i) =>
            i === sheetIndex
              ? {
                  ...sheet,
                  columns: sheet.columns.map((col, j) =>
                    j === colIndex ? { ...col, ...patch } : col
                  ),
                }
              : sheet
          )
        : prev
    );
  };

  const included = useMemo(
    () => (sheets ?? []).filter((s) => s.include),
    [sheets]
  );

  /**
   * Per-sheet blocking problems. Slugs are checked against the existing tabs
   * AND against the other sheets in this same import, since several tabs are
   * created in one go.
   */
  const problems = useMemo(() => {
    const map = new Map<string, string>();
    if (!sheets) return map;

    const slugCounts = new Map<string, number>();
    for (const sheet of sheets) {
      if (!sheet.include) continue;
      const slug = customTabSlugFromLabel(sheet.tabName);
      if (slug) slugCounts.set(slug, (slugCounts.get(slug) ?? 0) + 1);
    }

    for (const sheet of sheets) {
      if (!sheet.include) continue;
      const slug = customTabSlugFromLabel(sheet.tabName);

      if (!sheet.tabName.trim()) {
        map.set(sheet.sheetName, "Give this tab a name.");
        continue;
      }
      const conflict = customTabSlugConflict(slug, existingTabs);
      if (conflict) {
        map.set(sheet.sheetName, conflict);
        continue;
      }
      if ((slugCounts.get(slug) ?? 0) > 1) {
        map.set(
          sheet.sheetName,
          "Two sheets in this import would create the same tab name."
        );
        continue;
      }
      const missing = sheet.columns.filter(
        (c) => c.include && needsOptions(c.type) && c.optionsText.trim() === ""
      );
      if (missing.length > 0) {
        map.set(
          sheet.sheetName,
          `Add choices for: ${missing.map((c) => c.label || c.key).join(", ")}`
        );
        continue;
      }
      if (!sheet.columns.some((c) => c.include)) {
        map.set(sheet.sheetName, "Include at least one column.");
      }
    }
    return map;
  }, [sheets, existingTabs]);

  const canCreate =
    !!sheets && included.length > 0 && problems.size === 0 && !loading;

  const handleCreate = () => {
    if (!sheets || !canCreate) return;

    const created: CustomTab[] = included.map((sheet, order) => {
      const tabColumns: CustomTabColumn[] = sheet.columns
        .filter((c) => c.include)
        .map((col) => {
          const options = needsOptions(col.type)
            ? col.optionsText.split(",").map((o) => o.trim()).filter(Boolean)
            : undefined;
          return {
            key: col.key,
            label: col.label.trim() || col.key,
            type: col.type,
            required: col.required,
            width: defaultWidthForType(col.type),
            ...(options && options.length > 0 ? { options } : {}),
          };
        });

      // Row values were shaped for the types the server detected. Anything the
      // reviewer re-typed is re-shaped so the stored cell matches its editor.
      const tabRows: CustomTabRow[] = sheet.importRows
        ? sheet.rows.map((row) => {
            const next: CustomTabRow = { id: crypto.randomUUID() };
            for (const col of tabColumns) {
              next[col.key] = reshapeValue(row[col.key], col);
            }
            return next;
          })
        : [];

      return {
        id: `ct_${crypto.randomUUID()}`,
        slug: customTabSlugFromLabel(sheet.tabName),
        label: sheet.tabName.trim(),
        icon: "Table",
        fields: [], // table-based tab
        columns: tabColumns,
        rows: tabRows,
        uploadedFile: null,
        sortOrder: existingTabs.length + order,
        createdAt: new Date().toISOString(),
      };
    });

    onCreate(created);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[88vh] w-full max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {sheets ? "Review Worksheets" : "Import Tabs from Spreadsheet"}
          </DialogTitle>
        </DialogHeader>

        {/* ---------- Step 1: pick a file ---------- */}
        {!sheets && (
          <div className="space-y-4">
            <div className="rounded-lg border border-dashed bg-slate-50 p-6 text-center">
              <FileSpreadsheet className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium text-gray-800">
                Upload a CSV or Excel file
              </p>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                Every worksheet becomes its own tab. The first row of each sheet
                is read as its column headers, and each column&apos;s input type is
                detected from its values — you can correct anything on the next
                step before the tabs are created.
              </p>
              <Button
                variant="outline"
                className="mt-4 gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {loading ? "Reading…" : "Choose File"}
              </Button>
            </div>

            <div className="rounded-lg border bg-white p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                <Info className="h-3.5 w-3.5" />
                Optional: state the type in the header
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                To skip detection entirely, name a header like{" "}
                <code className="rounded bg-slate-100 px-1 font-mono">
                  Status [select: New, In Review, Hired]
                </code>
                ,{" "}
                <code className="rounded bg-slate-100 px-1 font-mono">
                  Skills [multiselect: Voice | Chat]
                </code>{" "}
                or{" "}
                <code className="rounded bg-slate-100 px-1 font-mono">
                  Start Date [date]
                </code>
                . End a header with{" "}
                <code className="rounded bg-slate-100 px-1 font-mono">*</code> to mark
                it required. Real Excel dropdowns are picked up automatically.
              </p>
            </div>

            {error && (
              <p className="flex items-start gap-1.5 text-sm text-red-600">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            )}
          </div>
        )}

        {/* ---------- Step 2: review each worksheet ---------- */}
        {sheets && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-gray-800">{fileName}</span> —{" "}
                {sheets.length} worksheet{sheets.length !== 1 ? "s" : ""} found,{" "}
                {included.length} selected
              </p>
            </div>

            {skipped.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium text-gray-700">
                  Skipped {skipped.length} worksheet
                  {skipped.length !== 1 ? "s" : ""}
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {skipped.map((s) => (
                    <li key={s.name} className="text-xs text-muted-foreground">
                      <span className="font-medium">{s.name}</span> — {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-3">
              {sheets.map((sheet, sheetIndex) => {
                const problem = problems.get(sheet.sheetName);
                const includedCols = sheet.columns.filter((c) => c.include);
                return (
                  <div
                    key={sheet.sheetName}
                    className={cn(
                      "rounded-lg border",
                      sheet.include ? "bg-white" : "bg-slate-50/70",
                      problem && "border-red-300"
                    )}
                  >
                    {/* Sheet summary row */}
                    <div className="flex flex-wrap items-center gap-3 p-3">
                      <Checkbox
                        checked={sheet.include}
                        onCheckedChange={(checked) =>
                          patchSheet(sheetIndex, { include: checked === true })
                        }
                        aria-label={`Import ${sheet.sheetName}`}
                      />

                      <button
                        type="button"
                        onClick={() =>
                          patchSheet(sheetIndex, { expanded: !sheet.expanded })
                        }
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        aria-label={sheet.expanded ? "Hide columns" : "Show columns"}
                      >
                        {sheet.expanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>

                      <Badge variant="outline" className="shrink-0 text-xs">
                        {sheet.sheetName}
                      </Badge>

                      <div className="min-w-[200px] flex-1">
                        <Input
                          value={sheet.tabName}
                          onChange={(e) =>
                            patchSheet(sheetIndex, { tabName: e.target.value })
                          }
                          placeholder="Tab name"
                          className="h-8 text-sm"
                          disabled={!sheet.include}
                          aria-invalid={!!problem}
                          aria-label={`Tab name for ${sheet.sheetName}`}
                        />
                      </div>

                      <span className="shrink-0 text-xs text-muted-foreground">
                        {includedCols.length} column
                        {includedCols.length !== 1 ? "s" : ""} ·{" "}
                        {sheet.rows.length} row{sheet.rows.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {problem && (
                      <p className="px-3 pb-2 text-xs text-red-600">{problem}</p>
                    )}

                    {sheet.include && sheet.tabName.trim() && !problem && (
                      <p className="px-3 pb-2 text-xs text-muted-foreground">
                        Slug:{" "}
                        <span className="font-mono">
                          custom-{customTabSlugFromLabel(sheet.tabName)}
                        </span>
                      </p>
                    )}

                    {/* Column review */}
                    {sheet.expanded && (
                      <div className="space-y-3 border-t p-3">
                        {sheet.warnings.length > 0 && (
                          <div className="rounded-md border border-amber-200 bg-amber-50 p-2">
                            <ul className="list-disc space-y-0.5 pl-4">
                              {sheet.warnings.map((w, i) => (
                                <li key={i} className="text-xs text-amber-800">
                                  {w}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="overflow-x-auto rounded-md border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-100 text-left text-xs uppercase tracking-wide text-gray-600">
                                <th className="w-10 p-2" />
                                <th className="p-2 font-semibold">Column</th>
                                <th className="p-2 font-semibold">Type</th>
                                <th className="p-2 font-semibold">Options</th>
                                <th className="w-20 p-2 text-center font-semibold">
                                  Required
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {sheet.columns.map((col, colIndex) => (
                                <tr
                                  key={col.key}
                                  className={
                                    col.include ? "bg-white" : "bg-slate-50/70 opacity-60"
                                  }
                                >
                                  <td className="p-2 text-center">
                                    <Checkbox
                                      checked={col.include}
                                      onCheckedChange={(checked) =>
                                        patchColumn(sheetIndex, colIndex, {
                                          include: checked === true,
                                        })
                                      }
                                      aria-label={`Include ${col.label}`}
                                    />
                                  </td>
                                  <td className="p-2">
                                    <Input
                                      value={col.label}
                                      onChange={(e) =>
                                        patchColumn(sheetIndex, colIndex, {
                                          label: e.target.value,
                                        })
                                      }
                                      className="h-8 text-sm"
                                      disabled={!col.include}
                                    />
                                    <div className="mt-1 flex items-center gap-1.5">
                                      <Badge
                                        variant="outline"
                                        className={
                                          col.confidence === "low"
                                            ? "border-amber-300 text-[10px] text-amber-700"
                                            : "text-[10px]"
                                        }
                                      >
                                        {SOURCE_LABEL[col.source]}
                                      </Badge>
                                      <span className="font-mono text-[10px] text-muted-foreground">
                                        {col.key}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="p-2">
                                    <Select
                                      value={col.type}
                                      onValueChange={(v) =>
                                        patchColumn(sheetIndex, colIndex, {
                                          type: v as ColumnType,
                                        })
                                      }
                                      disabled={!col.include}
                                    >
                                      <SelectTrigger className="h-8 w-[150px] text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {COLUMN_TYPE_OPTIONS.map((opt) => (
                                          <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </td>
                                  <td className="p-2">
                                    {needsOptions(col.type) ? (
                                      <Input
                                        value={col.optionsText}
                                        onChange={(e) =>
                                          patchColumn(sheetIndex, colIndex, {
                                            optionsText: e.target.value,
                                          })
                                        }
                                        placeholder="Comma-separated choices"
                                        className="h-8 min-w-[180px] text-sm"
                                        disabled={!col.include}
                                        aria-invalid={
                                          col.include && col.optionsText.trim() === ""
                                        }
                                      />
                                    ) : (
                                      <span className="text-xs text-muted-foreground">
                                        —
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2 text-center">
                                    <Checkbox
                                      checked={col.required}
                                      onCheckedChange={(checked) =>
                                        patchColumn(sheetIndex, colIndex, {
                                          required: checked === true,
                                        })
                                      }
                                      disabled={!col.include}
                                      aria-label={`${col.label} required`}
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Data preview */}
                        {sheet.rows.length > 0 && (
                          <>
                            <div className="overflow-x-auto rounded-md border">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-slate-100 text-left">
                                    {includedCols.map((col) => (
                                      <th
                                        key={col.key}
                                        className="whitespace-nowrap p-2 font-semibold text-gray-600"
                                      >
                                        {col.label || col.key}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {sheet.rows.slice(0, 3).map((row, i) => (
                                    <tr key={i} className="bg-white">
                                      {includedCols.map((col) => (
                                        <td
                                          key={col.key}
                                          className="max-w-[200px] truncate p-2 text-gray-700"
                                        >
                                          {formatPreviewValue(row[col.key])}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            <label className="flex cursor-pointer items-center gap-2">
                              <Checkbox
                                checked={sheet.importRows}
                                onCheckedChange={(checked) =>
                                  patchSheet(sheetIndex, {
                                    importRows: checked === true,
                                  })
                                }
                                disabled={!sheet.include}
                              />
                              <span className="text-xs text-gray-700">
                                Import these {sheet.rows.length} row
                                {sheet.rows.length !== 1 ? "s" : ""} as starting data
                              </span>
                            </label>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {error && (
              <p className="flex items-start gap-1.5 text-sm text-red-600">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" onClick={reset} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                Choose a different file
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleClose(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!canCreate}>
                  {included.length > 1
                    ? `Create ${included.length} Tabs`
                    : "Create Tab"}
                </Button>
              </div>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xlsm"
          className="hidden"
          onChange={handleFileChange}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Re-shapes a parsed value for the type the reviewer settled on, which may
 * differ from what the server detected.
 */
function reshapeValue(value: unknown, column: CustomTabColumn): string | boolean {
  if (column.type === "checkbox") {
    if (typeof value === "boolean") return value;
    const v = String(value ?? "").trim().toLowerCase();
    return v === "yes" || v === "y" || v === "true" || v === "1" || v === "x" || v === "✓";
  }

  const text = typeof value === "boolean" ? (value ? "Yes" : "") : String(value ?? "");

  if (column.type === "multiselect") {
    if (!text.trim()) return "";
    const delimiter = [";", "|", ","].find((d) => text.includes(d)) ?? ",";
    const tokens = text.split(delimiter).map((t) => t.trim()).filter(Boolean);
    const canonical = tokens.map(
      (token) =>
        column.options?.find((o) => o.toLowerCase() === token.toLowerCase()) ?? token
    );
    return Array.from(new Set(canonical)).join(", ");
  }

  return text;
}

function formatPreviewValue(value: unknown): string {
  if (value === true) return "Yes";
  if (value === false) return "—";
  const text = String(value ?? "").trim();
  return text || "—";
}
