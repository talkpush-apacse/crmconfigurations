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

export function uid(): string {
  return crypto.randomUUID();
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
    name: "Invitation to Apply",
    purpose: "First outreach message sent to candidate after sourcing",
    language: "English",
    folder: "Inbox",
    emailTemplate: "",
    emailActive: false,
    smsTemplate: "Hi <Candidate First Name>! <Company Name> is hiring. Apply now for <Campaign Name>: <Scheduler URL>",
    smsActive: true,
    whatsappTemplate: "Hi <Candidate First Name>! Good news \u2014 <Company Name> is looking for a <Campaign Name> at <Site Name>. Interested? Start your application here: <Scheduler URL>",
    whatsappActive: true,
    messengerTemplate: "",
    messengerActive: false,
    comments: "",
  },
  {
    id: uid(),
    name: "Application Acknowledgment",
    purpose: "Sent after candidate completes application / pre-screening",
    language: "English",
    folder: "Inbox",
    emailTemplate: "",
    emailActive: false,
    smsTemplate: "Thanks <Candidate First Name>! Your application for <Campaign Name> at <Company Name> has been received. We'll be in touch soon.",
    smsActive: true,
    whatsappTemplate: "Hi <Candidate First Name>, thank you for completing your application for <Campaign Name> at <Company Name>! Our team is reviewing your profile. We'll update you on next steps shortly.",
    whatsappActive: true,
    messengerTemplate: "",
    messengerActive: false,
    comments: "",
  },
  {
    id: uid(),
    name: "Invite to Book Interview",
    purpose: "Invite candidate to select an interview schedule",
    language: "English",
    folder: "Interview",
    emailTemplate: "",
    emailActive: false,
    smsTemplate: "Hi <Candidate First Name>! You're shortlisted for <Campaign Name>. Book your interview now: <Scheduler URL>",
    smsActive: true,
    whatsappTemplate: "Hi <Candidate First Name>! Great news \u2014 you've been shortlisted for <Campaign Name> at <Site Name>. Please book your preferred interview slot here: <Scheduler URL>",
    whatsappActive: true,
    messengerTemplate: "",
    messengerActive: false,
    comments: "",
  },
  {
    id: uid(),
    name: "Invite to AI Interview",
    purpose: "Invite candidate to complete the AI recruiter interview",
    language: "English",
    folder: "Interview",
    emailTemplate: "",
    emailActive: false,
    smsTemplate: "Hi <Candidate First Name>! Complete your AI interview for <Campaign Name> here: <Scheduler URL>",
    smsActive: true,
    whatsappTemplate: "Hi <Candidate First Name>! As part of your application for <Campaign Name>, please complete a short AI interview. It only takes a few minutes: <Scheduler URL>",
    whatsappActive: true,
    messengerTemplate: "",
    messengerActive: false,
    comments: "",
  },
  {
    id: uid(),
    name: "Follow-up: Complete Application",
    purpose: "Reminder for candidates who haven't finished their application",
    language: "English",
    folder: "Inbox",
    emailTemplate: "",
    emailActive: false,
    smsTemplate: "Hi <Candidate First Name>, don't miss out! Finish your application for <Campaign Name>: <Scheduler URL>",
    smsActive: true,
    whatsappTemplate: "Hi <Candidate First Name>, we noticed you haven't completed your application for <Campaign Name> at <Company Name>. Slots are filling up \u2014 finish now: <Scheduler URL>",
    whatsappActive: true,
    messengerTemplate: "",
    messengerActive: false,
    comments: "Recommended: send 30 min to 1 hour after invitation",
  },
  {
    id: uid(),
    name: "Follow-up: Book Schedule",
    purpose: "Reminder for candidates who haven't booked their interview",
    language: "English",
    folder: "Interview",
    emailTemplate: "",
    emailActive: false,
    smsTemplate: "Reminder: Book your interview for <Campaign Name> at <Company Name>. Schedule here: <Scheduler URL>",
    smsActive: true,
    whatsappTemplate: "Hi <Candidate First Name>, friendly reminder to book your interview for <Campaign Name> at <Site Name>. Available slots are limited: <Scheduler URL>",
    whatsappActive: true,
    messengerTemplate: "",
    messengerActive: false,
    comments: "Recommended: send 24 hours after scheduling invite",
  },
  {
    id: uid(),
    name: "Follow-up: Complete AI Interview",
    purpose: "Reminder for candidates who haven't completed their AI interview",
    language: "English",
    folder: "Interview",
    emailTemplate: "",
    emailActive: false,
    smsTemplate: "Hi <Candidate First Name>, your AI interview for <Campaign Name> is still pending. Complete it here: <Scheduler URL>",
    smsActive: true,
    whatsappTemplate: "Hi <Candidate First Name>, just a reminder \u2014 your AI interview for <Campaign Name> is still pending. It only takes a few minutes to complete: <Scheduler URL>",
    whatsappActive: true,
    messengerTemplate: "",
    messengerActive: false,
    comments: "Recommended: send 1-2 hours after AI interview invite",
  },
  {
    id: uid(),
    name: "Interview Schedule Confirmation",
    purpose: "Confirm the candidate's booked interview schedule",
    language: "English",
    folder: "Interview",
    emailTemplate: "",
    emailActive: false,
    smsTemplate: "Confirmed! Your interview for <Campaign Name> at <Site Name> is set. See you there, <Candidate First Name>!",
    smsActive: true,
    whatsappTemplate: "Hi <Candidate First Name>, your interview for <Campaign Name> at <Site Name> is confirmed! Please bring a valid ID and arrive 15 minutes early. Good luck!",
    whatsappActive: true,
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
