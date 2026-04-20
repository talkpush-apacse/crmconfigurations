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
  businessHours?: BusinessHourEntry[];
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
  campaignId?: string;
  nameInternal: string;
  jobTitleExternal: string;
  site: string;
  jobDescription: string;
  googleMapsLink: string;
  zoomLink: string;
  assignedRecruiters?: string[];
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
  documentsToRing: string;
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
  emailSubject: string;
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

// ===== Candidate Attributes =====
export interface AttributeRow {
  id: string;
  attributeName: string;
  key: string;
  description: string;
  dataType: string;
  suggestedValues: string;
  addToAllFutureCandidates: boolean;
  showAcrossApplications: boolean;
  markDataPrivate: boolean;
  restrictToOwners: boolean;
  hideAttributeCompliance: boolean;
  useSuggestedValuesOnly: boolean;
  readOnlyMode: boolean;
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

export interface AgencyPortalUser {
  id: string;
  name: string;
  email: string;
  agency: string;
  userAccess: 'Talkpush Owner' | 'Agency Admin' | 'Agency Editor' | 'Company Admin' | 'Company Editor' | 'Campaign Manager' | 'Recruiter' | '';
}

// ===== Labels =====
export interface LabelRow {
  id: string;
  name: string;
  color: string;
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

export type CommunicationChannel = keyof CommunicationChannels | "facebook" | "instagram";

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
export type BusinessDay =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export interface BusinessHourEntry {
  day: BusinessDay;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
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
  // Account Metadata
  server: string;
  accountCreatedAt: string;
  goLiveTarget: string;
  actualGoLiveDate: string;
  assignedSE: string;
  assignedCSM: string;
}

// ===== ATS / HRIS Integrations =====
export type AtsSystem =
  | "Workday"
  | "SAP SuccessFactors"
  | "PeopleStrong"
  | "iCIMS"
  | "Greenhouse"
  | "Lever"
  | "SmartRecruiters"
  | "Oracle HCM"
  | "Microsoft Dynamics HR"
  | "BambooHR"
  | "Other";

export type IntegrationDirection = "Talkpush → ATS" | "ATS → Talkpush" | "Bidirectional";
export type IntegrationEnvironment = "Sandbox" | "Production" | "Both";
export type IntegrationAuthType = "API Key" | "OAuth 2.0" | "Basic Auth" | "Webhook" | "SFTP" | "Other";
export type AtsIntegrationStatus = "Not Started" | "In Progress" | "UAT" | "Live" | "On Hold";

export interface AtsTriggerRow {
  id: string;
  direction: "Talkpush → ATS" | "ATS → Talkpush";
  talkpushFolder: string;
  atsObject: string;
  action: string;
  notes: string;
}

export interface AtsFieldMappingRow {
  id: string;
  talkpushAttribute: string;
  atsField: string;
  dataType: string;
  direction: "Talkpush → ATS" | "ATS → Talkpush" | "Bidirectional";
  notes: string;
}

export interface AtsAuthRequirement {
  id: string;
  item: string;
  value: string;
  receivedFromClient: boolean;
  notes: string;
}

export type AtsDataFormat = "JSON" | "XML" | "Flat file" | "Unknown";
export type AtsFailureAction = "Retry" | "Error folder" | "Email alert" | "TBD";
export type AtsTalkpushEnvironment = "Prod (test campaign)" | "Staging" | "Full production";
export type AtsHandoffStatus = "Not shared" | "Shared with integration team" | "Shared with vendor" | "Confirmed by vendor";

export interface AtsIntegrationChecklist {
  dataFormat: AtsDataFormat | null;
  failureAction: AtsFailureAction | null;
  deduplicationNeeded: "Yes" | "No" | "TBD" | null;
  deduplicationNotes: string;
  apiRateLimit: string;
  sandboxAccessConfirmed: "Yes" | "No" | null;
  testCandidateAgreed: "Yes" | "No" | null;
}

export interface AtsHandoffInfo {
  talkpushEnvironment: AtsTalkpushEnvironment;
  webhookUrlFormat: string;
  payloadSchema: string;
  sampleJsonPayload: string;
  handoffStatus: AtsHandoffStatus;
}

export interface AtsIntegration {
  id: string;
  name: string;
  system: AtsSystem;
  systemOther: string;
  direction: IntegrationDirection;
  environment: IntegrationEnvironment;
  status: AtsIntegrationStatus;
  integrationOwner: string;
  targetGoLiveDate: string;
  notes: string;
  triggers: AtsTriggerRow[];
  fieldMappings: AtsFieldMappingRow[];
  authType: IntegrationAuthType;
  authTypeOther: string;
  authRequirements: AtsAuthRequirement[];
  sandboxBaseUrl: string;
  productionBaseUrl: string;
  apiVersion: string;
  additionalTechnicalNotes: string;
  checklist: AtsIntegrationChecklist;
  handoff: AtsHandoffInfo;
}

// ===== Integrations =====
export type IntegrationCategory =
  | "hris_ats"
  | "assessment"
  | "background_check"
  | "medical_exam"
  | "others";

export type IntegrationActionType =
  | "outbound_post"
  | "inbound_pull"
  | "inbound_patch_attribute"
  | "inbound_upload_document"
  | "inbound_change_status";

export type IntegrationAuthMethod =
  | "none"
  | "api_key_query"
  | "bearer_token"
  | "custom_header"
  | "basic_auth";

export type IntegrationStatus =
  | "not_started"
  | "scoping"
  | "in_development"
  | "uat"
  | "live";

export type IntegrationMatchKey =
  | "candidate_id"
  | "email"
  | "phone"
  | "application_id";

export type IntegrationApiEnvironment =
  | "production"
  | "staging"
  | "test_campaign"
  | "tbd";

export type IntegrationCampaignScope =
  | "single_campaign"
  | "multiple_campaigns"
  | "all_campaigns"
  | "tbd";

export type IntegrationCandidateIdSource =
  | "provided_in_outbound_payload"
  | "vendor_stores_talkpush_id"
  | "lookup_get_campaign_invitations"
  | "provided_by_talkpush_se"
  | "other";

export type IntegrationMultiMatchBehavior =
  | "reject"
  | "use_most_recent"
  | "use_first_match"
  | "manual_review"
  | "tbd";

export interface IntegrationPayloadMapping {
  id: string;
  talkpushSource: string;
  vendorFieldName: string;
  required: boolean;
}

export interface IntegrationResponseMapping {
  id: string;
  vendorResponseField: string;
  targetAttribute: string;
}

export interface IntegrationAttributeMapping {
  id: string;
  vendorCallbackField: string;
  targetAttribute: string;
}

export interface IntegrationRow {
  id: string;
  vendorName: string;
  vendorCategory: IntegrationCategory | "";
  actionType: IntegrationActionType | "";
  triggerFolder: string;
  status: IntegrationStatus | "";
  vendorContactName: string;
  vendorContactEmail: string;
  vendorDocsUrl: string;
  notes: string;
  endpointUrl?: string;
  authMethod?: IntegrationAuthMethod | "";
  authParamName?: string;
  authValue?: string;
  outboundPayloadMapping?: IntegrationPayloadMapping[];
  responseHandling?: IntegrationResponseMapping[];
  inboundAttributeMapping?: IntegrationAttributeMapping[];
  matchKey?: IntegrationMatchKey | "";
  documentTag?: string;
  targetFolder?: string;
  filterCriteria?: string;

