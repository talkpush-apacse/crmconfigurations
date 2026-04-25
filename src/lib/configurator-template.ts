import type { CommunicationChannel } from "@/lib/types";

// Item IDs are the only join key between the hardcoded template and stored state.
// Once merged to main, never rename an ID. If an item needs to be replaced, add a
// new ID and leave the old one with `// @deprecated - retained for historical join`.

export type ConfiguratorStatus =
  | "completed"
  | "in_progress"
  | "in_progress_with_dependency"
  | "blocked";

export interface ConfiguratorItemCondition {
  channel?: CommunicationChannel;
  tab?: string;
  featureToggle?: string;
}

export interface ConfiguratorTemplateItem {
  id: string;
  section: string;
  title: string;
  tip?: string;
  contextFields?: Array<{
    label: string;
    path: string;
  }>;
  requires?: ConfiguratorItemCondition;
}

export interface ConfiguratorItemState {
  itemId: string;
  status: ConfiguratorStatus | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
  updatedBy: string | null;
  archived: boolean;
}

export interface ConfiguratorSectionState {
  // exact section name from CONFIGURATOR_TEMPLATE — used as the join key
  section: string;
  configured: boolean;
  configuredAt: string | null;
  configuredBy: string | null;
}

export interface ConfiguratorChecklistBlob {
  items: ConfiguratorItemState[];
  snapshotItemIds: string[];
  // Optional for backwards-compatibility with existing rows in production.
  // Reads must tolerate undefined and treat all sections as not configured.
  sectionStates?: ConfiguratorSectionState[];
  generatedAt: string;
  lastSnapshotAt: string;
}

