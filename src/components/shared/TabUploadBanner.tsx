"use client";

import { useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  File as FileIcon,
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
import { uploadTabFile } from "@/lib/upload-client";

interface TabUploadBannerProps {
  /**
   * Stable identifier for this tab — must match the dataKey used in tab-config
   * (e.g. "users", "campaigns", "sites"). Determines where files are stored
   * inside the shared `tabUploadMeta` JSON column.
   */
  tabKey: string;
  /** Display name shown in the banner copy ("Already have your <tabLabel> in a file?") */
  tabLabel: string;
  /**
   * Renders as a single line instead of a full-width panel.
   *
   * The roomy version cost ~200px above the table on every tab, competing with
   * the fields for attention. Compact keeps the offer available without
   * pushing the inputs off the first screen. The uploaded-file list is
   * unchanged — once files exist they are worth showing.
   */
  compact?: boolean;
}

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

export function TabUploadBanner({ tabKey, tabLabel, compact = false }: TabUploadBannerProps) {
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

    setUploading(true);

    try {
      const newFiles: TabUploadFile[] = [];
      for (const file of files) {
        try {
          const uploaded = await uploadTabFile(file, { tabKey, editorToken, slug: clientSlug });
          newFiles.push({
            id: generateId(),
            fileName: file.name,
            fileUrl: uploaded.url,
            fileSize: file.size,
            uploadedAt: new Date().toISOString(),
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : `Upload failed for "${file.name}"`);
          break;
        }
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
    <div
      className={
        compact
          ? "mb-3"
          : "cf-panel mb-6 rounded-lg border border-brand-lavender-lighter bg-brand-lavender-lightest p-4"
      }
    >
      <div
        className={
          compact
            ? "flex flex-wrap items-center gap-2"
            : "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
        }
      >
        {compact ? (
          <p className="text-[13px] text-muted-foreground">
            Already have your {tabLabel.toLowerCase()} in a file?
          </p>
        ) : (
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-lavender text-brand-lavender-darker">
              <FileIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-foreground">
                Already have your {tabLabel.toLowerCase()} in a file?
              </h4>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Upload any file (spreadsheet, document, image) and our team will review it.
                You can still fill in the fields below if you prefer.
              </p>
            </div>
          </div>
        )}

        <div className={compact ? "shrink-0" : "shrink-0 sm:pl-3"}>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            multiple
          />
          <Button
            variant={compact ? "ghost" : "outline"}
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={
              compact
                ? "h-7 px-2 text-xs text-brand-lavender-darker hover:bg-brand-lavender-lightest max-md:min-h-11"
                : "border-brand-lavender-lighter bg-white text-brand-lavender-darker hover:bg-brand-lavender-lightest hover:text-brand-lavender-darker max-md:min-h-11"
            }
          >
            {uploading ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {hasFiles ? "Add another file" : "Upload file"}
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
                className="flex items-center justify-between gap-2 rounded-md border border-brand-lavender/40 bg-white px-3 py-2 text-[13px]"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FileIcon className="h-4 w-4 shrink-0 text-brand-lavender-darker" />
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
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-brand-lavender-lightest hover:text-brand-lavender-darker focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-lavender-darker"
                    title="Download file"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(file)}
                    className="inline-flex size-11 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive md:size-7"
                    title="Remove file"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <label className="flex cursor-pointer items-center gap-2 pt-1 text-[13px] text-foreground">
            <Checkbox
              checked={isSkipped}
              onCheckedChange={(v) => setIsSkipped(v === true)}
              className="border-brand-lavender data-[state=checked]:bg-brand-sage-darker data-[state=checked]:border-brand-sage-darker"
            />
            <span>
              Skip manual entry. Our team will use the uploaded file{uploadedFiles.length > 1 ? "s" : ""}
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
        uploaded file. Untick the skip option above to switch back to the form.
      </p>
    </div>
  );
}
