export interface TabConfig {
  slug: string;
  label: string;
  dataKey: string | null;
  icon: string;
}

export const TAB_CONFIG: TabConfig[] = [
  { slug: "welcome", label: "Welcome", dataKey: null, icon: "Home" },
  { slug: "company-info", label: "Company Information", dataKey: "companyInfo", icon: "Building2" },
  { slug: "users", label: "User List", dataKey: "users", icon: "Users" },
  { slug: "campaigns", label: "Campaigns List", dataKey: "campaigns", icon: "Megaphone" },
  { slug: "sites", label: "Sites", dataKey: "sites", icon: "MapPin" },
  { slug: "prescreening", label: "Pre-screening & Follow-up", dataKey: "prescreening", icon: "HelpCircle" },
  { slug: "messaging", label: "Messaging Templates", dataKey: "messaging", icon: "MessageSquare" },
  { slug: "sources", label: "Sources", dataKey: "sources", icon: "Link" },
  { slug: "folders", label: "Folders", dataKey: "folders", icon: "Folder" },
  { slug: "documents", label: "Document Collection", dataKey: "documents", icon: "FileText" },
  { slug: "facebook-whatsapp", label: "Facebook & WhatsApp", dataKey: "fbWhatsapp", icon: "MessagesSquare" },
  { slug: "instagram", label: "Instagram Chatbot", dataKey: "instagram", icon: "Camera" },
  { slug: "ai-call-faqs", label: "AI Call", dataKey: "aiCallFaqs", icon: "Phone" },
  { slug: "agency-portal", label: "Agency Portal", dataKey: "agencyPortal", icon: "Briefcase" },
];

export function getTabBySlug(slug: string): TabConfig | undefined {
  return TAB_CONFIG.find((tab) => tab.slug === slug);
}

// Tabs that are always included regardless of selection
export const ALWAYS_ENABLED_SLUGS = ["welcome"];

// Tabs that can be toggled by admin
export const SELECTABLE_TABS = TAB_CONFIG.filter(
  (tab) => !ALWAYS_ENABLED_SLUGS.includes(tab.slug)
);

// Get all selectable tab slugs (for default "all selected")
export function getAllSelectableTabSlugs(): string[] {
  return SELECTABLE_TABS.map((tab) => tab.slug);
}

// Filter TAB_CONFIG to only enabled tabs
export function getEnabledTabs(enabledTabSlugs: string[] | null | undefined): TabConfig[] {
  if (!enabledTabSlugs) return TAB_CONFIG; // null/undefined means all enabled
  const enabledSet = new Set([...ALWAYS_ENABLED_SLUGS, ...enabledTabSlugs]);
  return TAB_CONFIG.filter((tab) => enabledSet.has(tab.slug));
}
