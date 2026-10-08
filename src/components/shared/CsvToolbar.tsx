"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Upload, CheckCircle2, AlertCircle, TriangleAlert, ChevronDown, FileSpreadsheet } from "lucide-react";
import { generateCsv, generateCsvTemplate, parseCsvWithReport, downloadCsv } from "@/lib/csv-utils";
import type { ColumnDef } from "@/lib/types";

export type CsvImportMode = "append" | "replace";

interface CsvImportWarning {
  id: string;
  rowNumber?: number;
  columnLabel: string;
  message: string;
}

interface PendingImport {
  fileName: string;
  rows: Record<string, string>[];
  totalDataRows: number;
  matchedHeaders: string[];
  ignoredHeaders: string[];
  missingHeaders: string[];
  warnings: CsvImportWarning[];
}

interface CsvToolbarProps {
  columns: ColumnDef[];
  sampleRow: Record<string, string>;
  onImport: (rows: Record<string, string>[], mode: CsvImportMode) => void;
  sheetName: string;
  exportRows?: Record<string, string>[];
  /**
   * Optional extra download button (e.g. a vendor-specific format).
   * Renders alongside the standard CSV controls.
   */
  extraExport?: {
    label: string;
    onClick: () => void;
    title?: string;
  };
}

type ImportStatus = { tone: "success" | "error"; message: string } | null;
type ValidationType = NonNullable<ColumnDef["validation"]>;

const VALIDATION_RULES: Record<ValidationType, { message: string; isValid: (value: string) => boolean }> = {
  email: {
    message: "Use a valid email address",
    isValid: (value) => /.+@.+\..+/.test(value),
  },
  url: {
    message: "Start URLs with http:// or https://",
    isValid: (value) => /^https?:\/\/.+/.test(value),
  },
  phone: {
    message: "Use a phone number with at least 7 digits",
    isValid: (value) => value.replace(/\D/g, "").length >= 7,
  },
};

function formatList(items: string[], fallback: string): string {
  if (items.length === 0) return fallback;
  if (items.length <= 8) return items.join(", ");
  return `${items.slice(0, 8).join(", ")} +${items.length - 8} more`;
}

function buildImportWarnings(
  rows: Record<string, string>[],
  columns: ColumnDef[],
  matchedHeaders: string[]
): CsvImportWarning[] {
  const matchedLabels = new Set(matchedHeaders);
  const warnings: CsvImportWarning[] = [];

  for (const column of columns) {
    if (column.required && !matchedLabels.has(column.label)) {
      warnings.push({
        id: `missing-${column.key}`,
        columnLabel: column.label,
        message: "Required column was not matched and will import blank",
      });
    }
  }

  rows.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    for (const column of columns) {
      const value = String(row[column.key] ?? "").trim();
      if (column.required && matchedLabels.has(column.label) && value === "") {
        warnings.push({
          id: `row-${rowNumber}-${column.key}-required`,
          rowNumber,
          columnLabel: column.label,
          message: "Required value is blank",
        });
      }

      if (value && column.validation) {
        const rule = VALIDATION_RULES[column.validation];
        if (!rule.isValid(value)) {
          warnings.push({
            id: `row-${rowNumber}-${column.key}-format`,
            rowNumber,
            columnLabel: column.label,
            message: rule.message,
          });
        }
      }

      if (value && column.type === "dropdown" && column.options?.length) {
        const optionSet = new Set(column.options.map((option) => option.toLowerCase()));
        if (!optionSet.has(value.toLowerCase())) {
          warnings.push({
            id: `row-${rowNumber}-${column.key}-option`,
            rowNumber,
            columnLabel: column.label,
            message: `Use one of: ${formatList(column.options, "No configured options")}`,
          });
        }
      }
    }
  });

  return warnings;
}

