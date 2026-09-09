import type { ChecklistJsonField, CustomTab } from "./types";

export type FilledBy = "talkpush" | "client";

export interface TabConfig {
  slug: string;
  label: string;
  dataKey: ChecklistJsonField | null;
  icon: string;
  filledBy: FilledBy;
  adminOnly?: boolean;
  customTabId?: string;
}

export const TAB_CONFIG: TabConfig[] = [
  { slug: "welcome", label: "Welcome", dataKey: null, icon: "Home", filledBy: "client" },
  { slug: "company-info", label: "Company Information", dataKey: "companyInfo", icon: "Building2", filledBy: "client" },
  { slug: "users", label: "User List", dataKey: "users", icon: "Users", filledBy: "client" },
  { slug: "campaigns", label: "Campaigns List", dataKey: "campaigns", icon: "Megaphone", filledBy: "talkpush" },
  { slug: "sites", label: "Sites", dataKey: "sites", icon: "MapPin", filledBy: "client" },
  { slug: "prescreening", label: "Pre-Screening Questions", dataKey: "prescreening", icon: "HelpCircle", filledBy: "client" },
  { slug: "messaging", label: "Messaging Templates", dataKey: "messaging", icon: "MessageSquare", filledBy: "client" },
  { slug: "sources", label: "Sources", dataKey: "sources", icon: "Link", filledBy: "client" },
  { slug: "folders", label: "Folders", dataKey: "folders", icon: "Folder", filledBy: "talkpush" },
  { slug: "documents", label: "Document Collection", dataKey: "documents", icon: "FileText", filledBy: "client" },
  { slug: "attributes", label: "Attributes", dataKey: "attributes", icon: "Tags", filledBy: "talkpush" },
  { slug: "facebook-whatsapp", label: "Facebook & WhatsApp", dataKey: "fbWhatsapp", icon: "MessagesSquare", filledBy: "client" },
  { slug: "instagram", label: "Instagram Chatbot", dataKey: "instagram", icon: "Camera", filledBy: "client" },
  { slug: "ai-call-faqs", label: "AI Call", dataKey: "aiCallFaqs", icon: "Phone", filledBy: "client" },
  { slug: "rejection-reasons", label: "Rejection Reasons", dataKey: "rejectionReasons", icon: "ThumbsDown", filledBy: "client" },
  { slug: "agency-portal", label: "Agency Portal", dataKey: "agencyPortal", icon: "Briefcase", filledBy: "client" },
  // Talkpush-filled, so the client-facing checklist hides it (see
  // excludeTalkpushTabs). Labels are an internal CRM concern, not something
  // the client is being asked to supply.
  { slug: "labels", label: "Labels", dataKey: "labels", icon: "Tags", filledBy: "talkpush" },
  { slug: "admin-settings", label: "Admin Settings", dataKey: "adminSettings", icon: "Shield", filledBy: "talkpush", adminOnly: true },
  { slug: "autoflows", label: "Autoflows", dataKey: "autoflows", icon: "Zap", filledBy: "talkpush", adminOnly: true },
  { slug: "integrations", label: "Integrations", dataKey: "integrations", icon: "PlugZap", filledBy: "talkpush", adminOnly: true },
];

export function getTabBySlug(slug: string): TabConfig | undefined {
  return TAB_CONFIG.find((tab) => tab.slug === slug);
}

// Tabs that are always included regardless of selection.
//
// `labels` is here because it is Talkpush-internal and was added after every
// existing checklist was created: no checklist has it in `enabledTabs`, so
// without this it would be invisible everywhere — including to Talkpush. Being
// Talkpush-filled, excludeTalkpushTabs still keeps it out of the client view.
export const ALWAYS_ENABLED_SLUGS = ["welcome", "labels"];

// Tabs that can be toggled by admin (excludes always-enabled and admin-only tabs)
export const SELECTABLE_TABS = TAB_CONFIG.filter(
  (tab) => !ALWAYS_ENABLED_SLUGS.includes(tab.slug) && !tab.adminOnly
);

// Get all selectable tab slugs (for default "all selected")
export function getAllSelectableTabSlugs(): string[] {
  return SELECTABLE_TABS.map((tab) => tab.slug);
}

// Convert custom tabs to TabConfig entries
export function getCustomTabConfigs(customTabs: CustomTab[] | null | undefined): TabConfig[] {
  if (!customTabs || customTabs.length === 0) return [];
  return customTabs.map((ct) => ({
    slug: `custom-${ct.slug}`,
    label: ct.label,
    dataKey: null,
    icon: ct.icon || "FileText",
    filledBy: "client" as FilledBy,
    customTabId: ct.id,
  }));
}

