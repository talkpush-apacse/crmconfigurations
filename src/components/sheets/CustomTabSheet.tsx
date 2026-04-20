"use client";

import { useCallback, useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditableTable } from "@/components/shared/EditableTable";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { useChecklistContext } from "@/lib/checklist-context";
import type { CustomTab, CustomTabRow, ColumnDef } from "@/lib/types";

// Map CustomTabColumn.type → ColumnDef.type + optional validation
function mapColumnType(
  type: NonNullable<CustomTab["columns"]>[number]["type"]
): Pick<ColumnDef, "type" | "validation"> {
  switch (type) {
    case "textarea":
      return { type: "textarea" };
    case "checkbox":
      return { type: "boolean" };
    case "select":
      return { type: "dropdown" };
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

function buildColumnDefs(columns: NonNullable<CustomTab["columns"]>): ColumnDef[] {
  return columns.map((col) => {
    const mapped = mapColumnType(col.type);
    return {
      key: col.key,
      label: col.label,
      type: mapped.type,
      validation: mapped.validation,
      required: col.required,
      options: col.options,
      width: col.width,
    };
  });
}

interface CustomTabSheetProps {
  customTab: CustomTab;
}

export function CustomTabSheet({ customTab }: CustomTabSheetProps) {
  const { data, updateField, isReadOnly } = useChecklistContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteFileOpen, setDeleteFileOpen] = useState(false);

  const rows = (customTab.rows ?? []) as CustomTabRow[];
  const columns = customTab.columns ?? [];
  const columnDefs = buildColumnDefs(columns);

  // Helper: update this tab in the full customTabs array and persist
  const updateTab = useCallback(
    (updater: (tab: CustomTab) => CustomTab) => {
      const allTabs = (data?.customTabs ?? []) as CustomTab[];
      const updated = allTabs.map((t) => (t.id === customTab.id ? updater(t) : t));
      updateField("customTabs", updated);
    },
    [data?.customTabs, customTab.id, updateField]
  );

  const handleUpdate = useCallback(
    (index: number, field: string, value: string | boolean) => {
      updateTab((tab) => {
        const newRows = [...(tab.rows ?? [])];
        newRows[index] = { ...newRows[index], [field]: value };
        return { ...tab, rows: newRows };
      });
    },
    [updateTab]
  );

  const handleAdd = useCallback(() => {
    updateTab((tab) => {
      const emptyRow: CustomTabRow = { id: crypto.randomUUID() };
      for (const col of columns) {
        emptyRow[col.key] = col.type === "checkbox" ? false : "";
      }
      return { ...tab, rows: [...(tab.rows ?? []), emptyRow] };
    });
  }, [updateTab, columns]);

  const handleDelete = useCallback(
    (index: number) => {
      updateTab((tab) => {
        const newRows = (tab.rows ?? []).filter((_, i) => i !== index);
        return { ...tab, rows: newRows };
      });
    },
    [updateTab]
  );

  const handleReorder = useCallback(
    (reordered: CustomTabRow[]) => {
      updateTab((tab) => ({ ...tab, rows: reordered }));
    },
    [updateTab]
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setUploadError(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "tab-uploads");
        formData.append("slug", data?.slug ?? "");

        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Upload failed");
        }
        const { url } = await res.json();

        updateTab((tab) => ({
          ...tab,
          uploadedFile: {
            name: file.name,
            url,
            uploadedAt: new Date().toISOString(),
          },
        }));
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [data?.slug, updateTab]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    // Reset so the same file can be re-selected
    e.target.value = "";
  };

  const handleRemoveFile = () => {
    updateTab((tab) => ({ ...tab, uploadedFile: null }));
  };

  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">
          This tab has no columns defined yet. Use the MCP tool to configure columns.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Table */}
      <EditableTable
        columns={columnDefs}
        data={rows}
        onUpdate={handleUpdate}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onReorder={handleReorder}
        addLabel="Add Row"
      />

      {/* Spreadsheet upload section */}
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-5">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800">Reference Spreadsheet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Attach an Excel or CSV file as a reference for this tab. The file is stored as-is — it
              does not modify the table above.
            </p>

            {customTab.uploadedFile ? (
              <div className="mt-3 flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-green-600" />
                <span className="truncate flex-1 text-gray-700">{customTab.uploadedFile.name}</span>
                <a
                  href={customTab.uploadedFile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-blue-600 hover:underline"
                >
                  <Download className="h-4 w-4" />
                </a>
                {!isReadOnly && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground px-2 shrink-0"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      Replace
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteFileOpen(true)}
                      title="Remove file"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            ) : (
              !isReadOnly && (
                <div className="mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4" />
                    {uploading ? "Uploading…" : "Upload Spreadsheet"}
                  </Button>
                </div>
              )
            )}

            {uploadError && (
              <p className="mt-2 text-xs text-red-600">{uploadError}</p>
            )}
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFileInputChange}
      />

      <ConfirmDeleteDialog
        open={deleteFileOpen}
        onOpenChange={setDeleteFileOpen}
        fileName={customTab.uploadedFile?.name ?? "this file"}
        onConfirm={handleRemoveFile}
      />
    </div>
  );
}
