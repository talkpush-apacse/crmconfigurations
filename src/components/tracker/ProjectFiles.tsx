"use client";

import { useRef, useState } from "react";
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, errorMessage } from "@/lib/tracker/client-api";
import { checkFile, FILE_ACCEPT, FILE_KIND_LABELS, FILE_KINDS, FILE_TYPES_HINT, formatBytes, type FileKind } from "@/lib/tracker/file-rules";
import type { ProjectFileDTO } from "@/lib/tracker/file-service";
import { formatDate } from "@/lib/tracker/format";
import { useApiResource } from "@/lib/tracker/use-api-resource";
import { ConfirmDialog } from "./ConfirmDialog";
import { Field, FormError } from "./Field";

/**
 * Files kept with a project (contracts, Gantt charts, notes). Staff only.
 * Upload is two steps so a big PDF never passes through our server: ask for a one-off upload address, send the
 * file straight to storage, then record it.
 */
export function ProjectFiles({ projectId, onChanged }: { projectId: string; onChanged?: () => void }) {
  const { data, error: loadError, reload } = useApiResource<{ files: ProjectFileDTO[] }>(`/api/tracker/projects/${projectId}/files`);
  const [kind, setKind] = useState<FileKind>("contract");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<ProjectFileDTO | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setError("");
    const check = checkFile(file.name, file.size);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setBusy(true);
    try {
      const ticket = await api<{ path: string; signedUrl: string }>(`/api/tracker/projects/${projectId}/files/upload-url`, {
        method: "POST",
        body: { fileName: file.name, size: file.size, kind },
      });
      // Same request Supabase's own library makes for a signed upload.
      const form = new FormData();
      form.append("cacheControl", "3600");
      form.append("", file);
      const put = await fetch(ticket.signedUrl, { method: "PUT", headers: { "x-upsert": "false" }, body: form });
      if (!put.ok) throw new Error(`storage ${put.status}`);
      await api(`/api/tracker/projects/${projectId}/files`, { method: "POST", body: { path: ticket.path, fileName: file.name, kind } });
      reload();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error && err.message.startsWith("storage ") ? "The upload did not go through. Please try again." : errorMessage(err));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    if (!removing) return;
    try {
      await api(`/api/tracker/files/${removing.id}`, { method: "DELETE" });
      reload();
      onChanged?.();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const files = data?.files ?? null;

  return (
    <section aria-labelledby="project-files-heading" className="space-y-3 border-t border-border pt-4">
      <div>
        <h3 id="project-files-heading" className="text-sm font-semibold">
          Files
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Contracts, Gantt charts and other documents. Only the Talkpush team can open them. Clients never see them.
        </p>
      </div>

      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      ) : files === null ? (
        <p className="text-xs text-muted-foreground">Loading files...</p>
      ) : files.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">No files yet.</p>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{f.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {FILE_KIND_LABELS[f.kind as FileKind] ?? f.kind} · {formatBytes(f.sizeBytes)} · {formatDate(f.createdAt.slice(0, 10))} · {f.uploadedBy}
                </p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <a href={`/api/tracker/files/${f.id}`} aria-label={`Download ${f.fileName}`}>
                  <Download className="h-4 w-4" />
                </a>
              </Button>
              <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${f.fileName}`} onClick={() => setRemoving(f)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-52">
          <Field label="What is it?" htmlFor="project-file-kind">
            <Select value={kind} onValueChange={(v) => setKind(v as FileKind)}>
              <SelectTrigger id="project-file-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILE_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {FILE_KIND_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <input
          ref={inputRef}
          id="project-file-input"
          type="file"
          accept={FILE_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button type="button" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {busy ? "Uploading..." : "Upload file"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{FILE_TYPES_HINT}</p>
      <FormError message={error} />

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this file?"
        description={`"${removing?.fileName ?? ""}" disappears from the project. The activity history keeps a record that it was here.`}
        confirmLabel="Remove file"
        onConfirm={remove}
      />
    </section>
  );
}
