import type { ItemType, PlanAudience, Priority } from "./constants";

/**
 * The standard Talkpush implementation plan.
 *
 * Source: Jolo's implementation checklist plus the additions approved in the Phase 0 audit. Timing follows the standard 9-week plan:
 *   week 1-2 Scoping and sign-off, week 3-4 Configuration and Talkpush testing, week 5 first UAT,
 *   week 6 UAT revisions, week 7 Training and Go-live, week 8-9 Hypercare.
 * Integration builds sit in the Configuration phase (the Integration phase was folded into Configuration).
 * Day numbers are working days from the project start (week N = days 5(N-1)+1 to 5N).
 *
 * Rules for editing this file:
 *  - A key is permanent once a project has used it. Never rename one; add a new key instead.
 *  - Descriptions on "shared" and "client" items are shown to the client. Keep them plain and
 *    never mention internal teams, tickets or tooling. Only "internal" items may be candid.
 *  - Loading this into the database only adds missing keys. It never overwrites an edited item.
 */

export interface SeedItem {
  key: string;
  phaseName: string;
  groupName: string;
  title: string;
  description?: string;
  type: ItemType;
  priority: Priority;
  audience: PlanAudience;
  isMilestone: boolean;
  defaultIncluded: boolean;
  startDay: number;
  endDay: number;
  dependsOnKeys: string[];
}

export const STANDARD_TEMPLATE = {
  name: "Standard Talkpush implementation",
  description: "The usual Talkpush implementation plan: 9 weeks from kickoff to the end of hypercare. Tick only what a client needs.",
  /** Weeks (of 5 working days) each tracker phase covers. */
  phaseWeeks: {
    Scoping: [1, 2],
    Configuration: [3, 4],
    UAT: [5, 6],
    Training: [7, 7],
    "Go-live": [7, 7],
    Hypercare: [8, 9],
  } as Record<string, [number, number]>,
};

type Opts = {
  description?: string;
  type?: ItemType;
  priority?: Priority;
  milestone?: boolean;
  optional?: boolean;
  deps?: string[];
};

function item(
  key: string,
  phaseName: string,
  groupName: string,
  title: string,
  audience: PlanAudience,
  days: [number, number],
  o: Opts = {}
): SeedItem {
  return {
    key,
    phaseName,
    groupName,
    title,
    description: o.description,
    type: o.type ?? "config",
    priority: o.priority ?? "medium",
    audience,
    isMilestone: o.milestone ?? false,
    defaultIncluded: !o.optional,
    startDay: days[0],
    endDay: days[1],
    dependsOnKeys: o.deps ?? [],
  };
}

const SC = "Scoping";
const CF = "Configuration";
const UA = "UAT";
const TR = "Training";
const GL = "Go-live";
const HC = "Hypercare";

