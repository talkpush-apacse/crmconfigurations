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
  CommunicationChannels,
  FeatureToggles,
  AdminSettingsData,
} from "./types";

export function uid(): string {
  return crypto.randomUUID();
}

export const defaultCommunicationChannels: CommunicationChannels = {
  email: true,
  sms: true,
  messenger: false,
  whatsapp: true,
  liveCall: false,
  aiCalls: false,
};

export const defaultFeatureToggles: FeatureToggles = {
  aiCallVoiceSelection: true,
};

export const defaultCompanyInfo: CompanyInfo = {
  // Company Details
  companyName: "",
  companyAddress: "",
  companyWebsiteUrl: "",
  privacyPolicyUrl: "",
  companyDescription: "",
  // Facebook Details
  fbPageName: "",
  fbPageId: "",
  fbPageUrl: "",
  fbPagePocName: "",
  fbPagePocEmail: "",
  // Company Branding Assets
  logoUrl: "",
  logoSecondaryUrl: "",
  companyColor: "",
  bannerImageUrl: "",
  bannerImageLargeUrl: "",
  // Recruitment Process
  allowDuplicates: "",
  coolingPeriod: "",
  rehiresAllowed: "",
};

export const defaultUsers: UserRow[] = [];

export const defaultCampaigns: CampaignRow[] = [];

export const defaultSites: SiteRow[] = [];

export const defaultPrescreening: QuestionRow[] = [];

