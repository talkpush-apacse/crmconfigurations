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