  // Shared inbound API handoff fields
  talkpushApiBaseUrl?: string;
  apiEnvironment?: IntegrationApiEnvironment | "";
  inboundAuthMethod?: IntegrationAuthMethod | "";
  inboundAuthParamName?: string;
  inboundAuthValue?: string;
  campaignScope?: IntegrationCampaignScope | "";
  campaignIds?: string;
  campaignNames?: string;
  candidateIdSource?: IntegrationCandidateIdSource | "";
  candidateIdFieldName?: string;
  lookupQueryParams?: string;
  multiMatchBehavior?: IntegrationMultiMatchBehavior | "";
  sampleRequest?: string;
  sampleSuccessResponse?: string;
  sampleErrorResponse?: string;
  rateLimitNotes?: string;
  retryTimeoutNotes?: string;
  idempotencyNotes?: string;
  uatTestCandidate?: string;
  expectedTalkpushResult?: string;
}

// ===== Tab Upload Meta =====
// Per-tab metadata for the "Skip manual entry — upload your spreadsheet" feature.
// Stored as a single JSON column on Checklist, keyed by tab data field name
// (e.g. "users", "campaigns", "sites").
export interface TabUploadFile {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadedAt: string;
}

export interface TabUploadMeta {
  uploadedFiles: TabUploadFile[];
  isSkipped: boolean;
}

export type TabUploadMetaMap = Record<string, TabUploadMeta>;

// ===== Custom Checklist Types =====
export type CustomFieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'number'
  | 'date'
  | 'select'
  | 'checkbox'
  | 'file'
  | 'table';

export interface CustomFieldDef {
  id: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
  columns?: string[];
}

export type CustomSchema = CustomFieldDef[];
export type CustomData = Record<string, unknown>;

// ===== Custom Tabs (for standard checklists) =====

// --- Table-based custom tab types (created via MCP) ---
export interface CustomTabColumn {
  key: string;            // unique column identifier (snake_case)
  label: string;          // display label
  type: "text" | "textarea" | "number" | "date" | "select" | "email" | "url" | "checkbox";
  required?: boolean;
  options?: string[];     // only for type: "select"
  width?: string;         // optional Tailwind width class
}

export interface CustomTabRow {
  id: string;             // unique row ID
  [key: string]: unknown; // dynamic column values keyed by column.key
}

export interface CustomTabUploadedFile {
  name: string;
  url: string;
  uploadedAt: string;     // ISO date string
}

export interface CustomTab {
  id: string;
  slug: string;
  label: string;           // display name (used by tab-config and navigation)
  icon: string;
  fields: CustomFieldDef[]; // form-based custom tabs (legacy/admin-created)
  // Table-based custom tab fields (MCP-created, optional for backward compat)
  columns?: CustomTabColumn[];
  rows?: CustomTabRow[];
  uploadedFile?: CustomTabUploadedFile | null;
  sortOrder?: number;
  createdAt?: string;      // ISO date string
}

// ===== Autoflow Rule =====
export interface AutoflowRule {
  id: string;
  group: string;
  triggerType: "Folder Entry" | "Attribute Change";
  triggerSource: string;
  condition: string;
  action: string;
  targetFolder: string;
  timing: string;
  messageTemplate: string;
  rejectionReason: string;
  notes: string;
}

// ===== Checklist Data (full) =====
export interface ChecklistData {
  id: string;
  slug: string;
  editorToken: string;
  clientName: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  fieldVersions: Record<string, number> | null;
  enabledTabs: string[] | null;
  tabOrder: string[] | null;
  tabFilledBy: Record<string, "talkpush" | "client"> | null;
  communicationChannels: CommunicationChannels | null;
  featureToggles: FeatureToggles | null;
  configuratorChecklist: unknown | null;
  companyInfo: CompanyInfo | null;
  users: UserRow[] | null;
  campaigns: CampaignRow[] | null;
  sites: SiteRow[] | null;
  prescreening: QuestionRow[] | null;
  messaging: MessagingTemplateRow[] | null;
  sources: SourceRow[] | null;
  folders: FolderRow[] | null;
  documents: DocumentRow[] | null;
  attributes: AttributeRow[] | null;
  fbWhatsapp: FbWhatsappData | null;
  instagram: InstagramData | null;
  aiCallFaqs: AiCallData | null;
  agencyPortal: AgencyPortalRow[] | null;
  agencyPortalUsers: AgencyPortalUser[] | null;
  rejectionReasons: string[] | null;
  labels: LabelRow[] | null;
  adminSettings: AdminSettingsData | null;
  atsIntegrations: AtsIntegration[] | null;
  integrations: IntegrationRow[] | null;
  tabUploadMeta: TabUploadMetaMap | null;
  isCustom: boolean;
  customSchema: CustomSchema | null;
  customData: CustomData | null;
  customTabs: CustomTab[] | null;
  autoflows: AutoflowRule[] | null;
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
  required?: boolean;
  example?: string;
}

// ===== Field-level merge constants =====
export const CHECKLIST_JSON_FIELDS = [
  "enabledTabs",
  "tabOrder",
  "tabFilledBy",
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
  "attributes",
  "fbWhatsapp",
  "instagram",
  "aiCallFaqs",
  "agencyPortal",
  "agencyPortalUsers",
  "rejectionReasons",
  "labels",
  "adminSettings",
  "atsIntegrations",
  "integrations",
  "tabUploadMeta",
  "customSchema",
  "customData",
  "customTabs",
  "autoflows",
] as const;

export type ChecklistJsonField = (typeof CHECKLIST_JSON_FIELDS)[number];

export const FIELD_LABELS: Record<ChecklistJsonField, string> = {
  enabledTabs: "Enabled Tabs",
  tabOrder: "Tab Order",
  tabFilledBy: "Tab Filled By",
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
  attributes: "Attributes",
  fbWhatsapp: "Facebook & WhatsApp",
  instagram: "Instagram",
  aiCallFaqs: "AI Call FAQs",
  agencyPortal: "Agency Portal",
  agencyPortalUsers: "Agency Portal Users",
  rejectionReasons: "Rejection Reasons",
  labels: "Labels",
  adminSettings: "Admin Settings",
  atsIntegrations: "ATS / HRIS Integrations",
  integrations: "Integrations",
  tabUploadMeta: "Tab File Uploads",
  customSchema: "Custom Schema",
  customData: "Custom Data",
  customTabs: "Custom Tabs",
  autoflows: "Autoflows",
};