export const defaultMessaging: MessagingTemplateRow[] = [
  {
    id: uid(),
    name: "Invitation to Apply",
    purpose: "First outreach message sent to candidate after sourcing",
    language: "English",
    folder: "Inbox",
    emailSubject: "You're Invited to Apply — <Campaign Name> at <Company Name>",
    emailTemplate: `Hi <Candidate First Name>,

We came across your profile and think you'd be a great fit for the <Campaign Name> role at <Company Name>, located at <Site Name>.

To get started, simply click the link below to complete your application:
<Scheduler URL>

It only takes a few minutes. If you have any questions, feel free to reply to this email.

We look forward to hearing from you!

Best regards,
The <Company Name> Recruitment Team`,
    emailActive: false,
    smsTemplate: "Hi <Candidate First Name>! <Company Name> is hiring for <Campaign Name>. Apply now: <Scheduler URL>",
    smsActive: true,
    whatsappTemplate: `Hi <Candidate First Name>! 👋

Good news — <Company Name> is looking for a *<Campaign Name>* at <Site Name>.

Interested? Start your application here:
<Scheduler URL>

It only takes a few minutes!`,
    whatsappActive: true,
    messengerTemplate: `Hi <Candidate First Name>! 👋

<Company Name> is hiring for <Campaign Name> at <Site Name>.

Tap below to apply — it only takes a few minutes:
<Scheduler URL>`,
    messengerActive: false,
    comments: "",
  },
  {
    id: uid(),
    name: "Application Acknowledgment",
    purpose: "Sent after candidate completes application / pre-screening",
    language: "English",
    folder: "Inbox",
    emailSubject: "Application Received — <Campaign Name> at <Company Name>",
    emailTemplate: `Hi <Candidate First Name>,

Thank you for applying for the <Campaign Name> position at <Company Name>!

We've received your application and our recruitment team is currently reviewing your profile. We'll reach out with next steps shortly.

In the meantime, please make sure your contact information is up to date so we can reach you easily.

Thank you for your interest in joining <Company Name>!

Best regards,
The <Company Name> Recruitment Team`,
    emailActive: false,
    smsTemplate: "Thanks <Candidate First Name>! Your application for <Campaign Name> at <Company Name> has been received. We'll be in touch soon.",
    smsActive: true,
    whatsappTemplate: `Hi <Candidate First Name>,

Thank you for completing your application for *<Campaign Name>* at <Company Name>! ✅

Our team is reviewing your profile and we'll update you on next steps shortly. Stay tuned!`,
    whatsappActive: true,
    messengerTemplate: `Hi <Candidate First Name>,

Thanks for applying for <Campaign Name> at <Company Name>! ✅

We've got your application — our team will review it and get back to you soon.`,
    messengerActive: false,
    comments: "",
  },
  {
    id: uid(),
    name: "Invite to Book Interview",
    purpose: "Invite shortlisted candidate to select an interview schedule",
    language: "English",
    folder: "Interview",
    emailSubject: "You're Shortlisted! Book Your Interview — <Campaign Name>",
    emailTemplate: `Hi <Candidate First Name>,

Congratulations! You've been shortlisted for the <Campaign Name> position at <Company Name>.

Please book your preferred interview slot using the link below:
<Scheduler URL>

Interview Location: <Site Name>

What to bring:
• Valid government-issued ID
• Updated resume/CV

Please arrive at least 15 minutes before your scheduled time. If you need to reschedule, let us know as soon as possible.

Good luck!

Best regards,
The <Company Name> Recruitment Team`,
    emailActive: false,
    smsTemplate: "Hi <Candidate First Name>! You're shortlisted for <Campaign Name>. Book your interview now: <Scheduler URL>",
    smsActive: true,
    whatsappTemplate: `Hi <Candidate First Name>! 🎉

Great news — you've been shortlisted for *<Campaign Name>* at <Site Name>!

Please book your preferred interview slot here:
<Scheduler URL>

Don't forget to bring a valid ID. Good luck!`,
    whatsappActive: true,
    messengerTemplate: `Hi <Candidate First Name>! 🎉

You're shortlisted for <Campaign Name>!

Book your interview here:
<Scheduler URL>

Bring a valid ID and arrive 15 mins early. Good luck!`,
    messengerActive: false,
    comments: "",
  },
  {
    id: uid(),
    name: "Invite to AI Interview",
    purpose: "Invite candidate to complete the AI recruiter interview",
    language: "English",
    folder: "Interview",
    emailSubject: "Complete Your AI Interview — <Campaign Name> at <Company Name>",
    emailTemplate: `Hi <Candidate First Name>,

As the next step in your application for <Campaign Name>, we'd like you to complete a short AI-powered interview.

Click the link below to get started:
<Scheduler URL>

The interview takes about 5-10 minutes and can be completed from your phone or computer. You can do it anytime that's convenient for you.

Tips for a great interview:
• Find a quiet spot with good internet connection
• Speak clearly and naturally
• Answer each question as thoroughly as you can

If you experience any technical issues, please reply to this email.

Best regards,
The <Company Name> Recruitment Team`,
    emailActive: false,
    smsTemplate: "Hi <Candidate First Name>! Complete your AI interview for <Campaign Name> here: <Scheduler URL>",
    smsActive: true,
    whatsappTemplate: `Hi <Candidate First Name>!

As part of your application for *<Campaign Name>*, please complete a short AI interview. It only takes 5-10 minutes:
<Scheduler URL>

💡 Tip: Find a quiet spot and speak clearly. You can do it anytime!`,
    whatsappActive: true,
    messengerTemplate: `Hi <Candidate First Name>!

Please complete your AI interview for <Campaign Name>. It only takes 5-10 minutes:
<Scheduler URL>

Find a quiet spot and speak clearly. Good luck! 🎤`,
    messengerActive: false,
    comments: "",
  },
  {
    id: uid(),
    name: "Follow-up: Complete Application",
    purpose: "Reminder for candidates who haven't finished their application",
    language: "English",
    folder: "Inbox",
    emailSubject: "Don't Miss Out — Complete Your Application for <Campaign Name>",
    emailTemplate: `Hi <Candidate First Name>,

We noticed you haven't finished your application for <Campaign Name> at <Company Name> yet.

Slots are filling up fast — complete your application now:
<Scheduler URL>

It only takes a few minutes. Don't let this opportunity pass you by!

If you've already completed your application, please disregard this message.

Best regards,
The <Company Name> Recruitment Team`,
    emailActive: false,
    smsTemplate: "Hi <Candidate First Name>, don't miss out! Finish your application for <Campaign Name>: <Scheduler URL>",
    smsActive: true,
    whatsappTemplate: `Hi <Candidate First Name>,

We noticed you haven't completed your application for *<Campaign Name>* at <Company Name>.

Slots are filling up — finish now before it's too late:
<Scheduler URL>`,
    whatsappActive: true,
    messengerTemplate: `Hi <Candidate First Name>,

You haven't finished your application for <Campaign Name> yet!

Complete it now — it only takes a few minutes:
<Scheduler URL>`,
    messengerActive: false,
    comments: "Recommended: send 30 min to 1 hour after invitation",
  },
  {
    id: uid(),
    name: "Follow-up: Book Schedule",
    purpose: "Reminder for candidates who haven't booked their interview",
    language: "English",
    folder: "Interview",
    emailSubject: "Reminder — Book Your Interview for <Campaign Name>",
    emailTemplate: `Hi <Candidate First Name>,

Just a friendly reminder that you haven't booked your interview for <Campaign Name> at <Company Name> yet.

Available interview slots are limited — secure yours now:
<Scheduler URL>

Interview Location: <Site Name>

If you have any questions or need help booking, feel free to reply to this email.

Best regards,
The <Company Name> Recruitment Team`,
    emailActive: false,
    smsTemplate: "Reminder: Book your interview for <Campaign Name> at <Company Name>. Schedule here: <Scheduler URL>",
    smsActive: true,
    whatsappTemplate: `Hi <Candidate First Name>,

Friendly reminder to book your interview for *<Campaign Name>* at <Site Name>. Available slots are limited!

Book now: <Scheduler URL>`,
    whatsappActive: true,
    messengerTemplate: `Hi <Candidate First Name>,

Reminder: You haven't booked your interview for <Campaign Name> yet.

Slots are limited — book now:
<Scheduler URL>`,
    messengerActive: false,
    comments: "Recommended: send 24 hours after scheduling invite",
  },
  {
    id: uid(),
    name: "Follow-up: Complete AI Interview",
    purpose: "Reminder for candidates who haven't completed their AI interview",
    language: "English",
    folder: "Interview",
    emailSubject: "Reminder — Your AI Interview for <Campaign Name> is Pending",
    emailTemplate: `Hi <Candidate First Name>,

We noticed you haven't completed your AI interview for <Campaign Name> yet.

Don't worry — it only takes about 5-10 minutes. Click below to start:
<Scheduler URL>

This is an important step in your application process. Please complete it at your earliest convenience so we can move forward with your candidacy.

If you experienced any technical issues, reply to this email and we'll help you out.

Best regards,
The <Company Name> Recruitment Team`,
    emailActive: false,
    smsTemplate: "Hi <Candidate First Name>, your AI interview for <Campaign Name> is still pending. Complete it here: <Scheduler URL>",
    smsActive: true,
    whatsappTemplate: `Hi <Candidate First Name>,

Just a reminder — your AI interview for *<Campaign Name>* is still pending. It only takes a few minutes to complete:
<Scheduler URL>

Complete it soon so we can move forward with your application! 🙌`,
    whatsappActive: true,
    messengerTemplate: `Hi <Candidate First Name>,

Your AI interview for <Campaign Name> is still pending!

It only takes a few minutes:
<Scheduler URL>`,
    messengerActive: false,
    comments: "Recommended: send 1-2 hours after AI interview invite",
  },
  {
    id: uid(),
    name: "Interview Schedule Confirmation",
    purpose: "Confirm the candidate's booked interview schedule",
    language: "English",
    folder: "Interview",
    emailSubject: "Interview Confirmed — <Campaign Name> at <Site Name>",
    emailTemplate: `Hi <Candidate First Name>,

Your interview for <Campaign Name> at <Company Name> has been confirmed!

Interview Details:
• Position: <Campaign Name>
• Location: <Site Name>

What to bring:
• Valid government-issued ID
• Updated resume/CV
• Pen and paper

Please arrive at least 15 minutes before your scheduled time. If you need to reschedule or cancel, please let us know as soon as possible.

We look forward to meeting you. Good luck!

Best regards,
The <Company Name> Recruitment Team`,
    emailActive: false,
    smsTemplate: "Confirmed! Your interview for <Campaign Name> at <Site Name> is set. See you there, <Candidate First Name>!",
    smsActive: true,
    whatsappTemplate: `Hi <Candidate First Name>,

Your interview for *<Campaign Name>* at <Site Name> is confirmed! ✅

📋 Please bring:
• Valid ID
• Updated resume

Arrive 15 minutes early. Good luck! 🍀`,
    whatsappActive: true,
    messengerTemplate: `Hi <Candidate First Name>,

Your interview for <Campaign Name> at <Site Name> is confirmed! ✅

Bring a valid ID and your resume. Arrive 15 mins early. See you there!`,
    messengerActive: false,
    comments: "",
  },
];

