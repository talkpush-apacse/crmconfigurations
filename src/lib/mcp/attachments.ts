import { CHECKLIST_JSON_FIELDS } from "@/lib/types";

export type Attachment = {
  tab: string;
  fieldPath: string;
  fileName: string;
  mimeType: string | null;
  size: number | null;
  url: string;
  storagePath: string | null;
  uploadedAt: string | null;
};

export type StorageUrlParts = {
  bucket: string;
  path: string;
};

type ChecklistLike = Record<string, unknown>;
type JsonRecord = Record<string, unknown>;
type ScanRoot = {
  tab: string;
  value: unknown;
};

const ATTACHMENT_URL_KEYS = ["url", "fileUrl", "href"] as const;
const ATTACHMENT_METADATA_KEYS = ["name", "fileName", "size", "fileSize", "mimeType", "type"] as const;
const FILE_URL_KEY_PATTERN = /(file|logo|banner|image|document|attachment|template).*(url|link|href)|(url|link|href).*(file|logo|banner|image|document|attachment|template)/i;

export function scanChecklistForAttachments(checklist: ChecklistLike): Attachment[] {
  const attachments: Attachment[] = [];
  const seen = new Set<string>();

  for (const root of getAttachmentScanRoots(checklist)) {
    scanValue(root.value, root.tab, "", attachments, seen);
  }

  return attachments;
}

export function getAttachmentTabKeys(checklist: ChecklistLike): Set<string> {
  return new Set(getAttachmentScanRoots(checklist).map((root) => root.tab));
}

export function parseStorageUrl(rawUrl: string): StorageUrlParts | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  const objectIndex = segments.findIndex((segment, index) => {
    return segment === "object" && segments[index - 2] === "storage" && segments[index - 1] === "v1";
  });

  if (objectIndex === -1) return null;

  const accessSegment = segments[objectIndex + 1];
  if (accessSegment !== "public" && accessSegment !== "sign") return null;

  const bucket = decodePathSegment(segments[objectIndex + 2]);
  const pathSegments = segments.slice(objectIndex + 3);
  if (!bucket || pathSegments.length === 0) return null;

  const path = pathSegments.map(decodePathSegment).join("/");
  if (!path) return null;

  return { bucket, path };
}

function getAttachmentScanRoots(checklist: ChecklistLike): ScanRoot[] {
  const roots: ScanRoot[] = [];

  for (const field of CHECKLIST_JSON_FIELDS) {
    const value = checklist[field];

    if (field === "tabUploadMeta") {
      if (!isRecord(value)) continue;
      for (const [tab, meta] of Object.entries(value)) {
        roots.push({ tab, value: meta });
      }
      continue;
    }

    if (field === "customTabs") {
      if (!Array.isArray(value)) continue;
      value.forEach((customTab, index) => {
        roots.push({
          tab: getCustomTabAttachmentKey(customTab, index),
          value: customTab,
        });
      });
      continue;
    }

    roots.push({ tab: field, value });
  }

  return roots;
}

function scanValue(
  value: unknown,
  tab: string,
  fieldPath: string,
  attachments: Attachment[],
  seen: Set<string>
) {
  if (typeof value === "string") {
    if (fieldPath && isLikelyAttachmentUrlPath(fieldPath) && isConfiguredStorageUrl(value)) {
      pushAttachment(
        attachments,
        seen,
        normalizeAttachment({
          tab,
          fieldPath,
          url: value,
        })
      );
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      scanValue(item, tab, appendArrayPath(fieldPath, index), attachments, seen);
    });
    return;
  }

  if (!isRecord(value)) return;

  const objectAttachment = attachmentFromObject(value, tab, fieldPath);
  if (objectAttachment) {
    pushAttachment(attachments, seen, objectAttachment);
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    scanValue(child, tab, appendObjectPath(fieldPath, key), attachments, seen);
  }
}

function attachmentFromObject(value: JsonRecord, tab: string, fieldPath: string): Attachment | null {
  const url = getAttachmentUrl(value);
  if (!url || !isConfiguredStorageUrl(url)) return null;

  const hasMetadata = ATTACHMENT_METADATA_KEYS.some((key) => value[key] !== undefined && value[key] !== null);
  if (!hasMetadata) return null;

  return normalizeAttachment({
    tab,
    fieldPath,
    url,
    fileName: getString(value.fileName) ?? getString(value.name),
    mimeType: getMimeType(value),
    size: getNumber(value.size) ?? getNumber(value.fileSize),
    uploadedAt: getString(value.uploadedAt),
  });
}

function normalizeAttachment(input: {
  tab: string;
  fieldPath: string;
  url: string;
  fileName?: string | null;
  mimeType?: string | null;
  size?: number | null;
  uploadedAt?: string | null;
}): Attachment {
  const storageParts = parseStorageUrl(input.url);

  return {
    tab: input.tab,
    fieldPath: input.fieldPath,
    fileName: input.fileName?.trim() || deriveFileName(input.url),
    mimeType: input.mimeType ?? null,
    size: input.size ?? null,
    url: input.url,
    storagePath: storageParts?.path ?? null,
    uploadedAt: input.uploadedAt ?? null,
  };
}

function pushAttachment(attachments: Attachment[], seen: Set<string>, attachment: Attachment) {
  const key = `${attachment.tab}\u0000${attachment.fieldPath}\u0000${attachment.url}`;
  if (seen.has(key)) return;
  seen.add(key);
  attachments.push(attachment);
}

function getAttachmentUrl(value: JsonRecord): string | null {
  for (const key of ATTACHMENT_URL_KEYS) {
    const url = getString(value[key]);
    if (url) return url;
  }
  return null;
}

function isLikelyAttachmentUrlPath(fieldPath: string): boolean {
  const leafKey = fieldPath.match(/([^.[\]]+)(?:\[\d+\])?$/)?.[1] ?? fieldPath;
  return FILE_URL_KEY_PATTERN.test(leafKey);
}

function isConfiguredStorageUrl(rawUrl: string): boolean {
  if (!parseStorageUrl(rawUrl)) return false;

  const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configuredSupabaseUrl) return true;

  try {
    return new URL(rawUrl).origin === new URL(configuredSupabaseUrl).origin;
  } catch {
    return false;
  }
}

function deriveFileName(rawUrl: string): string {
  const storageParts = parseStorageUrl(rawUrl);
  const path = storageParts?.path;
  const fallback = "attachment";

  if (path) {
    const lastSegment = path.split("/").filter(Boolean).pop();
    return lastSegment ? decodePathSegment(lastSegment) : fallback;
  }

  try {
    const parsed = new URL(rawUrl);
    const lastSegment = parsed.pathname.split("/").filter(Boolean).pop();
    return lastSegment ? decodePathSegment(lastSegment) : fallback;
  } catch {
    return fallback;
  }
}

function getCustomTabAttachmentKey(value: unknown, index: number): string {
  if (!isRecord(value)) return `custom-${index}`;

  const slug = getString(value.slug);
  if (slug) return slug.startsWith("custom-") ? slug : `custom-${slug}`;

  const id = getString(value.id);
  if (id) return `custom-${id}`;

  return `custom-${index}`;
}

function getMimeType(value: JsonRecord): string | null {
  const mimeType = getString(value.mimeType);
  if (mimeType) return mimeType;

  const type = getString(value.type);
  return type?.includes("/") ? type : null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function getNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function appendObjectPath(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

function appendArrayPath(path: string, index: number): string {
  return path ? `${path}[${index}]` : `[${index}]`;
}

function decodePathSegment(value: string | undefined): string {
  if (!value) return "";

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