export const CONFIGURATOR_TEMPLATE: ConfiguratorTemplateItem[] = [
  // Company Settings
  {
    id: "company-basics",
    section: "Company Settings",
    title: "Confirm company name, address, website, privacy policy URL, and primary color are set correctly in Admin → Company Info",
    contextFields: [
      { label: "Company name", path: "companyInfo.companyName" },
      { label: "Address", path: "companyInfo.address" },
      { label: "Website", path: "companyInfo.website" },
      { label: "Privacy policy URL", path: "companyInfo.privacyPolicyUrl" },
      { label: "Primary color", path: "companyInfo.primaryColor" },
    ],
  },
  {
    id: "company-logos",
    section: "Company Settings",
    title: "Upload primary logo, secondary logo, and banner image; verify display on candidate-facing screens",
    tip: "Primary logo should be 200×48px for best display",
  },
  {
    id: "company-email-sender",
    section: "Company Settings",
    title: "Configure default email sender name and reply-to address",
  },
  {
    id: "company-timezone",
    section: "Company Settings",
    title: "Set company timezone and default language",
  },

  // Users & Access
  {
    id: "users-create-accounts",
    section: "Users & Access",
    title: "Create user accounts for each user listed in the Users tab and assign the correct role",
    tip: "Cross-check against the Users tab of the source checklist before creating",
  },
  {
    id: "users-recruitment-center",
    section: "Users & Access",
    title: "Assign each user to the correct recruitment center(s)",
  },
  {
    id: "users-invitations",
    section: "Users & Access",
    title: "Send invitation emails to all created users and confirm they can log in",
  },

  // Sites / Locations
  {
    id: "sites-create",
    section: "Sites / Locations",
    title: "Create all site entries listed in the Sites tab with correct addresses",
    requires: { tab: "sites" },
  },
  {
    id: "sites-attributes",
    section: "Sites / Locations",
    title: "Configure site-level attributes where applicable",
    requires: { tab: "sites" },
  },

  // Sources
  {
    id: "sources-create",
    section: "Sources",
    title: "Create source entries for every source listed in the Sources tab",
    requires: { tab: "sources" },
  },
  {
    id: "sources-utm",
    section: "Sources",
    title: "Configure UTM tracking parameters where applicable",
    requires: { tab: "sources" },
  },
  {
    id: "sources-test",
    section: "Sources",
    title: "Test source attribution with a sample candidate entry per active source",
    requires: { tab: "sources" },
  },

  // Pipeline Stages (Folders)
  {
    id: "folders-create",
    section: "Pipeline Stages (Folders)",
    title: "Create all custom folders in the correct order with correct colors",
    requires: { tab: "folders" },
  },
  {
    id: "folders-default",
    section: "Pipeline Stages (Folders)",
    title: "Confirm the default starting folder for new candidates",
    requires: { tab: "folders" },
  },

  // Candidate Attributes
  {
    id: "attributes-custom",
    section: "Candidate Attributes",
    title: "Create custom candidate attributes based on checklist requirements",
  },

  // Documents
  {
    id: "documents-requirements",
    section: "Documents",
    title: "Configure document collection requirements per document type listed",
    requires: { tab: "documents" },
  },
  {
    id: "documents-ocr",
    section: "Documents",
    title: "Enable OCR mapping for applicable document types",
    requires: { tab: "documents" },
  },

  // Prescreening Questions
  {
    id: "prescreening-create",
    section: "Prescreening Questions",
    title: "Create prescreening question sets per campaign requirement",
    requires: { tab: "prescreening" },
  },
  {
    id: "prescreening-logic",
    section: "Prescreening Questions",
    title: "Configure branching logic and pass/fail criteria",
    requires: { tab: "prescreening" },
  },

  // Message Templates
  {
    id: "templates-sms",
    section: "Message Templates",
    title: "Create SMS message templates per required language",
    requires: { channel: "sms" },
  },
  {
    id: "templates-email",
    section: "Message Templates",
    title: "Create Email message templates per required language",
    requires: { channel: "email" },
  },
  {
    id: "templates-whatsapp",
    section: "Message Templates",
    title: "Create WhatsApp message templates and submit for Meta approval",
    requires: { channel: "whatsapp" },
    tip: "Meta approval typically takes 1–3 business days. Submit early.",
  },

  // Campaigns
  {
    id: "campaigns-create",
    section: "Campaigns",
    title: "Create each campaign listed in the Campaigns tab",
  },
  {
    id: "campaigns-linking",
    section: "Campaigns",
    title: "Link each campaign to the correct folders, sources, and question sets",
  },
  {
    id: "campaigns-recruiters",
    section: "Campaigns",
    title: "Assign recruiters to each campaign (round robin if specified)",
  },
  {
    id: "campaigns-branding",
    section: "Campaigns",
    title: "Configure campaign-specific branding where it differs from company default",
  },
  {
    id: "campaigns-ids",
    section: "Campaigns",
    title: "Record the Talkpush Campaign ID for each campaign back into the source checklist",
  },

  // Autoflows
  {
    id: "autoflows-status-change",
    section: "Autoflows",
    title: "Create autoflows for status change notifications (per folder transition)",
  },
  {
    id: "autoflows-reminders",
    section: "Autoflows",
    title: "Create reminder autoflows for missing or rejected documents",
    requires: { tab: "documents" },
  },
  {
    id: "autoflows-rejection",
    section: "Autoflows",
    title: "Create rejection message autoflows",
  },
  {
    id: "autoflows-test",
    section: "Autoflows",
    title: "Test each autoflow end-to-end with a test candidate",
  },

  // WhatsApp
  {
    id: "whatsapp-business",
    section: "WhatsApp",
    title: "Verify WhatsApp Business Account setup and phone number",
    requires: { channel: "whatsapp" },
  },
  {
    id: "whatsapp-number",
    section: "WhatsApp",
    title: "Confirm WhatsApp number is connected in Talkpush admin",
    requires: { channel: "whatsapp" },
  },
  {
    id: "whatsapp-test",
    section: "WhatsApp",
    title: "Send a test WhatsApp message to confirm delivery",
    requires: { channel: "whatsapp" },
  },

  // Facebook
  {
    id: "facebook-page-connect",
    section: "Facebook",
    title: "Connect Facebook Page to Talkpush",
    requires: { channel: "facebook" },
    contextFields: [
      { label: "Facebook Page", path: "fbWhatsapp.facebookPageName" },
      { label: "Page URL", path: "fbWhatsapp.facebookPageUrl" },
    ],
  },
  {
    id: "facebook-autoreply",
    section: "Facebook",
    title: "Configure Facebook auto-reply for page messages",
    requires: { channel: "facebook" },
  },
  {
    id: "facebook-test",
    section: "Facebook",
    title: "Test Facebook Messenger flow end-to-end with a live message",
    requires: { channel: "facebook" },
  },

  // Instagram
  {
    id: "instagram-connect",
    section: "Instagram",
    title: "Connect Instagram business account to Talkpush",
    requires: { channel: "instagram" },
    contextFields: [
      { label: "Instagram handle", path: "instagram.handle" },
    ],
  },
  {
    id: "instagram-autoreply",
    section: "Instagram",
    title: "Configure Instagram auto-reply for direct messages",
    requires: { channel: "instagram" },
  },
  {
    id: "instagram-test",
    section: "Instagram",
    title: "Test Instagram message flow end-to-end",
    requires: { channel: "instagram" },
  },

  // AI Call / Voice AI
  {
    id: "aicall-agent",
    section: "AI Call / Voice AI",
    title: "Create voice AI agent and configure persona, voice, and language",
    requires: { tab: "aiCallFaqs" },
  },
  {
    id: "aicall-faqs",
    section: "AI Call / Voice AI",
    title: "Upload FAQ content into voice AI knowledge base",
    requires: { tab: "aiCallFaqs" },
  },
  {
    id: "aicall-flow",
    section: "AI Call / Voice AI",
    title: "Configure call flow, triggers, and escalation rules",
    requires: { tab: "aiCallFaqs" },
  },
  {
    id: "aicall-test",
    section: "AI Call / Voice AI",
    title: "Place test calls and verify transcription + AI response quality",
    requires: { tab: "aiCallFaqs" },
  },

  // Agency Portal
  {
    id: "agency-accounts",
    section: "Agency Portal",
    title: "Create agency user accounts from the Agency Portal Users list",
    requires: { tab: "agencyPortal" },
  },
  {
    id: "agency-permissions",
    section: "Agency Portal",
    title: "Configure agency portal permissions and folder access per agency",
    requires: { tab: "agencyPortal" },
  },
  {
    id: "agency-test",
    section: "Agency Portal",
    title: "Test agency user login and candidate submission flow",
    requires: { tab: "agencyPortal" },
  },

  // Duplicate Management
  {
    id: "dedup-config",
    section: "Duplicate Management",
    title: "Configure duplicate detection rules (phone, email, ID number)",
  },
  {
    id: "dedup-test",
    section: "Duplicate Management",
    title: "Test duplicate handling with a sample duplicate submission",
  },

  // Pre-launch UAT
  {
    id: "uat-e2e",
    section: "Pre-launch UAT",
    title: "End-to-end candidate journey test from source through to hire folder",
  },
  {
    id: "uat-autoflows",
    section: "Pre-launch UAT",
    title: "Verify every autoflow triggers correctly in production config",
  },
  {
    id: "uat-client-signoff",
    section: "Pre-launch UAT",
    title: "Walk through configuration with client stakeholder and obtain sign-off",
  },
];