export const defaultSources: SourceRow[] = [];

export const defaultFolders: FolderRow[] = [
  { id: uid(), folderName: "Inbox (Default)", description: "Candidates added to this folder first by default", movementType: "Automated", comments: "" },
  { id: uid(), folderName: "Interview", description: "Candidates moved here after pre-screening", movementType: "Manual", comments: "" },
  { id: uid(), folderName: "Assessment", description: "Candidates currently being assessed", movementType: "Manual", comments: "" },
  { id: uid(), folderName: "Hired", description: "Candidates who have been hired", movementType: "Manual", comments: "" },
  { id: uid(), folderName: "Rejected", description: "Candidates who were not selected", movementType: "Manual", comments: "" },
];

export const defaultDocuments: DocumentRow[] = [];

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

export const defaultAgencyPortal: AgencyPortalRow[] = [];

export const defaultAdminSettings: AdminSettingsData = {
  // Basic Company Info
  companyName: "",
  companySubdomain: "",
  region: "",
  status: "",
  companyLogo: "",
  defaultCountry: "",
  timeZone: "",
  // Campaign & SMS Settings
  catchAllCampaign: "",
  telerivetProjectId: "",
  inboundSmsHotline: "",
  inboundNexmoSms: "",
  twilioInboundSms: "",
  chatInboundNumber: "",
  numberOfAllowedUsers: "",
  // Feature Checkboxes
  transcript: false,
  autoCall: false,
  liveCall: false,
  messengerIntegration: false,
  smsOptOut: false,
  recruitmentCenterScheduling: false,
  pushMessages: false,
  requireWhatsAppOptin: false,
  myCalendar: false,
  allowDisableReschedule: false,
  expireApplicationOnCoolingPeriod: false,
  autoflow: false,
  talkpushOnboard: false,
  ocr: false,
  autoListJobCampaigns: false,
  autoDeleteOldLeads: false,
  geolocation: false,
  autoflowInbox: false,
  persistentPrivacyPolicyLink: false,
  cookiesBannerNotification: false,
  mandatoryRejectionReasons: false,
  mandatoryShortlistedReasons: false,
  talkScore: false,
  talkScoreWeightDistribution: false,
  applicantScoring: false,
  customizableTalkScore: false,
  tecolocoIntegration: false,
  csvUpdate: false,
  allowLimitedManagersSelfAssign: false,
  recognitionExtractionValidation: false,
  landingPageRealtimeFeedback: false,
  documentProcessingMistral: false,
  autoflowSets: false,
  mandatoryEmailAndPhone: false,
  templateCampaigns: false,
  talkScoreReadingDetection: false,
  overrideUnsubscribeCommand: false,
  enableAutomaticGtmInsertion: false,
  emailPreferenceManagement: false,
  // Integration / Credentials
  googleTagManagerContainerId: "",
  tecolocoUsername: "",
  tecolocoPassword: "",
  elevenLabsWebhookSecret: "",
  aiBotOpenAiKey: "",
  cookiebotScript: "",
  // Network / Security
  accountDomainWhitelist: "",
  ipWhitelist: "",
  // Employee Referral Program (ERP)
  erpLinkGeneration: false,
  erpAllowedEmailDomains: "",
  erpAttributionLogic: "first-touch",
  enableCustomFields: false,
  enableOnScreenLink: false,
  requireEmailField: false,
  requireEmployeeIdField: false,
  enableSendingLinkToEmail: false,
  erpEmailCompanyLogo: "",
  // Business Hours
  businessHours: [
    { day: "Monday", enabled: false, startTime: "09:00", endTime: "18:00" },
    { day: "Tuesday", enabled: false, startTime: "09:00", endTime: "18:00" },
    { day: "Wednesday", enabled: false, startTime: "09:00", endTime: "18:00" },
    { day: "Thursday", enabled: false, startTime: "09:00", endTime: "18:00" },
    { day: "Friday", enabled: false, startTime: "09:00", endTime: "18:00" },
    { day: "Saturday", enabled: false, startTime: "09:00", endTime: "18:00" },
    { day: "Sunday", enabled: false, startTime: "09:00", endTime: "18:00" },
  ],
};

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
    adminSettings: defaultAdminSettings,
  };
}
