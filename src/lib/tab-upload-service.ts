import "server-only";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendOwnerNotification } from "@/lib/email";
import { buildClientTabUrl, getNotificationTabMeta } from "@/lib/notifications";
import { supabase, STORAGE_BUCKET } from "@/lib/supabase";
import { getCustomFieldKey, validateFileValue } from "@/lib/custom-tab-service";
import type { CustomTab } from "@/lib/types";
import {
  MAX_UPLOAD_BYTES,
  TAB_UPLOAD_FOLDER,
  buildTabUploadPath,
  checkTabUploadFile,
  isBlockedFile,
  isTabUploadPath,
} from "@/lib/upload-rules";

/**
 * Tab uploads in two steps, so a file never passes through the web server (Vercel stops request bodies at about 4.5 MB):
 *   1. ticket   - check who is asking and what the file is, hand back a one-off storage address.
 *   2. (browser sends the bytes straight to storage)
 *   3. complete - confirm the file really arrived and is within the limit, then notify the checklist owner.
 *
 * Access rules are the same as POST /api/upload: an admin cookie, or a valid editor token / client slug.
 */

export class UploadError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const context = {
  fileName: z.string().trim().min(1).max(255),
  tabKey: z.string().max(100).optional().default(""),
  editorToken: z.string().max(200).optional().default(""),
  slug: z.string().max(200).optional().default(""),
  customTabId: z.string().max(200).optional().default(""),
  fieldKey: z.string().max(200).optional().default(""),
};
const ticketSchema = z.object({
  ...context,
  size: z.number().int().positive(),
  mimeType: z.string().max(200).optional().default(""),
});
const completeSchema = z.object({
  ...context,
  path: z.string().max(400),
  mimeType: z.string().max(200).optional().default(""),
});

type Checklist = {
  slug: string;
  clientName: string;
  ownerEmail: string | null;
  customTabs: unknown;
};

function storage() {
  if (!supabase) {
    throw new UploadError("File uploads not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.", 503);
  }
  return supabase.storage.from(STORAGE_BUCKET);
}

async function authorize(
  request: NextRequest,
  input: { editorToken: string; slug: string }
): Promise<{ isAdmin: boolean; checklist: Checklist | null }> {
  const adminCookie = request.cookies.get("admin_token")?.value;
  const isAdmin = !!adminCookie && !!verifyToken(adminCookie);

  if (!isAdmin && !input.editorToken && !input.slug) {
    throw new UploadError("Authentication required", 401);
  }

  const select = { slug: true, clientName: true, ownerEmail: true, customTabs: true } as const;
  const checklist = input.editorToken
    ? await prisma.checklist.findUnique({ where: { editorToken: input.editorToken }, select })
    : input.slug
      ? await prisma.checklist.findUnique({ where: { slug: input.slug }, select })
      : null;

  if (!isAdmin && !checklist) throw new UploadError("Invalid or expired link", 401);
  return { isAdmin, checklist };
}

/** Same rule as the old route: a custom file field must exist on this checklist and accept this file. */
function checkCustomField(
  checklist: Checklist | null,
  input: { customTabId: string; fieldKey: string },
  file: { fileName: string; mimeType: string; size: number }
) {
  if (!input.customTabId || !input.fieldKey) return;
  const customTabs = (checklist?.customTabs ?? []) as unknown as CustomTab[];
  const customTab = customTabs.find((tab) => tab.id === input.customTabId);
  const field = customTab?.fields?.find((candidate) => getCustomFieldKey(candidate) === input.fieldKey);
  if (!customTab || !field || field.type !== "file") {
    throw new UploadError("Custom file field not found for this checklist.", 400);
  }
  const errors = validateFileValue(field, { ...file, url: "https://pending-upload.local/file", uploadedAt: new Date().toISOString() });
  if (errors.length > 0) throw new UploadError(errors.join(" "), 400);
}

/** Step 1. */
export async function createTabUploadTicket(request: NextRequest, rawInput: unknown) {
  const input = ticketSchema.parse(rawInput);
  const { checklist } = await authorize(request, input);

  const problem = checkTabUploadFile(input.fileName, input.size, input.mimeType);
  if (problem) throw new UploadError(problem, 400);
  checkCustomField(checklist, input, { fileName: input.fileName, mimeType: input.mimeType, size: input.size });

  const path = buildTabUploadPath(input.fileName, randomUUID());
  const { data, error } = await storage().createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[tab upload] signed upload link failed:", error?.message);
    throw new UploadError("Could not start the upload. Please try again.", 502);
  }
  return { path, signedUrl: data.signedUrl };
}

/** Step 3. Returns the same shape the old POST /api/upload returned. */
export async function completeTabUpload(request: NextRequest, rawInput: unknown) {
  const input = completeSchema.parse(rawInput);
  const { isAdmin, checklist } = await authorize(request, input);

  if (!isTabUploadPath(input.path)) throw new UploadError("That file is not a tab upload.", 400);
  const bucket = storage();

  const name = input.path.slice(TAB_UPLOAD_FOLDER.length + 1);
  const { data: found, error } = await bucket.list(TAB_UPLOAD_FOLDER, { search: name, limit: 20 });
  if (error) {
    console.error("[tab upload] storage lookup failed:", error.message);
    throw new UploadError("Could not confirm the upload. Please try again.", 502);
  }
  const object = (found ?? []).find((o) => o.name === name);
  if (!object) throw new UploadError("The upload did not finish. Please try again.", 400);

  // What storage holds is the truth about the size, not what the browser said at step 1.
  const size = Number((object.metadata as { size?: number } | null)?.size ?? 0);
  const mimeType = input.mimeType || String((object.metadata as { mimetype?: string } | null)?.mimetype ?? "");
  const reject = async (message: string): Promise<never> => {
    await bucket.remove([input.path]);
    throw new UploadError(message, 400);
  };
  if (size > MAX_UPLOAD_BYTES) await reject("File too large. Maximum size is 10 MB.");
  if (isBlockedFile(input.fileName, mimeType)) await reject("Executable (.exe) files can't be uploaded.");
  try {
    checkCustomField(checklist, input, { fileName: input.fileName, mimeType, size });
  } catch (err) {
    if (err instanceof UploadError) await reject(err.message);
    throw err;
  }

  const { data: urlData } = bucket.getPublicUrl(input.path);

  if (!isAdmin && checklist?.ownerEmail && input.tabKey) {
    const tabMeta = getNotificationTabMeta(input.tabKey);
    const tabUrl = buildClientTabUrl(process.env.APP_BASE_URL ?? "", checklist.slug, input.tabKey);
    if (tabMeta && tabUrl) {
      const emailResult = await sendOwnerNotification({
        to: checklist.ownerEmail,
        clientName: checklist.clientName,
        tabDisplayName: tabMeta.displayName,
        tabUrl,
        updateType: "File uploaded",
        summary: `Uploaded ${input.fileName}`,
      });
      if (!emailResult.ok) {
        console.error("[notifications] upload email failed", { slug: checklist.slug, tabKey: input.tabKey, error: emailResult.error });
      }
    }
  }

  return {
    url: urlData.publicUrl,
    fileName: input.fileName,
    mimeType,
    size,
    uploadedAt: new Date().toISOString(),
  };
}