export const STANDARD_ITEMS: SeedItem[] = [
  // ---------------------------------------------------------------- Scoping (weeks 1-2)
  item("scoping-kickoff", SC, "Project setup", "Kickoff meeting", "shared", [1, 2], {
    priority: "high",
    milestone: true,
    description: "Meet the project team, confirm goals, roles and how we will work together.",
  }),
  item("scoping-tenant-request", SC, "Project setup", "Request the CRM tenant", "internal", [1, 2], {
    priority: "high",
    description: "Submit the account request to Product Support: server, company name, country and the contract's feature toggles. Takes 1 to 2 business days.",
  }),
  item("scoping-gantt", SC, "Project setup", "Send Gantt chart for timelines", "shared", [2, 3], {
    deps: ["scoping-kickoff"],
    description: "Share the project timeline so everyone knows the dates and who owns what.",
  }),
  item("scoping-requirements", SC, "Discovery and sign-off", "Capture requirements intake", "shared", [2, 5], {
    priority: "high",
    deps: ["scoping-kickoff"],
    description: "Confirm channels, campaign types, scheduling model, duplicate rules, documents, Voice AI, compliance and source tracking.",
  }),
  item("scoping-discovery", SC, "Discovery and sign-off", "Discovery and process mapping", "shared", [3, 6], {
    priority: "high",
    deps: ["scoping-kickoff"],
    description: "Walk through the hiring process end to end and map it as a workflow.",
  }),
  item("scoping-success-metrics", SC, "Discovery and sign-off", "Define success metrics and baseline", "shared", [3, 8], {
    type: "decision",
    deps: ["scoping-kickoff"],
    description: "Agree what success looks like and measure where you are today, so results can be compared after go-live.",
  }),
  item("scoping-champions", SC, "Discovery and sign-off", "Name client champions and UAT testers", "client", [3, 8], {
    deps: ["scoping-kickoff"],
    description: "Tell us who will be your day-to-day experts and who will test the setup.",
  }),
  item("scoping-infosec", SC, "Discovery and sign-off", "Infosec review and whitelisting", "client", [3, 10], {
    deps: ["scoping-kickoff"],
    description: "Complete any security review and allow the Talkpush domains and addresses your IT team needs to approve. Start early: this often takes the longest.",
  }),
  item("scoping-workflow-signoff", SC, "Discovery and sign-off", "Send workflow for sign-off", "shared", [7, 10], {
    type: "decision",
    priority: "high",
    milestone: true,
    deps: ["scoping-discovery", "scoping-requirements"],
    description: "Review the mapped workflow and approve it. Configuration starts from the approved version.",
  }),
  item("scoping-ticket-ats-hris", SC, "Integration requests", "Define ATS/HRIS integration and request the build", "shared", [6, 10], {
    type: "integration",
    optional: true,
    deps: ["scoping-discovery"],
    description: "Agree which system we connect to, what data moves and when. The integration can take 1 to 3 weeks to build, so it starts now.",
  }),
  item("scoping-ticket-assessment", SC, "Integration requests", "Define assessment integration and request the build", "shared", [6, 10], {
    type: "integration",
    optional: true,
    deps: ["scoping-discovery"],
    description: "Agree which assessment tool we connect to and what results come back to Talkpush.",
  }),

  // ---------------------------------------------------------------- Configuration (weeks 3-4)
  item("config-tenant", CF, "Account and settings", "CRM tenant creation", "internal", [3, 5], {
    priority: "high",
    deps: ["scoping-tenant-request"],
    description: "Product Support creates the CRM account. Needs to be ready before configuration starts in week 3.",
  }),
  item("config-admin-settings", CF, "Account and settings", "Admin settings", "internal", [11, 12], {
    deps: ["config-tenant", "scoping-workflow-signoff"],
    description: "Settings only Talkpush staff can change (backend settings). Different from Company Settings, which the client owner can access.",
  }),
  item("config-company-main", CF, "Account and settings", "Company settings: company details, privacy and terms links, SMS opt-out", "shared", [11, 12], {
    deps: ["config-tenant", "scoping-workflow-signoff"],
    description: "Set up your company profile, the privacy policy and terms links candidates see, and the SMS opt-out rules.",
  }),
  item("config-dup-mgmt", CF, "Account and settings", "Duplicate management", "client", [11, 12], {
    type: "decision",
    deps: ["scoping-workflow-signoff"],
    description: "Choose how repeat applicants are handled: allow several active applications, or allow one at a time until the earlier one is closed and a waiting period has passed.",
  }),
  item("config-career-page", CF, "Account and settings", "New Career Page Experience (landing page design)", "shared", [11, 14], {
    deps: ["scoping-workflow-signoff"],
    description: "Set up the new landing page candidates see: colors, banner, layout and wording.",
  }),
  item("config-company-other", CF, "Account and settings", "Company settings: quick replies, delay notification, share-profile rules, duplicate application message", "shared", [13, 14], {
    deps: ["config-dup-mgmt"],
    description: "The remaining company settings, including the message shown to applicants who are blocked by the duplicate rule.",
  }),
  item("config-business-hours", CF, "Account and settings", "Business hours", "shared", [11, 12], {
    deps: ["config-tenant"],
    description: "Set the hours when automatic messages are sent. Messages triggered outside these hours wait until the next business day opens.",
  }),

  item("channel-email", CF, "Channels", "Email address", "client", [6, 15], {
    priority: "high",
    deps: ["config-tenant"],
    description: "Set up the sender address (for example recruitment@yourcompany.com). Your IT team needs to add DNS records to verify it, which can take 2 to 5 business days.",
  }),
  item("channel-phone", CF, "Channels", "Phone line for SMS and AI calls", "shared", [6, 15], {
    deps: ["config-tenant"],
    description: "Set up the phone number used for SMS and AI calls. Local telecom rules for SMS wording apply and are checked as part of setup.",
  }),
  item("channel-fb-pages", CF, "Channels", "Facebook pages", "client", [6, 15], {
    deps: ["config-tenant"],
    description: "A page admin on your side connects your Facebook page to Talkpush.",
  }),
  item("channel-fb-lead-ads", CF, "Channels", "Facebook Lead Ads", "client", [15, 20], {
    optional: true,
    deps: ["channel-fb-pages"],
    description: "Connect your Facebook Lead Ads so applicants from ads arrive in Talkpush automatically.",
  }),
  item("channel-whatsapp-line", CF, "Channels", "WhatsApp line", "shared", [6, 15], {
    optional: true,
    deps: ["config-tenant"],
    description: "Connect the WhatsApp Business number candidates will message.",
  }),
  item("channel-whatsapp-approval", CF, "Channels", "WhatsApp message template approval", "shared", [15, 20], {
    optional: true,
    deps: ["channel-whatsapp-line", "crm-message-templates"],
    description: "WhatsApp requires each message template to be approved by Meta first. Approval time varies, so we track it here.",
  }),
  item("channel-chatbot", CF, "Channels", "Chatbot configuration (WhatsApp / Messenger)", "shared", [11, 20], {
    priority: "high",
    deps: ["scoping-workflow-signoff"],
    description: "Talkpush builds the candidate chatbot conversation from the approved workflow: welcome, contact details and screening questions.",
  }),
  item("channel-ai-agents", CF, "Channels", "AI agents for TalkScore interview or AI calls", "shared", [15, 20], {
    optional: true,
    deps: ["crm-questions", "channel-phone"],
    description: "Set up the AI agent that interviews or calls candidates and scores their answers.",
  }),

  item("crm-attributes", CF, "CRM setup", "Candidate attributes", "shared", [11, 12], {
    priority: "high",
    deps: ["scoping-workflow-signoff"],
    description: "The custom fields on each candidate profile. Folders, questions and automations all depend on these.",
  }),
  item("crm-labels", CF, "CRM setup", "Labels", "shared", [11, 12], {
    deps: ["scoping-workflow-signoff"],
    description: "Agree the labels recruiters can put on candidates.",
  }),
  item("crm-reasons", CF, "CRM setup", "Rejection and shortlisting reasons", "shared", [11, 12], {
    deps: ["scoping-workflow-signoff"],
    description: "Agree the reasons recruiters choose when they reject or shortlist a candidate.",
  }),
  item("crm-folders", CF, "CRM setup", "Folders (pipeline stages)", "shared", [11, 12], {
    priority: "high",
    deps: ["scoping-workflow-signoff"],
    description: "Set up the pipeline stages candidates move through, from the approved workflow.",
  }),
  item("crm-documents", CF, "CRM setup", "Document templates", "shared", [11, 12], {
    deps: ["scoping-workflow-signoff"],
    description: "The documents candidates upload (for example IDs or certificates), and what is read from them.",
  }),
  item("crm-questions", CF, "CRM setup", "Questions and question sets", "shared", [13, 14], {
    priority: "high",
    deps: ["crm-attributes", "crm-documents", "ops-recruitment-center"],
    description: "The screening questions candidates answer, grouped into sets for each campaign.",
  }),
  item("crm-message-templates", CF, "CRM setup", "Message templates", "shared", [13, 14], {
    priority: "high",
    deps: ["scoping-workflow-signoff"],
    description: "The messages candidates receive by email, SMS, WhatsApp and Messenger. We need your approved wording.",
  }),
  item("crm-autoflows", CF, "CRM setup", "Autoflows", "shared", [15, 16], {
    priority: "high",
    deps: ["crm-folders", "crm-attributes", "crm-message-templates", "crm-questions"],
    description: "The automatic rules that move candidates between stages and send messages, built from the approved workflow.",
  }),
  item("crm-autoflow-sets", CF, "CRM setup", "Autoflow sets", "shared", [17, 17], {
    deps: ["crm-autoflows"],
    description: "Group the automatic rules into sets for each hiring phase so they can be assigned to campaigns.",
  }),
  item("crm-campaigns", CF, "CRM setup", "Campaigns", "shared", [17, 18], {
    priority: "high",
    deps: ["crm-autoflow-sets", "crm-questions", "ops-users"],
    description: "Set up each campaign with its questions, messages, folders, automations and permissions.",
  }),
  item("crm-lead-scoring", CF, "CRM setup", "Lead scoring and job matching", "shared", [18, 19], {
    optional: true,
    deps: ["crm-attributes", "crm-campaigns"],
    description: "Score how well each candidate matches the job. The weights you choose must add up to 100%.",
  }),

  item("ops-sourcing", CF, "Sourcing, users and scheduling", "Sourcing channels: job boards, referrals, career sites and source tracking", "shared", [18, 19], {
    deps: ["crm-campaigns"],
    description: "Connect where candidates come from (job boards, the Referral Portal or Agency Portal, forms, career sites) and make sure each application shows its source.",
  }),
  item("ops-users", CF, "Sourcing, users and scheduling", "Users, roles and permissions", "client", [11, 15], {
    deps: ["scoping-workflow-signoff"],
    description: "Tell us who needs access, their role, and how new candidates are assigned to recruiters.",
  }),
  item("ops-recruitment-center", CF, "Sourcing, users and scheduling", "Recruitment center", "shared", [11, 12], {
    optional: true,
    deps: ["scoping-workflow-signoff"],
    description: "Set up the sites where candidates book appointments: opening hours and how far ahead they can book.",
  }),
  item("ops-recruiter-calendar", CF, "Sourcing, users and scheduling", "Recruiter calendar", "client", [15, 16], {
    optional: true,
    deps: ["ops-users"],
    description: "Each recruiter connects their Google or Outlook calendar so candidates can book interviews with them.",
  }),
  item("ops-queue-management", CF, "Sourcing, users and scheduling", "Queue management", "shared", [15, 20], {
    optional: true,
    deps: ["ops-users"],
    description: "Set up queue management for this client.",
  }),

  item("integration-assessment", CF, "Integrations", "Assessment integration", "shared", [11, 20], {
    type: "integration",
    optional: true,
    deps: ["scoping-ticket-assessment"],
    description: "Connect the assessment tool so invitations go out and results come back into Talkpush.",
  }),
  item("integration-ats-hris", CF, "Integrations", "ATS/HRIS integration", "shared", [11, 20], {
    type: "integration",
    optional: true,
    deps: ["scoping-ticket-ats-hris"],
    description: "Connect your ATS or HRIS so candidate data moves between systems as agreed. Build time depends on the system and can take up to 3 weeks.",
  }),

  item("config-internal-testing", CF, "Internal readiness", "Talkpush internal testing", "internal", [18, 20], {
    priority: "high",
    deps: ["crm-campaigns", "crm-autoflows"],
    description: "Talkpush tests the full setup end to end before the client begins UAT.",
  }),
  item("config-ready-for-uat", CF, "Internal readiness", "Ready for UAT", "internal", [20, 20], {
    type: "decision",
    milestone: true,
    deps: ["config-internal-testing"],
    description: "Internal checkpoint: configuration is complete and tested, and the client can start UAT.",
  }),

  // ---------------------------------------------------------------- UAT (weeks 5-6)
  item("uat-happy-path", UA, "User acceptance testing", "UAT: happy path", "client", [21, 23], {
    type: "uat",
    priority: "high",
    deps: ["config-ready-for-uat"],
    description: "Run through a normal application from start to finish, as a candidate and as a recruiter, and confirm it works as agreed.",
  }),
  item("uat-non-happy-path", UA, "User acceptance testing", "UAT: non-happy path", "client", [22, 24], {
    type: "uat",
    priority: "high",
    deps: ["config-ready-for-uat"],
    description: "Test what happens when things go wrong: wrong answers, rejections, missing documents, no-shows.",
  }),
  item("uat-duplicates", UA, "User acceptance testing", "UAT: duplicate management", "client", [23, 25], {
    type: "uat",
    deps: ["config-ready-for-uat"],
    description: "Apply twice and confirm repeat applications are handled by the rule you chose.",
  }),
  item("uat-automation-data", UA, "User acceptance testing", "UAT: automations and data", "client", [22, 25], {
    type: "uat",
    optional: true,
    deps: ["config-ready-for-uat"],
    description: "Check that automatic messages and stage moves fire correctly and candidate data lands in the right fields.",
  }),
  item("uat-channels", UA, "User acceptance testing", "UAT: message delivery on each channel", "client", [22, 25], {
    type: "uat",
    optional: true,
    deps: ["config-ready-for-uat"],
    description: "Confirm email, SMS, WhatsApp and Messenger messages arrive and read correctly.",
  }),
  item("uat-voice-ai", UA, "User acceptance testing", "UAT: AI agent test calls", "client", [22, 24], {
    type: "uat",
    optional: true,
    deps: ["config-ready-for-uat", "channel-ai-agents"],
    description: "Take a test call or interview and check that the scores and answers appear on the candidate profile.",
  }),
  item("uat-integrations", UA, "User acceptance testing", "UAT: integration tests", "shared", [22, 25], {
    type: "uat",
    optional: true,
    deps: ["integration-ats-hris", "integration-assessment"],
    description: "Confirm candidate data reaches your other systems correctly.",
  }),
  item("uat-revisions", UA, "User acceptance testing", "UAT revisions", "shared", [26, 30], {
    priority: "high",
    deps: ["uat-happy-path", "uat-non-happy-path", "uat-duplicates"],
    description: "Fix what UAT found and retest the fixes.",
  }),
  item("uat-signoff", UA, "User acceptance testing", "UAT sign-off", "shared", [30, 30], {
    type: "decision",
    priority: "high",
    milestone: true,
    deps: ["uat-revisions"],
    description: "You confirm the setup is ready to go live.",
  }),

  // ---------------------------------------------------------------- Training (week 7)
  item("training-champion", TR, "Training", "Champion training: Company Settings, configuration and end-user use", "shared", [31, 33], {
    type: "training",
    priority: "high",
    deps: ["uat-signoff"],
    description: "Train your champions on Company Settings, how things are configured, and day-to-day use.",
  }),
  item("training-ps", TR, "Training", "PS training: about the client, process flow, what to expect", "internal", [31, 33], {
    type: "training",
    deps: ["uat-signoff"],
    description: "Brief the support team on the client, the process flow and what to expect after go-live.",
  }),
  item("training-wiki", TR, "Training", "Documentation and wiki handover", "shared", [31, 35], {
    type: "training",
    deps: ["uat-signoff"],
    description: "Hand over written guides so your team can look things up after training.",
  }),

  // ---------------------------------------------------------------- Go-live (week 7)
  item("golive-rollback-plan", GL, "Go-live", "Rollback plan", "internal", [31, 33], {
    optional: true,
    deps: ["uat-signoff"],
    description: "Agree how to switch back or pause if something goes wrong at launch.",
  }),
  item("golive-go-no-go", GL, "Go-live", "Go / no-go check", "shared", [34, 34], {
    type: "decision",
    priority: "high",
    milestone: true,
    deps: ["training-champion"],
    description: "A final check that everything is ready, and a joint decision to go live.",
  }),
  item("golive-activate-sourcing", GL, "Go-live", "Switch on sourcing", "shared", [34, 34], {
    deps: ["golive-go-no-go"],
    description: "Turn on the places candidates apply from: ads, job boards and career page links.",
  }),
  item("golive-cutover", GL, "Go-live", "Production cutover: first real candidate added and processed", "shared", [35, 35], {
    priority: "high",
    milestone: true,
    deps: ["golive-go-no-go", "golive-activate-sourcing"],
    description: "Go live. This is done when the first real candidate has been added and processed through the process.",
  }),

  // ---------------------------------------------------------------- Hypercare (weeks 8-9)
  item("hypercare-dashboard", HC, "Hypercare", "Custom dashboard", "shared", [26, 40], {
    optional: true,
    description: "Agree the reports you want and have them built. Requirements start during UAT because building takes time.",
  }),
  item("hypercare-bugs", HC, "Hypercare", "Monitor and fix issues", "shared", [36, 45], {
    priority: "high",
    deps: ["golive-cutover"],
    description: "Talkpush watches for issues after launch and fixes them quickly.",
  }),
  item("hypercare-metrics", HC, "Hypercare", "Monitor metrics and outcomes against success metrics", "shared", [36, 45], {
    priority: "high",
    deps: ["golive-cutover", "scoping-success-metrics"],
    description: "Compare results with the baseline and targets agreed in scoping.",
  }),
  item("hypercare-exit", HC, "Hypercare", "Hypercare exit and handover to support", "shared", [45, 45], {
    type: "decision",
    milestone: true,
    deps: ["hypercare-bugs", "hypercare-metrics"],
    description: "Close the project: confirm outcomes, hand over to ongoing support.",
  }),
];
