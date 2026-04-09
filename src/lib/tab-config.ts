import type { ChecklistJsonField, CustomTab } from "./types";

export interface TabConfig {
  slug: string;
  label: string;
  dataKey: ChecklistJsonField | null;
  icon: string;
  adminOnly?: boolean;
  customTabId?: string;
}

export const TAB_CONFIG: TabConfig[] = [
  { slug: "welcome", label: "Welcome", dataKey: null, icon: "Home" },
  { slug: "company-info", label: "Company Information", dataKey: "companyInfo", icon: "Building2" },
  { slug: "users", label: "User List", dataKey: "users", icon: "Users" },
  { slug: "campaigns", label: "Campaigns List", dataKey: "campaigns", icon: "Megaphone" },
  { slug: "sites", label: "Sites", dataKey: "sites", icon: "MapPin" },
  { slug: "prescreening", label: "Pre-Screening Questions", dataKey: "prescreening", icon: "HelpCircle" },
  { slug: "messaging", label: "Messaging Templates", dataKey: "messaging", icon: "MessageSquare" },
  { slug: "sources", label: "Sources", dataKey: "sources", icon: "Link" },
  { slug: "folders", label: "Folders", dataKey: "folders", icon: "Folder" },
  { slug: "documents", label: "Document Collection", dataKey: "documents", icon: "FileText" },
  { slug: "attributes", label: "Attributes", dataKey: "attributes", icon: "Tags" },
  { slug: "facebook-whatsapp", label: "Facebook & WhatsApp", dataKey: "fbWhatsapp", icon: "MessagesSquare" },
  { slug: "instagram", label: "Instagram Chatbot", dataKey: "instagram", icon: "Camera" },
  { slug: "ai-call-faqs", label: "AI Call", dataKey: "aiCallFaqs", icon: "Phone" },
  { slug: "rejection-reasons", label: "Rejection Reasons", dataKey: "rejectionReasons", icon: "ThumbsDown" },
  { slug: "agency-portal", label: "Agency Portal", dataKey: "agencyPortal", icon: "Briefcase" },
  { slug: "admin-settings", label: "Admin Settings", dataKey: "adminSettings", icon: "Shield", adminOnly: true },
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
export function getEnabledTabs(
  enabledTabSlugs: string[] | null | undefined,
  includeAdminTabs = false,
  tabOrder?: string[] | null,
  customTabs?: CustomTab[] | null,
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
