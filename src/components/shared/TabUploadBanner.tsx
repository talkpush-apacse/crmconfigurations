"use client";

import { useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { useTabUpload } from "@/hooks/useTabUpload";
import { useChecklistContext } from "@/lib/checklist-context";
import type { TabUploadFile } from "@/lib/types";

interface TabUploadBannerProps {
  /**
   * Stable identifier for this tab — must match the dataKey used in tab-config
   * (e.g. "users", "campaigns", "sites"). Determines where files are stored
   * inside the shared `tabUploadMeta` JSON column.
   */
  tabKey: string;
  /** Display name shown in the banner copy ("Already have your <tabLabel> in a spreadsheet?") */
  tabLabel: string;
}

const ACCEPT =
  ".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv";

const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".csv"];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tu_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function TabUploadBanner({ tabKey, tabLabel }: TabUploadBannerProps) {
  const { uploadedFiles, isSkipped, setUploadedFiles, setIsSkipped } =
    useTabUpload(tabKey);
  const { basePath } = useChecklistContext();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TabUploadFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // basePath is always "/editor/<token>" or "/client/<slug>" — use it to prove
  // access to /api/upload without needing admin auth.
  const editorToken = basePath.startsWith("/editor/")
    ? basePath.slice("/editor/".length)
    : "";
  const clientSlug = basePath.startsWith("/client/")
    ? basePath.slice("/client/".length)
    : "";

  const hasFiles = uploadedFiles.length > 0;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setError(null);

    // Validate extensions client-side before sending
    const invalid = files.find(
      (f) => !ALLOWED_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext))
    );
    if (invalid) {
      setError(`"${invalid.name}" is not an Excel or CSV file.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);

    try {
      const newFiles: TabUploadFile[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "tab-uploads");
        formData.append("tabKey", tabKey);
        if (editorToken) formData.append("editorToken", editorToken);
        if (clientSlug) formData.append("slug", clientSlug);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const body = await res.json();
        if (!res.ok) {
          setError(body.error || `Upload failed for "${file.name}"`);
          break;
        }
        newFiles.push({
          id: generateId(),
          fileName: file.name,
          fileUrl: body.url as string,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
        });
      }
      if (newFiles.length > 0) {
        setUploadedFiles([...uploadedFiles, ...newFiles]);
      }
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = (id: string) => {
    const next = uploadedFiles.filter((f) => f.id !== id);
    setUploadedFiles(next);
    // If user removes the last file, automatically un-skip — otherwise the
    // form would stay hidden with no way to bring it back without a file.
    if (next.length === 0 && isSkipped) {
      setIsSkipped(false);
    }
  };

  return (
    <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-700">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-blue-900">
              Already have your {tabLabel.toLowerCase()} in a spreadsheet?
            </h4>
            <p className="mt-0.5 text-[13px] text-blue-800/80">
              Upload your existing Excel or CSV file and our team will review it.
              You can still fill in the fields below if you prefer.
            </p>
          </div>
        </div>

        <div className="shrink-0 sm:pl-3">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            onChange={handleFileSelect}
            className="hidden"
            multiple
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="border-blue-300 bg-white text-blue-700 hover:bg-blue-100 hover:text-blue-800"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {hasFiles ? "Add another file" : "Upload spreadsheet"}
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      {hasFiles && (
        <div className="mt-3 space-y-2">
          <ul className="space-y-1.5">
            {uploadedFiles.map((file) => (
              <li
                key={file.id}
                className="flex items-center justify-between gap-2 rounded-md border border-blue-200 bg-white px-3 py-2 text-[13px]"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-blue-600" />
                  <span className="truncate font-medium text-gray-800" title={file.fileName}>
                    {file.fileName}
                  </span>
                  <span className="shrink-0 text-xs text-gray-500">
                    {formatBytes(file.fileSize)} · {formatDate(file.uploadedAt)}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <a
                    href={file.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    title="Download file"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(file)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    title="Remove file"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <label className="flex cursor-pointer items-center gap-2 pt-1 text-[13px] text-blue-900">
            <Checkbox
              checked={isSkipped}
              onCheckedChange={(v) => setIsSkipped(v === true)}
              className="border-blue-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
            />
            <span>
              Skip manual entry — our team will use the uploaded file{uploadedFiles.length > 1 ? "s" : ""}
            </span>
          </label>
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        fileName={deleteTarget?.fileName ?? "this file"}
        onConfirm={() => {
          if (deleteTarget) handleRemove(deleteTarget.id);
        }}
      />
    </div>
  );
}

/**
 * Renders below the banner when the user has chosen to skip manual entry.
 * The form fields are hidden and replaced with a confirmation block so it's
 * obvious that the section has been intentionally delegated to the team.
 */
export function TabUploadSkippedNotice({ fileCount }: { fileCount: number }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-emerald-900">
        {fileCount === 1 ? "File uploaded" : `${fileCount} files uploaded`}
      </p>
      <p className="mt-1 text-[13px] text-emerald-800/80">
        Our implementation team will review and configure this section based on your
        spreadsheet. Untick the skip option above to switch back to the form.
      </p>
    </div>
  );
}
