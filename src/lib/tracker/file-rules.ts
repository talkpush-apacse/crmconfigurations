/**
 * Rules for files kept with a project (contracts, Gantt charts, notes). Pure functions with no server imports, so the
 * screen can check a file before uploading and the server applies the very same rules.
 *
 * The type of a file is decided by its EXTENSION from the list below, never by what the browser claims. Files are
 * only ever opened as downloads, through short-lived signed links, from a private bucket.
 */

export const FILE_KINDS = ["contract", "timeline", "other"] as const;
export type FileKind = (typeof FILE_KINDS)[number];

export const FILE_KIND_LABELS: Record<FileKind, string> = {
  contract: "Contract",
  timeline: "Timeline / Gantt",
  other: "Other",
};

/** 25 MB. The storage bucket enforces the same limit, so a changed browser cannot get past it. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const ALLOWED_FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

/** For the file picker's `accept` attribute. */
export const FILE_ACCEPT = Object.keys(ALLOWED_FILE_TYPES)
  .map((ext) => `.${ext}`)
  .join(",");

export const FILE_TYPES_HINT = "PDF, Word, Excel, PowerPoint, CSV, text or image files, up to 25 MB.";

export const FILE_FOLDER = "projects";

export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot < 0 ? "" : fileName.slice(dot + 1).toLowerCase();
}

/** Letters, digits, dot, dash and underscore only; no path pieces; never empty; kept short. */
export function safeFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[._]+/, "").replace(/_{2,}/g, "_");
  const ext = fileExtension(cleaned);
  const stem = ext ? cleaned.slice(0, cleaned.length - ext.length - 1) : cleaned;
  const shortStem = (stem || "file").slice(0, 80);
  return ext ? `${shortStem}.${ext}` : shortStem;
}

export type FileCheck = { ok: true; mimeType: string; safeName: string } | { ok: false; error: string };

export function checkFile(fileName: string, sizeBytes: number): FileCheck {
  const ext = fileExtension(fileName);
  const mimeType = ALLOWED_FILE_TYPES[ext];
  if (!mimeType) return { ok: false, error: `That file type (${ext ? `.${ext}` : "no extension"}) is not allowed. ${FILE_TYPES_HINT}` };
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return { ok: false, error: "That file is empty." };
  if (sizeBytes > MAX_FILE_BYTES) return { ok: false, error: `That file is ${formatBytes(sizeBytes)}. The limit is ${formatBytes(MAX_FILE_BYTES)}.` };
  return { ok: true, mimeType, safeName: safeFileName(fileName) };
}

export function buildStoragePath(projectId: string, uniqueId: string, safeName: string): string {
  return `${FILE_FOLDER}/${projectId}/${uniqueId}-${safeName}`;
}

/** A path may only be registered for the project it was issued for. */
export function pathBelongsToProject(path: string, projectId: string): boolean {
  const prefix = `${FILE_FOLDER}/${projectId}/`;
  if (!path.startsWith(prefix)) return false;
  const rest = path.slice(prefix.length);
  return rest.length > 0 && !rest.includes("/") && !rest.includes("..");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
