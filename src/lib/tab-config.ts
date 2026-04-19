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
  { slug: "admin-settings", label: "Admin Settings", dataKey: "adminSettings", icon: "Shield", filledBy: "talkpush", adminOnly: true },
  { slug: "autoflows", label: "Autoflows", dataKey: "autoflows", icon: "Zap", filledBy: "talkpush", adminOnly: true },
];

export function getTabBySlug(slug: string): TabConfig | undefined {
  return TAB_CONFIG.find((tab) => tab.slug === slug);
}

// Tabs that are always included regardless of selection
export const ALWAYS_ENABLED_SLUGS = ["welcome"];

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
