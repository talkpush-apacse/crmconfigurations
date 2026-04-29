import { z } from "zod";
import { TAB_CONFIG } from "@/lib/tab-config";
import type { ChecklistJsonField } from "@/lib/types";

const ownerEmailSchema = z.string().email();

export const NOTIFIABLE_TAB_FIELDS = [
  "companyInfo",
  "users",
  "campaigns",
  "sites",
  "prescreening",
  "messaging",
  "sources",
  "folders",
  "documents",
  "fbWhatsapp",
  "instagram",
  "aiCallFaqs",
  "agencyPortal",
] as const satisfies readonly ChecklistJsonField[];

const NOTIFIABLE_TAB_FIELD_SET = new Set<string>(NOTIFIABLE_TAB_FIELDS);

export function isNotifiableTabField(field: string): field is (typeof NOTIFIABLE_TAB_FIELDS)[number] {
  return NOTIFIABLE_TAB_FIELD_SET.has(field);
}

export function normalizeOwnerEmail(value: unknown): { value: string | null; error?: string } {
  if (value === undefined || value === null || value === "") {
    return { value: null };
  }

  if (typeof value !== "string") {
    return { value: null, error: "Owner email must be a valid email address" };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { value: null };
  }

  const parsed = ownerEmailSchema.safeParse(trimmed);
  if (!parsed.success) {
    return { value: null, error: "Owner email must be a valid email address" };
  }

  return { value: parsed.data.toLowerCase() };
}

export function getNotificationTabMeta(tabId: string): {
  slug: string;
  label: string;
  displayName: string;
} | null {
  const tab = TAB_CONFIG.find((entry) => entry.dataKey === tabId);
  if (!tab) return null;

  return {
    slug: tab.slug,
    label: tab.label,
    displayName: `${tab.label} tab`,
  };
}

export function buildClientTabUrl(baseUrl: string, checklistSlug: string, tabId: string): string | null {
  const tab = getNotificationTabMeta(tabId);
  if (!tab) return null;

  const trimmedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmedBaseUrl) return null;

  return `${trimmedBaseUrl}/client/${checklistSlug}/${tab.slug}`;
}