// Find a custom tab by its prefixed slug
export function getCustomTabBySlug(
  slug: string,
  customTabs: CustomTab[] | null | undefined,
): CustomTab | undefined {
  if (!slug.startsWith("custom-") || !customTabs) return undefined;
  const tabSlug = slug.slice("custom-".length);
  return customTabs.find((ct) => ct.slug === tabSlug);
}

// Filter TAB_CONFIG to only enabled tabs (excludes admin-only tabs by default)
// When tabOrder is provided, reorder the result to match.
// When customTabs is provided, append them after standard tabs.
// When tabFilledByOverrides is provided, each tab's filledBy is overridden per-slug.
export function getEnabledTabs(
  enabledTabSlugs: string[] | null | undefined,
  includeAdminTabs = false,
  tabOrder?: string[] | null,
  customTabs?: CustomTab[] | null,
  tabFilledByOverrides?: Record<string, FilledBy> | null,
): TabConfig[] {
  let tabs = TAB_CONFIG;
  if (!includeAdminTabs) {
    tabs = tabs.filter((tab) => !tab.adminOnly);
  }
  if (enabledTabSlugs) {
    const enabledSet = new Set([...ALWAYS_ENABLED_SLUGS, ...enabledTabSlugs]);
    // Admin-only tabs are always included when includeAdminTabs is true (not controlled by enabledTabs)
    tabs = tabs.filter((tab) => tab.adminOnly || enabledSet.has(tab.slug));
  }

  // Append custom tabs
  const customConfigs = getCustomTabConfigs(customTabs);
  let allTabs = [...tabs, ...customConfigs];

  // Apply per-checklist filledBy overrides
  if (tabFilledByOverrides) {
    allTabs = allTabs.map((tab) => {
      const override = tabFilledByOverrides[tab.slug];
      return override ? { ...tab, filledBy: override } : tab;
    });
  }

  // Apply custom ordering if provided
  if (tabOrder && tabOrder.length > 0) {
    const slugIndex = new Map(tabOrder.map((slug, i) => [slug, i]));
    allTabs = allTabs.sort((a, b) => {
      const ai = slugIndex.get(a.slug) ?? Infinity;
      const bi = slugIndex.get(b.slug) ?? Infinity;
      return ai - bi;
    });
  }

  return allTabs;
}

// ===== Custom tab slug helpers =====
//
// Shared by the admin UI and the spreadsheet importer so both apply the same
// rule as the MCP `add_custom_tab` tool.

/** Slugs owned by the standard tabs — a custom tab must not shadow one. */
const FIXED_TAB_SLUGS = new Set(TAB_CONFIG.map((t) => t.slug));

export function customTabSlugFromLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Returns a human-readable reason the slug can't be used, or null when it's
 * free. `ignoreTabId` lets an existing tab keep its own slug while editing.
 */
export function customTabSlugConflict(
  slug: string,
  existingTabs: CustomTab[] | null | undefined,
  ignoreTabId?: string,
): string | null {
  if (!slug) return null;
  if (FIXED_TAB_SLUGS.has(slug)) {
    return "That name collides with a standard tab. Choose a different name.";
  }
  const clash = (existingTabs ?? []).some(
    (t) => t.slug === slug && t.id !== ignoreTabId,
  );
  if (clash) return "A custom tab with that name already exists.";
  return null;
}

// ===== Client-facing visibility =====

/**
 * Tabs Talkpush fills in are hidden from the client-facing checklist.
 *
 * A client filling out the form should only see what is actually being asked
 * of them; the Talkpush-side tabs are working notes for the SE. They stay
 * visible in the editor and admin views.
 *
 * Pass tabs that already carry their per-checklist `filledBy` overrides —
 * i.e. the output of `getEnabledTabs` with `tabFilledByOverrides` supplied —
 * otherwise this filters on the defaults and will disagree with the sidebar.
 */
export function excludeTalkpushTabs(tabs: TabConfig[]): TabConfig[] {
  return tabs.filter((tab) => tab.filledBy !== "talkpush");
}

/** True for the client-facing checklist route, which hides Talkpush tabs. */
export function isClientView(basePath: string | null | undefined): boolean {
  return !!basePath && basePath.startsWith("/client/");
}
