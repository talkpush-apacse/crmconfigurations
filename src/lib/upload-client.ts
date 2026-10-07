import { checkTabUploadFile } from "@/lib/upload-rules";

export interface TabUploadContext {
  tabKey?: string;
  editorToken?: string;
  slug?: string;
  customTabId?: string;
  fieldKey?: string;
}

export interface UploadedTabFile {
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Upload failed");
  return json as T;
}

/**
 * Uploads one file for a tab, up to 10 MB. The bytes go from the browser straight to storage (the web server would
 * stop anything over about 4.5 MB), with the server checking before and after. Throws an Error whose message is
 * safe to show to the person uploading.
 */
export async function uploadTabFile(file: File, ctx: TabUploadContext = {}): Promise<UploadedTabFile> {
  const problem = checkTabUploadFile(file.name, file.size, file.type);
  if (problem) throw new Error(`"${file.name}": ${problem}`);

  const base = { fileName: file.name, mimeType: file.type, ...ctx };
  const ticket = await postJson<{ path: string; signedUrl: string }>("/api/upload/ticket", { ...base, size: file.size });

  // Same request Supabase's own library makes for a signed upload.
  const form = new FormData();
  form.append("cacheControl", "3600");
  form.append("", file);
  const put = await fetch(ticket.signedUrl, { method: "PUT", headers: { "x-upsert": "false" }, body: form });
  if (!put.ok) throw new Error(`"${file.name}": the upload did not go through. Please try again.`);

  return postJson<UploadedTabFile>("/api/upload/complete", { ...base, path: ticket.path });
}
