import type {
  CompanyInfo,
  UserRow,
  CampaignRow,
  SiteRow,
  QuestionRow,
  MessagingTemplateRow,
  SourceRow,
  FolderRow,
  DocumentRow,
  FbWhatsappData,
  InstagramData,
  AiCallData,
  AgencyPortalRow,
} from "./types";

function uid(): string {
  return Math.random().toString(36).substring(2, 9);
}

export const defaultCompanyInfo: CompanyInfo = {
  allowDuplicates: "",
  coolingPeriod: "",
  rehiresAllowed: "",
};

export const defaultUsers: UserRow[] = [
  {
    id: uid(),
    name: "",
    accessType: "",
    jobTitle: "",
    email: "",
    phone: "",
    site: "",
    reportsTo: "",
    stage: "",
    comments: "",
  },
];

export const defaultCampaigns: CampaignRow[] = [
  {
    id: uid(),
    nameInternal: "",
    jobTitleExternal: "",
    site: "",
    jobDescription: "",
    googleMapsLink: "",
    zoomLink: "",
    comments: "",
  },
];

export const defaultSites: SiteRow[] = [
  {
    id: uid(),
    siteName: "",
    internalName: "",
    interviewHours: "",
    interviewType: "",
    fullAddress: "",
    documentsToRring: "",
    googleMapsLink: "",
    comments: "",
  },
];

export const defaultPrescreening: QuestionRow[] = [
  {
    id: uid(),
    category: "Pre-screening",
    question: "",
    questionType: "",
    answerOptions: "",
    applicableCampaigns: "",
    autoReject: "",
    rejectCondition: "",
    rejectReason: "",
    comments: "",
  },
];

export const defaultMessaging: MessagingTemplateRow[] = [
  {
    id: uid(),
    name: "Invitation",
    purpose: "First message sent to candidate after application",
    language: "English",
    folder: "Inbox",
    emailTemplate: "",
    emailActive: false,
    smsTemplate: "",
    smsActive: false,
    whatsappTemplate: "",
    whatsappActive: false,
    messengerTemplate: "",
    messengerActive: false,
    comments: "",
  },
  {
    id: uid(),
    name: "Inbox Reminder (30 min)",
    purpose: "Follow-up reminder sent 30 minutes after invitation",
    language: "English",
    folder: "Inbox",
    emailTemplate: "",
    emailActive: false,
    smsTemplate: "",
    smsActive: false,
    whatsappTemplate: "",
    whatsappActive: false,
    messengerTemplate: "",
    messengerActive: false,
    comments: "",
  },
  {
    id: uid(),
    name: "Inbox Reminder (3 hours)",
    purpose: "Follow-up reminder sent 3 hours after invitation",
    language: "English",
    folder: "Inbox",
    emailTemplate: "",
    emailActive: false,
    smsTemplate: "",
    smsActive: false,
    whatsappTemplate: "",
    whatsappActive: false,
    messengerTemplate: "",
    messengerActive: false,
    comments: "",
  },
];

export const defaultSources: SourceRow[] = [
  {
    id: uid(),
    category: "",
    subcategory: "",
    link: "",
    comments: "",
  },
];

export const defaultFolders: FolderRow[] = [
  { id: uid(), folderName: "Inbox (Default)", description: "Candidates added to this folder first by default", movementType: "Automated", comments: "" },
  { id: uid(), folderName: "Interview", description: "Candidates moved here after pre-screening", movementType: "Manual", comments: "" },
  { id: uid(), folderName: "Assessment", description: "Candidates currently being assessed", movementType: "Manual", comments: "" },
  { id: uid(), folderName: "Hired", description: "Candidates who have been hired", movementType: "Manual", comments: "" },
  { id: uid(), folderName: "Rejected", description: "Candidates who were not selected", movementType: "Manual", comments: "" },
];

export const defaultDocuments: DocumentRow[] = [
  {
    id: uid(),
    documentName: "",
    applicableCandidates: "",
    required: "",
    blankTemplateLink: "",
    applicableCampaigns: "",
    accessPermissions: "",
    folder: "",
    comments: "",
  },
];

export const defaultFbWhatsapp: FbWhatsappData = {
  phoneNumber: "",
  businessManagerAccess: "",
  businessVerification: "",
  chatbotName: "",
  chatbotPersona: "",
  faqs: [],
};

export const defaultInstagram: InstagramData = {
  instagramAccount: "",
  twoFactorAuth: "",
  businessAccountConnection: "",
  chatbotName: "",
  chatbotPersona: "",
  faqs: [],
};

export const defaultAiCallData: AiCallData = {
  measureEnglish: false,
  gender: "",
  preferredVoice: "",
  callType: "",
  interviewRole: "",
  interviewQuestions: "",
  faqs: [
    { id: uid(), faq: "Documents to bring", example: "What documents do I need to bring?", faqResponse: "" },
    { id: uid(), faq: "Salary", example: "What is the salary for this position?", faqResponse: "" },
    { id: uid(), faq: "Address", example: "Where is the office located?", faqResponse: "" },
    { id: uid(), faq: "What to expect", example: "What should I expect during the interview?", faqResponse: "" },
    { id: uid(), faq: "Virtual interview", example: "Will the interview be virtual?", faqResponse: "" },
    { id: uid(), faq: "Site name", example: "What is the name of the site?", faqResponse: "" },
    { id: uid(), faq: "Interview format", example: "What is the format of the interview?", faqResponse: "" },
    { id: uid(), faq: "Compensation/benefits", example: "What are the benefits?", faqResponse: "" },
    { id: uid(), faq: "Dress code", example: "What is the dress code?", faqResponse: "" },
    { id: uid(), faq: "Remote work policy", example: "Is remote work available?", faqResponse: "" },
    { id: uid(), faq: "Shift schedules", example: "What are the shift schedules?", faqResponse: "" },
    { id: uid(), faq: "Overtime policy", example: "What is the overtime policy?", faqResponse: "" },
  ],
};

export const defaultAgencyPortal: AgencyPortalRow[] = [
  {
    id: uid(),
    agencyName: "",
    contactName: "",
    email: "",
    phone: "",
    country: "",
    comments: "",
  },
];

export function getDefaultChecklistData() {
  return {
    companyInfo: defaultCompanyInfo,
    users: defaultUsers,
    campaigns: defaultCampaigns,
    sites: defaultSites,
    prescreening: defaultPrescreening,
    messaging: defaultMessaging,
    sources: defaultSources,
    folders: defaultFolders,
    documents: defaultDocuments,
    fbWhatsapp: defaultFbWhatsapp,
    instagram: defaultInstagram,
    aiCallFaqs: defaultAiCallData,
    agencyPortal: defaultAgencyPortal,
  };
}
