"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  FileSpreadsheet,
  Info,
  Loader2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { customTabSlugConflict, customTabSlugFromLabel } from "@/lib/tab-config";
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

const SOURCE_LABEL: Record<SpreadsheetProposal["columns"][number]["source"], string> = {
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
  source: SpreadsheetProposal["columns"][number]["source"];
  confidence: "high" | "low";
  include: boolean;
}

function needsOptions(type: ColumnType): boolean {
  return type === "select" || type === "multiselect";
}

function toDraftColumns(proposal: SpreadsheetProposal): DraftColumn[] {
  return proposal.columns.map((col) => ({
    key: col.key,
    label: col.label,
    type: col.type,
    required: col.required,
    optionsText: (col.options ?? []).join(", "),
    source: col.source,
    confidence: col.confidence,
    include: true,
  }));
}

interface CustomTabImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Checklist whose custom tabs are being extended. */
  checklistId: string;
  /** Existing tabs, for the slug collision check. */
  existingTabs: CustomTab[];
  onCreate: (tab: CustomTab) => void;
}

export function CustomTabImportDialog({
  open,
  onOpenChange,
  checklistId,
  existingTabs,
  onCreate,
}: CustomTabImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<SpreadsheetProposal | null>(null);
  const [columns, setColumns] = useState<DraftColumn[]>([]);
  const [tabName, setTabName] = useState("");
  const [importRows, setImportRows] = useState(true);

  const reset = useCallback(() => {
    setFile(null);
    setLoading(false);
    setError(null);
    setProposal(null);
    setColumns([]);
    setTabName("");
    setImportRows(true);
  }, []);

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  /**
   * Uploads the file for parsing. Nothing is saved until Create Tab.
   *
   * `keepOnError` is set when re-analyzing an already-reviewed file (a
   * worksheet switch) so a failure surfaces as a message rather than throwing
   * the reviewer back to the upload step and discarding their edits.
   */
  const analyze = useCallback(
    async (selected: File, sheet?: string, keepOnError = false) => {
      setLoading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("file", selected);
        if (sheet) formData.append("sheet", sheet);

        const res = await fetch(
          `/api/checklists/${checklistId}/custom-tabs/infer`,
          { method: "POST", body: formData }
        );
        const body = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(body.error || "Could not read that file");
        }

        const next = body as SpreadsheetProposal;
        setProposal(next);
        setColumns(toDraftColumns(next));
        setFile(selected);
        // Default the tab name to the sheet name, falling back to the filename.
        setTabName((current) => {
          if (current) return current;
          const fromSheet =
            next.sheetName && next.sheetName !== "CSV" ? next.sheetName : "";
          return fromSheet || selected.name.replace(/\.[^.]+$/, "");
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not read that file");
        if (!keepOnError) {
          setProposal(null);
          setColumns([]);
        }
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

  const updateColumn = (index: number, patch: Partial<DraftColumn>) => {
    setColumns((prev) =>
      prev.map((col, i) => (i === index ? { ...col, ...patch } : col))
    );
  };

  const includedColumns = columns.filter((c) => c.include);

  const slugError = useMemo(() => {
    const slug = customTabSlugFromLabel(tabName);
    return customTabSlugConflict(slug, existingTabs);
  }, [tabName, existingTabs]);

  const missingOptions = includedColumns.filter(
    (c) => needsOptions(c.type) && c.optionsText.trim() === ""
  );

  const canCreate =
    !!proposal &&
    !!tabName.trim() &&
    !slugError &&
    includedColumns.length > 0 &&
    missingOptions.length === 0;

  const handleCreate = () => {
    if (!proposal || !canCreate) return;

    const tabColumns: CustomTabColumn[] = includedColumns.map((col) => {
      const options = needsOptions(col.type)
        ? col.optionsText.split(",").map((o) => o.trim()).filter(Boolean)
        : undefined;
      return {
        key: col.key,
        label: col.label.trim() || col.key,
        type: col.type,
        required: col.required,
        ...(options && options.length > 0 ? { options } : {}),
      };
    });

    // Row values were shaped for the *detected* types on the server. Anything
    // the reviewer re-typed here is re-shaped so the stored cell matches its
    // editor (checkbox → boolean, multi-select → comma-joined string).
    const tabRows: CustomTabRow[] = importRows
      ? proposal.rows.map((row) => {
          const next: CustomTabRow = { id: crypto.randomUUID() };
          for (const col of tabColumns) {
            next[col.key] = reshapeValue(row[col.key], col);
          }
          return next;
        })
      : [];

    onCreate({
      id: `ct_${crypto.randomUUID()}`,
      slug: customTabSlugFromLabel(tabName),
      label: tabName.trim(),
      icon: "Table",
      fields: [], // table-based tab
      columns: tabColumns,
      rows: tabRows,
      uploadedFile: null,
      sortOrder: existingTabs.length,
      createdAt: new Date().toISOString(),
    });

    reset();
    onOpenChange(false);
  };

  const previewRows = proposal?.rows.slice(0, 5) ?? [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[85vh] w-full max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {proposal ? "Review Imported Columns" : "Import Tab from Spreadsheet"}
          </DialogTitle>
        </DialogHeader>

        {/* ---------- Step 1: pick a file ---------- */}
        {!proposal && (
          <div className="space-y-4">
            <div className="rounded-lg border border-dashed bg-slate-50 p-6 text-center">
              <FileSpreadsheet className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium text-gray-800">
                Upload a CSV or Excel file
              </p>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                The first row is read as the column headers. Each column&apos;s input
                type is detected from its values — you can correct anything on the
                next step before the tab is created.
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

        {/* ---------- Step 2: review ---------- */}
        {proposal && (
          <div className="space-y-4">
            {/* Source + sheet picker */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <Label htmlFor="import-tab-name">Tab Name</Label>
                <Input
                  id="import-tab-name"
                  value={tabName}
                  onChange={(e) => setTabName(e.target.value)}
                  placeholder="e.g., Pre-boarding Documents"
                  aria-invalid={!!slugError}
                />
                {slugError ? (
                  <p className="mt-1 text-xs text-red-600">{slugError}</p>
                ) : tabName.trim() ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Slug:{" "}
                    <span className="font-mono">
                      custom-{customTabSlugFromLabel(tabName)}
                    </span>
                  </p>
                ) : null}
              </div>

              {proposal.sheetNames.length > 1 && (
                <div className="min-w-[180px]">
                  <Label htmlFor="import-sheet">Worksheet</Label>
                  <Select
                    value={proposal.sheetName}
                    onValueChange={(sheet) => {
                      if (file) analyze(file, sheet, true);
                    }}
                  >
                    <SelectTrigger id="import-sheet">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {proposal.sheetNames.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Warnings from the parse */}
            {proposal.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-amber-900">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Worth checking
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {proposal.warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-800">
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Column review table */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-sm font-medium">Columns</Label>
                <span className="text-xs text-muted-foreground">
                  {includedColumns.length} of {columns.length} included
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-left text-xs uppercase tracking-wide text-gray-600">
                      <th className="w-10 p-2" />
                      <th className="p-2 font-semibold">Column</th>
                      <th className="p-2 font-semibold">Type</th>
                      <th className="p-2 font-semibold">Options</th>
                      <th className="w-20 p-2 text-center font-semibold">Required</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {columns.map((col, index) => (
                      <tr
                        key={col.key}
                        className={col.include ? "bg-white" : "bg-slate-50/70 opacity-60"}
                      >
                        <td className="p-2 text-center">
                          <Checkbox
                            checked={col.include}
                            onCheckedChange={(checked) =>
                              updateColumn(index, { include: checked === true })
                            }
                            aria-label={`Include ${col.label}`}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={col.label}
                            onChange={(e) =>
                              updateColumn(index, { label: e.target.value })
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
                              updateColumn(index, { type: v as ColumnType })
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
                                updateColumn(index, { optionsText: e.target.value })
                              }
                              placeholder="Comma-separated choices"
                              className="h-8 min-w-[200px] text-sm"
                              disabled={!col.include}
                              aria-invalid={
                                col.include && col.optionsText.trim() === ""
                              }
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          <Checkbox
                            checked={col.required}
                            onCheckedChange={(checked) =>
                              updateColumn(index, { required: checked === true })
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

              {missingOptions.length > 0 && (
                <p className="mt-2 text-xs text-red-600">
                  Add choices for:{" "}
                  {missingOptions.map((c) => c.label || c.key).join(", ")}
                </p>
              )}
            </div>

            {/* Data preview */}
            {previewRows.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label className="text-sm font-medium">Data Preview</Label>
                  <span className="text-xs text-muted-foreground">
                    first {previewRows.length} of {proposal.rows.length} row
                    {proposal.rows.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-left">
                        {includedColumns.map((col) => (
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
                      {previewRows.map((row, i) => (
                        <tr key={i} className="bg-white">
                          {includedColumns.map((col) => (
                            <td
                              key={col.key}
                              className="max-w-[220px] truncate p-2 text-gray-700"
                            >
                              {formatPreviewValue(row[col.key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <label className="mt-3 flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={importRows}
                    onCheckedChange={(checked) => setImportRows(checked === true)}
                  />
                  <span className="text-sm text-gray-700">
                    Import these {proposal.rows.length} row
                    {proposal.rows.length !== 1 ? "s" : ""} as starting data
                  </span>
                </label>
                {!importRows && (
                  <p className="mt-1 pl-6 text-xs text-muted-foreground">
                    The tab will be created empty, with just the columns above.
                  </p>
                )}
              </div>
            )}

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
                <Button onClick={handleCreate} disabled={!canCreate || loading}>
                  Create Tab
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
