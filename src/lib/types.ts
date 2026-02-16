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

// ===== Shared =====
export interface FaqEntry {
  id: string;
  category: string;
  faq: string;
  description: string;
  example: string;
  faqResponse: string;
}

// ===== Checklist Data (full) =====
export interface ChecklistData {
  id: string;
  slug: string;
  clientName: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  enabledTabs: string[] | null;
  communicationChannels: CommunicationChannels | null;
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
}
