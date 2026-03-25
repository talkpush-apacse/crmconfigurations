// ===== Roles =====
export const ROLES = ["ADMIN", "EDITOR", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

// ===== Company Information =====
export interface CompanyInfo {
  // Company Details
  companyName: string;
  companyAddress: string;
  companyWebsiteUrl: string;
  privacyPolicyUrl: string;
  companyDescription: string;
  // Facebook Details
  fbPageName: string;
  fbPageId: string;
  fbPageUrl: string;
  fbPagePocName: string;
  fbPagePocEmail: string;
  // Company Branding Assets
  logoUrl: string;
  logoSecondaryUrl: string;
  companyColor: string;
  bannerImageUrl: string;
  bannerImageLargeUrl: string;
  // Recruitment Process
  allowDuplicates: string;
  coolingPeriod: string;
  rehiresAllowed: string;
}

// ===== User List =====
export interface UserRow {
  id: string;
  name: string;
  accessType: string;
  jobTitle: string;
  email: string;
  phone: string;
  site: string;
  reportsTo: string;
  stage: string;
  comments: string;
}

// ===== Campaigns List =====
export interface CampaignRow {
  id: string;
  nameInternal: string;
  jobTitleExternal: string;
  site: string;
  jobDescription: string;
  googleMapsLink: string;
  zoomLink: string;
  comments: string;
}

// ===== Sites =====
export interface SiteRow {
  id: string;
  siteName: string;
  internalName: string;
  interviewHours: string;
  interviewType: string;
  fullAddress: string;
  documentsToRring: string;
  googleMapsLink: string;
  comments: string;
}

// ===== Pre-screening & Follow-up Questions =====
export interface QuestionRow {
  id: string;
  category: string;
  question: string;
  questionType: string;
  answerOptions: string;
  applicableCampaigns: string;
  autoReject: string;
  rejectCondition: string;
  rejectReason: string;
  comments: string;
}

// ===== Messaging Templates =====
export interface MessagingTemplateRow {
  id: string;
  name: string;
  purpose: string;
  language: string;
  folder: string;
  emailTemplate: string;
  emailActive: boolean;
  smsTemplate: string;
  smsActive: boolean;
  whatsappTemplate: string;
  whatsappActive: boolean;
  messengerTemplate: string;
  messengerActive: boolean;
  comments: string;
}

// ===== Sources =====
export interface SourceRow {
  id: string;
  category: string;
  subcategory: string;
  link: string;
  comments: string;
}

// ===== Folders =====
export interface FolderRow {
  id: string;
  folderName: string;
  description: string;
  movementType: string;
  comments: string;
}

// ===== Document Collection =====
export interface DocumentRow {
  id: string;
  documentName: string;
  applicableCandidates: string;
  required: string;
  blankTemplateLink: string;
  applicableCampaigns: string;
  accessPermissions: string;
  folder: string;
  comments: string;
}

// ===== Facebook Messenger and WhatsApp =====
export interface FbWhatsappData {
  phoneNumber: string;
  businessManagerAccess: string;
  businessVerification: string;
  chatbotName: string;
  chatbotPersona: string;
  faqs: FaqEntry[];
}

// ===== Instagram Chatbot =====
export interface InstagramData {
  instagramAccount: string;
  twoFactorAuth: string;
  businessAccountConnection: string;
  chatbotName: string;
  chatbotPersona: string;
  faqs: FaqEntry[];
}

// ===== AI Call =====
export interface AiCallFaqRow {
  id: string;
  faq: string;
  example: string;
  faqResponse: string;
}

export interface AiCallData {
  measureEnglish: boolean;
  gender: string;
  preferredVoice: string;
  callType: string;
  interviewRole: string;
  interviewQuestions: string;
  faqs: AiCallFaqRow[];
}

// ===== Agency Portal =====
export interface AgencyPortalRow {
  id: string;
  agencyName: string;
  contactName: string;
  email: string;
  phone: string;
  country: string;
  comments: string;
}

// ===== Communication Channels =====
export interface CommunicationChannels {
  email: boolean;
  sms: boolean;
  messenger: boolean;
  whatsapp: boolean;
  liveCall: boolean;
  aiCalls: boolean;
}

// ===== Feature Toggles =====
export interface FeatureToggles {
  aiCallVoiceSelection: boolean;
}

// ===== Shared =====
export interface FaqEntry {
  id: string;
  category: string;
  faq: string;
  description: string;
  example: string;
  faqResponse: string;
}

// ===== Business Hours Entry =====
export interface BusinessHourEntry {
  day: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
}

// ===== Admin Settings =====
export interface AdminSettingsData {
  // Basic Company Info
  companyName: string;
  companySubdomain: string;
  region: string;
  status: string;
  companyLogo: string;
  defaultCountry: string;
  timeZone: string;
  // Campaign & SMS Settings
  catchAllCampaign: string;
  telerivetProjectId: string;
  inboundSmsHotline: string;
  inboundNexmoSms: string;
  twilioInboundSms: string;
  chatInboundNumber: string;
  numberOfAllowedUsers: string;
  // Feature Checkboxes
  transcript: boolean;
  autoCall: boolean;
  liveCall: boolean;
  messengerIntegration: boolean;
  smsOptOut: boolean;
  recruitmentCenterScheduling: boolean;
  pushMessages: boolean;
  requireWhatsAppOptin: boolean;
  myCalendar: boolean;
  allowDisableReschedule: boolean;
  expireApplicationOnCoolingPeriod: boolean;
  autoflow: boolean;
  talkpushOnboard: boolean;
  ocr: boolean;
  autoListJobCampaigns: boolean;
  autoDeleteOldLeads: boolean;
  geolocation: boolean;
  autoflowInbox: boolean;
  persistentPrivacyPolicyLink: boolean;
  cookiesBannerNotification: boolean;
  mandatoryRejectionReasons: boolean;
  mandatoryShortlistedReasons: boolean;
  talkScore: boolean;
  talkScoreWeightDistribution: boolean;
  applicantScoring: boolean;
  customizableTalkScore: boolean;
  tecolocoIntegration: boolean;
  csvUpdate: boolean;
  allowLimitedManagersSelfAssign: boolean;
  recognitionExtractionValidation: boolean;
  landingPageRealtimeFeedback: boolean;
  documentProcessingMistral: boolean;
  autoflowSets: boolean;
  mandatoryEmailAndPhone: boolean;
  templateCampaigns: boolean;
  talkScoreReadingDetection: boolean;
  overrideUnsubscribeCommand: boolean;
  enableAutomaticGtmInsertion: boolean;
  emailPreferenceManagement: boolean;
  // Integration / Credentials
  googleTagManagerContainerId: string;
  tecolocoUsername: string;
  tecolocoPassword: string;
  elevenLabsWebhookSecret: string;
  aiBotOpenAiKey: string;
  cookiebotScript: string;
  // Network / Security
  accountDomainWhitelist: string;
  ipWhitelist: string;
  // Employee Referral Program (ERP)
  erpLinkGeneration: boolean;
  erpAllowedEmailDomains: string;
  erpAttributionLogic: string;
  enableCustomFields: boolean;
  enableOnScreenLink: boolean;
  requireEmailField: boolean;
  requireEmployeeIdField: boolean;
  enableSendingLinkToEmail: boolean;
  erpEmailCompanyLogo: string;
  // Business Hours
  businessHours: BusinessHourEntry[];
}

// ===== Checklist Data (full) =====
export interface ChecklistData {
  id: string;
  slug: string;
  clientName: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  fieldVersions: Record<string, number> | null;
  enabledTabs: string[] | null;
  communicationChannels: CommunicationChannels | null;
  featureToggles: FeatureToggles | null;
  companyInfo: CompanyInfo | null;
  users: UserRow[] | null;
  campaigns: CampaignRow[] | null;
  sites: SiteRow[] | null;
  prescreening: QuestionRow[] | null;
  messaging: MessagingTemplateRow[] | null;
  sources: SourceRow[] | null;
  folders: FolderRow[] | null;
  documents: DocumentRow[] | null;
  fbWhatsapp: FbWhatsappData | null;
  instagram: InstagramData | null;
  aiCallFaqs: AiCallData | null;
  agencyPortal: AgencyPortalRow[] | null;
  adminSettings: AdminSettingsData | null;
}

// ===== Column definition for EditableTable =====
export interface ColumnDef {
  key: string;
  label: string;
  description?: string;
  type: "text" | "textarea" | "dropdown" | "boolean" | "readonly";
  options?: string[];
  width?: string;
  validation?: "email" | "url" | "phone";
  example?: string;
}

// ===== Field-level merge constants =====
export const CHECKLIST_JSON_FIELDS = [
  "enabledTabs",
  "communicationChannels",
  "featureToggles",
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
  "adminSettings",
] as const;

export type ChecklistJsonField = (typeof CHECKLIST_JSON_FIELDS)[number];

export const FIELD_LABELS: Record<ChecklistJsonField, string> = {
  enabledTabs: "Enabled Tabs",
  communicationChannels: "Communication Channels",
  featureToggles: "Feature Toggles",
  companyInfo: "Company Info",
  users: "Users",
  campaigns: "Campaigns",
  sites: "Sites",
  prescreening: "Prescreening",
  messaging: "Messaging",
  sources: "Sources",
  folders: "Folders",
  documents: "Documents",
  fbWhatsapp: "Facebook & WhatsApp",
  instagram: "Instagram",
  aiCallFaqs: "AI Call FAQs",
  agencyPortal: "Agency Portal",
  adminSettings: "Admin Settings",
};
