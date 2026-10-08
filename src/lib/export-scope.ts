import type { CustomTab } from "./types";
import { getEnabledTabs, getTabBySlug, type FilledBy, type TabConfig } from "./tab-config";

/**
 * "Export this page only": which Excel sheets belong to which checklist tab.
 *
 * Safe to import from the browser (it has no server code), so the header can grey
 * out the option for a tab that has no sheet while the server uses the same list
 * to decide what to keep.
 *
 * Each tab lists every sheet name it can appear under. The branded template and the
 * plain fallback workbook name a few sheets differently ("Campaigns List" vs
 * "Campaigns"), so both spellings are here. A tab not listed has no sheet in the
 * workbook today (Welcome, Facebook & WhatsApp, Instagram, Rejection Reasons,
 * Labels, Admin Settings), and "this page" is not offered for it, because the
 * file would be empty or just the template's blank guidance sheet.
 */
const SHEETS_BY_TAB_SLUG: Record<string, readonly string[]> = {
  "company-info": ["Company Information"],
  users: ["User List"],
  campaigns: ["Campaigns List", "Campaigns"],
  sites: ["Sites"],
  prescreening: ["Pre-screening & Follow-up Quest", "Pre-screening Questions"],
  messaging: ["Messaging Templates"],
  sources: ["Sources"],
  folders: ["Folders"],
  documents: ["Document Collection"],
  attributes: ["Attributes"],
  "ai-call-faqs": ["AI Call FAQs", "AI Call", "AI Call Settings"],
  "agency-portal": ["Agency Portal", "Agency Portal Users"],
  autoflows: ["Autoflows"],
  integrations: ["Integrations"],
};

export const CUSTOM_TAB_PREFIX = "custom-";

/** Sheet names a standard tab can be exported under, or null when it has none (custom tabs are handled separately). */
export function sheetNamesForTab(slug: string): readonly string[] | null {
  return Object.hasOwn(SHEETS_BY_TAB_SLUG, slug) ? SHEETS_BY_TAB_SLUG[slug] : null;
}

/** True when "this page only" can be offered for the tab. For custom tabs the server still checks the tab has something to export. */
export function canExportTab(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return slug.startsWith(CUSTOM_TAB_PREFIX) || Object.hasOwn(SHEETS_BY_TAB_SLUG, slug);
}

/**
 * Whether the header should offer "this page only" for the tab being viewed.
 * An editor link never gets the admin-only tabs (Autoflows, Integrations), the
 * same rule the server applies, so the menu never offers what the server refuses.
 */
export function canOfferPageExport(slug: string | null | undefined, audience: ExportAudience): boolean {
  if (!canExportTab(slug)) return false;
  return !(audience === "editor" && getTabBySlug(slug as string)?.adminOnly);
}

/** Who is asking. Decides which tabs they are allowed to ask for. */
export type ExportAudience =
  /** Signed-in staff. Sees every tab turned on for the checklist, Talkpush-only tabs included. */
  | "staff"
  /** An editor link. Sees the same tabs as the page does, minus the admin-only ones. */
  | "editor";

export interface ExportTabSource {
  enabledTabs?: string[] | null;
  tabOrder?: string[] | null;
  customTabs?: unknown;
  tabFilledBy?: unknown;
}

/**
 * The tab the caller asked for, but only if that caller can see it on screen.
 * The editor-link download is public (the link is the only protection), so "any
 * slug" must never be accepted: asking for `autoflows` through an editor link
 * would otherwise hand over a Talkpush-only tab.
 */
export function resolveExportTab(
  source: ExportTabSource,
  slug: string,
  audience: ExportAudience
): TabConfig | null {
  if (!canExportTab(slug)) return null;
  const tabs = getEnabledTabs(
    source.enabledTabs ?? null,
    audience === "staff",
    source.tabOrder ?? null,
    (source.customTabs as CustomTab[] | null | undefined) ?? null,
    (source.tabFilledBy as Record<string, FilledBy> | null | undefined) ?? null
  );
  return tabs.find((t) => t.slug === slug) ?? null;
}

/** "Sites" -> "Sites", "Pre-Screening Questions" -> "Pre-Screening_Questions". Safe inside a file name. */
export function fileNamePart(text: string): string {
  return text.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/** A user-facing reason, used when this page can't be exported. */
export const NO_PAGE_EXPORT_REASON = "This page isn't in the Excel export yet. Use Entire checklist.";