export function CsvToolbar({ columns, sampleRow, onImport, sheetName, exportRows, extraExport }: CsvToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

  const previewColumns = columns.filter((column) =>
    pendingImport?.matchedHeaders.includes(column.label)
  ).slice(0, 5);
  const previewRows = pendingImport?.rows.slice(0, 3) ?? [];

  const handleDownloadTemplate = () => {
    const csv = generateCsvTemplate(columns, sampleRow);
    const filename = `${sheetName.toLowerCase().replace(/\s+/g, "-")}-template.csv`;
    downloadCsv(csv, filename);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleDownloadCurrent = () => {
    if (!exportRows) return;
    const csv = generateCsv(columns, exportRows);
    const filename = `${sheetName.toLowerCase().replace(/\s+/g, "-")}.csv`;
    downloadCsv(csv, filename);
  };

  const clearStatusLater = () => {
    setTimeout(() => setImportStatus(null), 3000);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const report = parseCsvWithReport(text, columns);

      if (report.rows.length === 0) {
        setImportStatus({ tone: "error", message: "No importable rows found in CSV" });
        clearStatusLater();
      } else {
        setImportStatus(null);
        setPendingImport({
          fileName: file.name,
          rows: report.rows,
          totalDataRows: report.totalDataRows,
          matchedHeaders: report.matchedHeaders,
          ignoredHeaders: report.ignoredHeaders,
          missingHeaders: report.missingHeaders,
          warnings: buildImportWarnings(report.rows, columns, report.matchedHeaders),
        });
      }
    } catch {
      setImportStatus({ tone: "error", message: "Error reading CSV file" });
      clearStatusLater();
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const applyImport = (mode: CsvImportMode) => {
    if (!pendingImport) return;
    const warningCount = pendingImport.warnings.length;
    const baseMessage = mode === "replace"
      ? `Replaced with ${pendingImport.rows.length} row${pendingImport.rows.length !== 1 ? "s" : ""}`
      : `Imported ${pendingImport.rows.length} row${pendingImport.rows.length !== 1 ? "s" : ""}`;
    onImport(pendingImport.rows, mode);
    setImportStatus({
      tone: "success",
      message: warningCount > 0
        ? `${baseMessage}; ${warningCount} warning${warningCount === 1 ? "" : "s"} may need cleanup`
        : baseMessage,
    });
    setPendingImport(null);
    clearStatusLater();
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {/* One menu instead of three loose buttons: importing and exporting are occasional jobs. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            title="Import or export this table as a CSV file"
            className="min-h-11 border-brand-lavender-darker/40 text-xs text-foreground hover:border-brand-lavender-darker hover:bg-brand-lavender-lightest md:min-h-0"
          >
            <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />
            Import / export CSV
            <ChevronDown className="ml-1 h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={handleDownloadTemplate} className="min-h-11 md:min-h-0">
            <Download className="h-4 w-4" />
            Download CSV template
          </DropdownMenuItem>
          {exportRows && (
            <DropdownMenuItem onSelect={handleDownloadCurrent} className="min-h-11 md:min-h-0">
              <Download className="h-4 w-4" />
              Download CSV
            </DropdownMenuItem>
          )}
          {extraExport && (
            <DropdownMenuItem onSelect={extraExport.onClick} title={extraExport.title} className="min-h-11 md:min-h-0">
              <Download className="h-4 w-4" />
              {extraExport.label}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleUploadClick} className="min-h-11 md:min-h-0">
            <Upload className="h-4 w-4" />
            Upload CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileChange}
      />
      {importStatus && (
        <span className={`flex items-center gap-1 text-xs ${importStatus.tone === "success" ? "text-foreground" : "text-destructive"}`}>
          {importStatus.tone === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
          {importStatus.message}
        </span>
      )}

      <Dialog open={pendingImport !== null} onOpenChange={(open) => !open && setPendingImport(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Review CSV import</DialogTitle>
            <DialogDescription>
              {pendingImport?.fileName} has {pendingImport?.rows.length ?? 0} importable row{pendingImport?.rows.length === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>

          {pendingImport && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-md border p-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Matched</div>
                  <p className="mt-1 text-sm text-foreground">{formatList(pendingImport.matchedHeaders, "None")}</p>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ignored</div>
                  <p className="mt-1 text-sm text-foreground">{formatList(pendingImport.ignoredHeaders, "None")}</p>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Blank on import</div>
                  <p className="mt-1 text-sm text-foreground">{formatList(pendingImport.missingHeaders, "None")}</p>
                </div>
              </div>

              {pendingImport.warnings.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950">
                  <div className="flex items-start gap-2">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">Review {pendingImport.warnings.length} warning{pendingImport.warnings.length === 1 ? "" : "s"} before importing</p>
                      <p className="mt-1 text-xs text-amber-900">These rows can still be imported, but they may need cleanup after import.</p>
                      <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs">
                        {pendingImport.warnings.slice(0, 8).map((warning) => (
                          <li key={warning.id}>
                            {warning.rowNumber ? `Row ${warning.rowNumber}: ` : ""}
                            <span className="font-medium">{warning.columnLabel}</span> - {warning.message}
                          </li>
                        ))}
                      </ul>
                      {pendingImport.warnings.length > 8 && (
                        <p className="mt-2 text-xs text-amber-900">+{pendingImport.warnings.length - 8} more warnings</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-md border">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                  <p className="font-medium">Sample rows</p>
                  <p className="text-xs text-muted-foreground">{pendingImport.totalDataRows} data row{pendingImport.totalDataRows === 1 ? "" : "s"} in file</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] border-collapse text-left text-xs">
                    <thead className="bg-muted/60 text-muted-foreground">
                      <tr>
                        {previewColumns.map((column) => (
                          <th key={column.key} className="px-3 py-2 font-medium">{column.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-t">
                          {previewColumns.map((column) => (
                            <td key={column.key} className="max-w-[220px] truncate px-3 py-2">
                              {row[column.key] || <span className="text-muted-foreground">Blank</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" className="min-h-11 md:min-h-0" onClick={() => setPendingImport(null)}>
              Cancel
            </Button>
            <Button type="button" variant="outline" className="min-h-11 md:min-h-0" onClick={() => applyImport("replace")}>
              {pendingImport?.warnings.length ? "Replace anyway" : "Replace rows"}
            </Button>
            <Button type="button" className="min-h-11 md:min-h-0" onClick={() => applyImport("append")}>
              {pendingImport?.warnings.length ? "Append anyway" : "Append rows"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
