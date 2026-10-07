/**
 * Which files /api/upload accepts.
 *
 * "tab-uploads" (the "Upload file" box on each tab, and custom-tab file fields)
 * takes any file except Windows executables. Every other folder (logos,
 * banners, documents, general) keeps the original images/PDF/Word/Excel list.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export const RESTRICTED_FOLDER_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
];

const BLOCKED_EXTENSIONS = [".exe"];
const BLOCKED_MIME_TYPES = [
  "application/x-msdownload",
  "application/x-dosexec",
  "application/vnd.microsoft.portable-executable",
];

export function isBlockedFile(fileName: string, mimeType: string): boolean {
  const name = fileName.trim().toLowerCase();
  return (
    BLOCKED_EXTENSIONS.some((ext) => name.endsWith(ext)) ||
    BLOCKED_MIME_TYPES.includes(mimeType.toLowerCase())
  );
}

/** Returns an error message, or null when the file is acceptable for this folder. */
export function checkUploadType(folder: string, fileName: string, mimeType: string): string | null {
  if (isBlockedFile(fileName, mimeType)) {
    return "Executable (.exe) files can't be uploaded.";
  }
  if (folder === "tab-uploads") return null;
  if (!RESTRICTED_FOLDER_TYPES.includes(mimeType)) {
    return `File type '${mimeType}' is not allowed. Accepted: images, PDF, Word documents, and spreadsheets/CSV.`;
  }
  return null;
}

/** Folder used by the two-step (browser -> storage direct) tab upload. */
export const TAB_UPLOAD_FOLDER = "tab-uploads";

/** Storage-safe version of a file name: letters, digits, dot, dash, underscore. */
export function safeUploadName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "file";
}

/** Checks a tab-upload file before any bytes move. Returns an error message, or null when fine. */
export function checkTabUploadFile(fileName: string, size: number, mimeType: string): string | null {
  if (!Number.isFinite(size) || size <= 0) return "That file is empty.";
  if (size > MAX_UPLOAD_BYTES) return "File too large. Maximum size is 10 MB.";
  return checkUploadType(TAB_UPLOAD_FOLDER, fileName, mimeType);
}

const TAB_UPLOAD_PATH = /^tab-uploads\/\d+-[0-9a-f-]{36}-[A-Za-z0-9._-]+$/;

/** True only for paths this app generated itself, so a caller cannot point us at some other file. */
export function isTabUploadPath(path: string): boolean {
  return TAB_UPLOAD_PATH.test(path);
}

export function buildTabUploadPath(fileName: string, id: string, now: number = Date.now()): string {
  return `${TAB_UPLOAD_FOLDER}/${now}-${id}-${safeUploadName(fileName)}`;
}
