export interface SeedWorkflowTemplate {
  name: string;
  description: string;
  industry: "bpo" | "retail" | "general";
  nodes: unknown[];
  edges: unknown[];
}

type TemplateNodeType =
  | "source"
  | "stage"
  | "decision"
  | "communication"
  | "integration"
  | "parallel"
  | "wait"
  | "manual_action";

type TemplateActor =
  | "automated"
  | "manual"
  | "integration"
  | "candidate"
  | "source";

function node(
  id: string,
  type: TemplateNodeType,
  x: number,
  y: number,
  label: string,
  actor: TemplateActor | undefined,
  actorLabel: string,
  notes: string,
  data: Record<string, string> = {},
  feasibility: "confirmed" | "likely" | "needs_review" = "confirmed",
  feasibilityNote?: string
) {
  return {
    id,
    type,
    position: { x, y },
    data: {
      label,
      type,
      actor,
      actorLabel,
      notes,
      feasibility,
      feasibilityNote,
      data,
    },
  };
}

function edge(
  id: string,
  source: string,
  target: string,
  label = "",
  data: Record<string, string | boolean> = {}
) {
  return {
    id,
    source,
    target,
    type: "smoothstep",
    data: {
      label,
      isHappyPath: false,
      isRecovery: false,
      ...data,
    },
  };
}

const bpoScreeningNodes = [
  { id: "t1_1", type: "source", position: { x: 230, y: 0 }, data: { label: "Job Board / Referral Source", type: "source", actor: "source", actorLabel: "JobStreet / Indeed", notes: "Candidate enters via job board or referral link", feasibility: "confirmed", data: {} } },
  { id: "t1_2", type: "stage", position: { x: 230, y: 120 }, data: { label: "Applied", type: "stage", actor: "automated", actorLabel: "Autoflow", notes: "Candidate lands in Applied folder", feasibility: "confirmed", data: { talkpushStage: "Applied" } } },
  { id: "t1_3", type: "communication", position: { x: 230, y: 240 }, data: { label: "Send Screening Chatbot", type: "communication", actor: "automated", actorLabel: "Autoflow", notes: "Sends question set with screening questions", feasibility: "confirmed", data: { talkpushAction: "send_question_set" } } },
  { id: "t1_4", type: "stage", position: { x: 230, y: 360 }, data: { label: "Screening Complete", type: "stage", actor: "automated", actorLabel: "Autoflow", notes: "Candidate completes chatbot screening", feasibility: "confirmed", data: { talkpushStage: "Screening Complete" } } },
  { id: "t1_5", type: "decision", position: { x: 230, y: 480 }, data: { label: "Qualified?", type: "decision", actor: "automated", actorLabel: "Lead Scoring", notes: "Lead score threshold check", feasibility: "confirmed", data: { talkpushAction: "trigger_lead_scoring" } } },
  { id: "t1_6", type: "communication", position: { x: 0, y: 600 }, data: { label: "Send Rejection SMS", type: "communication", actor: "automated", actorLabel: "Autoflow", notes: "Sends polite rejection message", feasibility: "confirmed", data: { talkpushAction: "send_sms" } } },
  { id: "t1_7", type: "stage", position: { x: 0, y: 720 }, data: { label: "Rejected", type: "stage", actor: "automated", actorLabel: "Autoflow", notes: "Moved to Rejected folder", feasibility: "confirmed", data: { talkpushStage: "Rejected", talkpushAction: "move_candidate" } } },
  { id: "t1_8", type: "communication", position: { x: 460, y: 600 }, data: { label: "AI Screening Call", type: "communication", actor: "automated", actorLabel: "Voice AI", notes: "Automated voice screening with TalkScore", feasibility: "confirmed", data: { talkpushAction: "voice_ai_call" } } },
  { id: "t1_9", type: "decision", position: { x: 460, y: 720 }, data: { label: "Pass AI Screen?", type: "decision", actor: "automated", actorLabel: "TalkScore", notes: "TalkScore evaluation", feasibility: "confirmed", data: {} } },
  { id: "t1_10", type: "stage", position: { x: 460, y: 840 }, data: { label: "Interview Scheduled", type: "stage", actor: "candidate", actorLabel: "Candidate", notes: "Candidate books via Recruitment Center", feasibility: "confirmed", data: { talkpushStage: "Interview Scheduled" } } },
  { id: "t1_11", type: "manual_action", position: { x: 460, y: 960 }, data: { label: "Conduct Ops Interview", type: "manual_action", actor: "manual", actorLabel: "Recruiter", notes: "Face-to-face or video interview", feasibility: "confirmed", data: { targetFolder: "Interview" } } },
  { id: "t1_12", type: "decision", position: { x: 460, y: 1080 }, data: { label: "Pass Interview?", type: "decision", actor: "manual", actorLabel: "Recruiter", notes: "Recruiter decides pass or fail", feasibility: "confirmed", data: {} } },
  { id: "t1_13", type: "stage", position: { x: 460, y: 1200 }, data: { label: "Hired", type: "stage", actor: "manual", actorLabel: "Recruiter", notes: "Candidate receives offer and is marked hired", feasibility: "confirmed", data: { talkpushStage: "Hired" } } },
];

const bpoScreeningEdges = [
  { id: "t1_e1", source: "t1_1", target: "t1_2", type: "smoothstep", data: { label: "" } },
  { id: "t1_e2", source: "t1_2", target: "t1_3", type: "smoothstep", data: { label: "" } },
  { id: "t1_e3", source: "t1_3", target: "t1_4", type: "smoothstep", data: { label: "" } },
  { id: "t1_e4", source: "t1_4", target: "t1_5", type: "smoothstep", data: { label: "" } },
  { id: "t1_e5", source: "t1_5", target: "t1_6", type: "smoothstep", data: { label: "Fail" } },
  { id: "t1_e6", source: "t1_6", target: "t1_7", type: "smoothstep", data: { label: "" } },
  { id: "t1_e7", source: "t1_5", target: "t1_8", type: "smoothstep", data: { label: "Pass" } },
  { id: "t1_e8", source: "t1_8", target: "t1_9", type: "smoothstep", data: { label: "" } },
  { id: "t1_e9", source: "t1_9", target: "t1_7", type: "smoothstep", data: { label: "Fail" } },
  { id: "t1_e10", source: "t1_9", target: "t1_10", type: "smoothstep", data: { label: "Pass" } },
  { id: "t1_e11", source: "t1_10", target: "t1_11", type: "smoothstep", data: { label: "" } },
  { id: "t1_e12", source: "t1_11", target: "t1_12", type: "smoothstep", data: { label: "" } },
  { id: "t1_e13", source: "t1_12", target: "t1_7", type: "smoothstep", data: { label: "Fail" } },
  { id: "t1_e14", source: "t1_12", target: "t1_13", type: "smoothstep", data: { label: "Pass" } },
];

const bpoOnboardingNodes = [
  { id: "t2_1", type: "stage", position: { x: 230, y: 0 }, data: { label: "Offer Accepted", type: "stage", actor: "manual", actorLabel: "Recruiter", notes: "Candidate accepts verbal/written offer", feasibility: "confirmed", data: { talkpushStage: "Offer Accepted" } } },
  { id: "t2_2", type: "communication", position: { x: 230, y: 120 }, data: { label: "Send Doc Collection Form", type: "communication", actor: "automated", actorLabel: "Autoflow", notes: "Sends onboarding question set for document uploads", feasibility: "confirmed", data: { talkpushAction: "send_question_set" } } },
  { id: "t2_3", type: "stage", position: { x: 230, y: 240 }, data: { label: "Docs Submitted", type: "stage", actor: "candidate", actorLabel: "Candidate", notes: "All required documents uploaded", feasibility: "confirmed", data: { talkpushStage: "Docs Submitted" } } },
  { id: "t2_4", type: "parallel", position: { x: 230, y: 360 }, data: { label: "BI + PEME Check", type: "parallel", actor: "automated", actorLabel: "System", notes: "Background investigation and pre-employment medical run in parallel", feasibility: "confirmed", data: {} } },
  { id: "t2_5", type: "integration", position: { x: 0, y: 480 }, data: { label: "Push to BGV Vendor", type: "integration", actor: "integration", actorLabel: "Sterling / Authbridge", notes: "Send candidate data to background check vendor", feasibility: "likely", feasibilityNote: "Requires integration ticket - confirm vendor API availability", data: {} } },
  { id: "t2_6", type: "integration", position: { x: 460, y: 480 }, data: { label: "Push to PEME Vendor", type: "integration", actor: "integration", actorLabel: "Hi-Precision", notes: "Send candidate to pre-employment medical exam vendor", feasibility: "likely", feasibilityNote: "Requires integration ticket - confirm PEME vendor supports API", data: {} } },
  { id: "t2_7", type: "wait", position: { x: 230, y: 600 }, data: { label: "Wait for Results", type: "wait", actor: "automated", actorLabel: "System", notes: "Wait for both BGV and PEME results to return", feasibility: "confirmed", data: { waitDuration: "3-5 business days" } } },
  { id: "t2_8", type: "decision", position: { x: 230, y: 720 }, data: { label: "Both Pass?", type: "decision", actor: "manual", actorLabel: "HR", notes: "HR reviews BGV and PEME results", feasibility: "confirmed", data: {} } },
  { id: "t2_9", type: "communication", position: { x: 230, y: 840 }, data: { label: "Send Contract", type: "communication", actor: "automated", actorLabel: "Autoflow", notes: "Send employment contract via email", feasibility: "confirmed", data: { talkpushAction: "send_email" } } },
  { id: "t2_10", type: "stage", position: { x: 230, y: 960 }, data: { label: "Contract Signed", type: "stage", actor: "candidate", actorLabel: "Candidate", notes: "Candidate signs and returns contract", feasibility: "confirmed", data: { talkpushStage: "Contract Signed" } } },
  { id: "t2_11", type: "stage", position: { x: 230, y: 1080 }, data: { label: "Day 1 - Hired", type: "stage", actor: "manual", actorLabel: "HR", notes: "Candidate reports for first day", feasibility: "confirmed", data: { talkpushStage: "Hired" } } },
];

const bpoOnboardingEdges = [
  { id: "t2_e1", source: "t2_1", target: "t2_2", type: "smoothstep", data: { label: "" } },
  { id: "t2_e2", source: "t2_2", target: "t2_3", type: "smoothstep", data: { label: "" } },
  { id: "t2_e3", source: "t2_3", target: "t2_4", type: "smoothstep", data: { label: "" } },
  { id: "t2_e4", source: "t2_4", target: "t2_5", type: "smoothstep", data: { label: "" } },
  { id: "t2_e5", source: "t2_4", target: "t2_6", type: "smoothstep", data: { label: "" } },
  { id: "t2_e6", source: "t2_5", target: "t2_7", type: "smoothstep", data: { label: "" } },
  { id: "t2_e7", source: "t2_6", target: "t2_7", type: "smoothstep", data: { label: "" } },
  { id: "t2_e8", source: "t2_7", target: "t2_8", type: "smoothstep", data: { label: "" } },
  { id: "t2_e9", source: "t2_8", target: "t2_9", type: "smoothstep", data: { label: "Pass" } },
  { id: "t2_e10", source: "t2_9", target: "t2_10", type: "smoothstep", data: { label: "" } },
  { id: "t2_e11", source: "t2_10", target: "t2_11", type: "smoothstep", data: { label: "" } },
];

const retailHiringNodes = [
  { id: "t3_1", type: "source", position: { x: 230, y: 0 }, data: { label: "Walk-in / QR / Job Board", type: "source", actor: "source", actorLabel: "Multiple Channels", notes: "Candidates apply via walk-in QR code, online job boards, or store posters", feasibility: "confirmed", data: {} } },
  { id: "t3_2", type: "stage", position: { x: 230, y: 120 }, data: { label: "Applied", type: "stage", actor: "automated", actorLabel: "Autoflow", notes: "Application received in Applied folder", feasibility: "confirmed", data: { talkpushStage: "Applied" } } },
  { id: "t3_3", type: "communication", position: { x: 230, y: 240 }, data: { label: "Chatbot Screening", type: "communication", actor: "automated", actorLabel: "Autoflow", notes: "Automated screening via Messenger or landing page chatbot", feasibility: "confirmed", data: { talkpushAction: "send_question_set" } } },
  { id: "t3_4", type: "decision", position: { x: 230, y: 360 }, data: { label: "Meets Requirements?", type: "decision", actor: "automated", actorLabel: "Lead Scoring", notes: "Automated qualification based on location, availability, experience", feasibility: "confirmed", data: { talkpushAction: "trigger_lead_scoring" } } },
  { id: "t3_5", type: "manual_action", position: { x: 230, y: 480 }, data: { label: "Share to Store Manager", type: "manual_action", actor: "automated", actorLabel: "Autoflow", notes: "Profile shared to store manager for review", feasibility: "confirmed", data: { talkpushAction: "share_profile" } } },
  { id: "t3_6", type: "manual_action", position: { x: 230, y: 600 }, data: { label: "Store Manager Interview", type: "manual_action", actor: "manual", actorLabel: "Store Manager", notes: "In-store interview conducted by manager", feasibility: "confirmed", data: { targetFolder: "Interview" } } },
  { id: "t3_7", type: "decision", position: { x: 230, y: 720 }, data: { label: "Hire?", type: "decision", actor: "manual", actorLabel: "Store Manager", notes: "Manager makes hire/no-hire decision", feasibility: "confirmed", data: {} } },
  { id: "t3_8", type: "communication", position: { x: 230, y: 840 }, data: { label: "Send Offer", type: "communication", actor: "automated", actorLabel: "Autoflow", notes: "Automated offer email sent to candidate", feasibility: "confirmed", data: { talkpushAction: "send_email" } } },
  { id: "t3_9", type: "stage", position: { x: 230, y: 960 }, data: { label: "Hired", type: "stage", actor: "manual", actorLabel: "HR", notes: "Candidate officially hired and onboarded", feasibility: "confirmed", data: { talkpushStage: "Hired" } } },
];

const retailHiringEdges = [
  { id: "t3_e1", source: "t3_1", target: "t3_2", type: "smoothstep", data: { label: "" } },
  { id: "t3_e2", source: "t3_2", target: "t3_3", type: "smoothstep", data: { label: "" } },
  { id: "t3_e3", source: "t3_3", target: "t3_4", type: "smoothstep", data: { label: "" } },
  { id: "t3_e4", source: "t3_4", target: "t3_5", type: "smoothstep", data: { label: "Pass" } },
  { id: "t3_e5", source: "t3_5", target: "t3_6", type: "smoothstep", data: { label: "" } },
  { id: "t3_e6", source: "t3_6", target: "t3_7", type: "smoothstep", data: { label: "" } },
  { id: "t3_e7", source: "t3_7", target: "t3_8", type: "smoothstep", data: { label: "Yes" } },
  { id: "t3_e8", source: "t3_8", target: "t3_9", type: "smoothstep", data: { label: "" } },
];

const highVolumeScreeningNodes = [
  node("se1_1", "source", 230, 0, "Candidate Applies", "source", "Job Boards / QR / Referrals", "Applications arrive from high-volume sources", { campaignType: "job_application" }),
  node("se1_2", "communication", 230, 120, "Send Screening Chatbot", "automated", "Autoflow", "Send screening question set immediately", { channel: "messenger", messageTemplate: "Screening question set", talkpushAction: "send_question_set" }),
  node("se1_3", "decision", 230, 240, "Qualified?", "automated", "Lead Scoring", "Evaluate knockout questions and lead score", { talkpushAction: "trigger_lead_scoring" }),
  node("se1_4", "communication", 0, 360, "Send Rejection Message", "automated", "Autoflow", "Notify candidates who do not meet requirements", { channel: "sms", messageTemplate: "Rejection SMS", talkpushAction: "send_sms" }),
  node("se1_5", "stage", 0, 480, "Rejected", "automated", "Autoflow", "Move to rejected folder", { targetFolder: "Rejected", talkpushStage: "Rejected" }),
  node("se1_6", "communication", 460, 360, "Invite to Interview", "automated", "Autoflow", "Send interview scheduling link to qualified candidates", { channel: "email", messageTemplate: "Interview invite", talkpushAction: "send_email" }),
  node("se1_7", "stage", 460, 480, "Interview Scheduled", "candidate", "Candidate", "Candidate books an interview slot", { talkpushStage: "Interview Scheduled" }),
  node("se1_8", "manual_action", 460, 600, "Recruiter Interview", "manual", "Recruiter", "Recruiter conducts interview", { ownerRole: "Recruiter", targetFolder: "Interview" }),
  node("se1_9", "decision", 460, 720, "Pass Interview?", "manual", "Recruiter", "Recruiter decides pass or fail", { ownerRole: "Recruiter" }),
  node("se1_10", "stage", 460, 840, "Hired", "manual", "Recruiter", "Candidate is moved to hired stage", { talkpushStage: "Hired" }),
];

const highVolumeScreeningEdges = [
  edge("se1_e1", "se1_1", "se1_2"),
  edge("se1_e2", "se1_2", "se1_3"),
  edge("se1_e3", "se1_3", "se1_4", "Fail"),
  edge("se1_e4", "se1_4", "se1_5"),
  edge("se1_e5", "se1_3", "se1_6", "Pass", { isHappyPath: true, isPrimary: true }),
  edge("se1_e6", "se1_6", "se1_7"),
  edge("se1_e7", "se1_7", "se1_8"),
  edge("se1_e8", "se1_8", "se1_9"),
  edge("se1_e9", "se1_9", "se1_5", "Fail"),
  edge("se1_e10", "se1_9", "se1_10", "Pass", { isHappyPath: true, isPrimary: true }),
];

const interviewNoShowNodes = [
  node("se2_1", "source", 230, 0, "Qualified Candidate", "source", "Screening Flow", "Candidate reached interview scheduling step", { talkpushStage: "Qualified" }),
  node("se2_2", "communication", 230, 120, "Send Scheduling Link", "automated", "Autoflow", "Send self-scheduling link", { channel: "email", messageTemplate: "Interview scheduler", talkpushAction: "send_email" }),
  node("se2_3", "stage", 230, 240, "Interview Scheduled", "candidate", "Candidate", "Candidate selects an interview slot", { talkpushStage: "Interview Scheduled" }),
  node("se2_4", "wait", 230, 360, "Wait Until Interview Time", "automated", "System", "Hold until scheduled interview time", { waitDuration: "Until scheduled interview time" }),
  node("se2_5", "decision", 230, 480, "Attended?", "manual", "Recruiter", "Recruiter marks attendance outcome", { ownerRole: "Recruiter" }),
  node("se2_6", "manual_action", 460, 600, "Conduct Interview", "manual", "Recruiter", "Recruiter interviews candidate", { ownerRole: "Recruiter" }),
  node("se2_7", "communication", 0, 600, "Send No-show Recovery", "automated", "Autoflow", "Send rescheduling message after no-show", { channel: "sms", messageTemplate: "No-show reschedule", talkpushAction: "send_sms" }),
  node("se2_8", "decision", 460, 720, "Pass Interview?", "manual", "Recruiter", "Recruiter decides if candidate proceeds", { ownerRole: "Recruiter" }),
  node("se2_9", "stage", 460, 840, "Passed Interview", "manual", "Recruiter", "Candidate proceeds to next step", { talkpushStage: "Passed Interview" }),
];

const interviewNoShowEdges = [
  edge("se2_e1", "se2_1", "se2_2"),
  edge("se2_e2", "se2_2", "se2_3"),
  edge("se2_e3", "se2_3", "se2_4"),
  edge("se2_e4", "se2_4", "se2_5"),
  edge("se2_e5", "se2_5", "se2_6", "Yes", { isHappyPath: true, isPrimary: true }),
  edge("se2_e6", "se2_5", "se2_7", "No-show"),
  edge("se2_e7", "se2_7", "se2_2", "Reschedule", { isRecovery: true }),
  edge("se2_e8", "se2_6", "se2_8"),
  edge("se2_e9", "se2_8", "se2_9", "Pass", { isHappyPath: true, isPrimary: true }),
];

const offerDocsNodes = [
  node("se3_1", "source", 230, 0, "Offer Accepted", "manual", "Recruiter", "Candidate accepts the offer", { talkpushStage: "Offer Accepted" }),
  node("se3_2", "communication", 230, 120, "Send Document Checklist", "automated", "Autoflow", "Send document collection form", { channel: "email", messageTemplate: "Document checklist", talkpushAction: "send_email" }),
  node("se3_3", "wait", 230, 240, "Wait for Documents", "automated", "System", "Wait for candidate uploads", { waitDuration: "48 hours" }),
  node("se3_4", "decision", 230, 360, "Documents Complete?", "manual", "HR", "HR checks uploaded documents", { ownerRole: "HR" }),
  node("se3_5", "communication", 0, 480, "Send Missing Docs Reminder", "automated", "Autoflow", "Ask candidate to complete missing items", { channel: "sms", messageTemplate: "Missing documents reminder", talkpushAction: "send_sms" }),
  node("se3_6", "manual_action", 460, 480, "Verify Documents", "manual", "HR", "HR verifies submitted documents", { ownerRole: "HR" }),
  node("se3_7", "communication", 460, 600, "Send Contract", "automated", "Autoflow", "Send employment contract", { channel: "email", messageTemplate: "Contract email", talkpushAction: "send_email" }),
  node("se3_8", "stage", 460, 720, "Ready for Day 1", "manual", "HR", "Candidate is cleared for onboarding", { talkpushStage: "Ready for Day 1" }),
];

const offerDocsEdges = [
  edge("se3_e1", "se3_1", "se3_2"),
  edge("se3_e2", "se3_2", "se3_3"),
  edge("se3_e3", "se3_3", "se3_4"),
  edge("se3_e4", "se3_4", "se3_5", "No"),
  edge("se3_e5", "se3_5", "se3_3", "Retry", { isRecovery: true }),
  edge("se3_e6", "se3_4", "se3_6", "Yes", { isHappyPath: true, isPrimary: true }),
  edge("se3_e7", "se3_6", "se3_7"),
  edge("se3_e8", "se3_7", "se3_8"),
];

const atsSyncNodes = [
  node("se4_1", "source", 230, 0, "Candidate Stage Changes", "source", "Talkpush", "Candidate stage update triggers sync", { talkpushStage: "Any mapped stage" }),
  node("se4_2", "decision", 230, 120, "Mapped Status?", "automated", "Autoflow", "Check if stage has a configured ATS status mapping", { talkpushAction: "move_candidate" }),
  node("se4_3", "manual_action", 0, 240, "Review Mapping Gap", "manual", "Implementation Team", "Implementation team confirms missing status mapping", { ownerRole: "Implementation Team" }, "needs_review", "Confirm each customer ATS status before launch"),
  node("se4_4", "integration", 460, 240, "Push Status to ATS", "integration", "ATS API", "Send mapped status update", { integrationSystem: "ATS", integrationDirection: "push", talkpushAction: "webhook" }, "likely", "Requires customer ATS API credentials and webhook mapping"),
  node("se4_5", "wait", 460, 360, "Wait for ATS Response", "automated", "System", "Wait for success or error response", { waitDuration: "Up to 5 minutes" }),
  node("se4_6", "decision", 460, 480, "Sync Successful?", "integration", "ATS API", "Evaluate sync response", { integrationSystem: "ATS", integrationDirection: "bidirectional" }),
  node("se4_7", "stage", 460, 600, "Status Synced", "automated", "Autoflow", "Store successful sync result", { talkpushStage: "Synced" }),
  node("se4_8", "manual_action", 0, 600, "Resolve Sync Error", "manual", "Implementation Team", "Investigate failed sync payload", { ownerRole: "Implementation Team" }),
];

const atsSyncEdges = [
  edge("se4_e1", "se4_1", "se4_2"),
  edge("se4_e2", "se4_2", "se4_3", "No"),
  edge("se4_e3", "se4_2", "se4_4", "Yes", { isHappyPath: true, isPrimary: true }),
  edge("se4_e4", "se4_4", "se4_5"),
  edge("se4_e5", "se4_5", "se4_6"),
  edge("se4_e6", "se4_6", "se4_7", "Yes", { isHappyPath: true, isPrimary: true }),
  edge("se4_e7", "se4_6", "se4_8", "No"),
];

const parallelChecksNodes = [
  node("se5_1", "source", 230, 0, "Candidate Clears Interview", "manual", "Recruiter", "Candidate is ready for pre-employment checks", { talkpushStage: "Pre-employment Checks" }),
  node("se5_2", "communication", 230, 120, "Send Consent Forms", "automated", "Autoflow", "Collect candidate consent for checks", { channel: "email", messageTemplate: "Check consent", talkpushAction: "send_email" }),
  node("se5_3", "parallel", 230, 240, "Run Checks in Parallel", "automated", "System", "Background and reference checks start together", {}),
  node("se5_4", "integration", 0, 360, "Start Background Check", "integration", "BGV Vendor", "Send candidate to background check vendor", { integrationSystem: "BGV Vendor", integrationDirection: "push" }, "likely", "Confirm vendor API support"),
  node("se5_5", "manual_action", 460, 360, "Collect References", "manual", "Recruiter", "Recruiter contacts listed references", { ownerRole: "Recruiter" }),
  node("se5_6", "wait", 230, 480, "Wait for Check Results", "automated", "System", "Wait for both checks to complete", { waitDuration: "3-5 business days" }),
  node("se5_7", "decision", 230, 600, "All Checks Clear?", "manual", "HR", "HR reviews results", { ownerRole: "HR" }),
  node("se5_8", "stage", 460, 720, "Cleared for Offer", "manual", "HR", "Candidate can proceed to offer", { talkpushStage: "Cleared for Offer" }),
  node("se5_9", "manual_action", 0, 720, "Exception Review", "manual", "HR", "HR reviews failed or inconclusive checks", { ownerRole: "HR" }),
];

const parallelChecksEdges = [
  edge("se5_e1", "se5_1", "se5_2"),
  edge("se5_e2", "se5_2", "se5_3"),
  edge("se5_e3", "se5_3", "se5_4", "Background", { isHappyPath: true, isPrimary: true }),
  edge("se5_e4", "se5_3", "se5_5", "References"),
  edge("se5_e5", "se5_4", "se5_6"),
  edge("se5_e6", "se5_5", "se5_6"),
  edge("se5_e7", "se5_6", "se5_7"),
  edge("se5_e8", "se5_7", "se5_8", "Clear", { isHappyPath: true, isPrimary: true }),
  edge("se5_e9", "se5_7", "se5_9", "Issue"),
];

const referralFlowNodes = [
  node("se6_1", "source", 230, 0, "Employee Referral Submitted", "source", "Referral Form", "Employee refers candidate", { campaignType: "job_application" }),
  node("se6_2", "stage", 230, 120, "Create Candidate Profile", "automated", "Autoflow", "Create candidate and attach referrer details", { talkpushAction: "create_application" }),
  node("se6_3", "decision", 230, 240, "Referral Eligible?", "manual", "Recruiter", "Recruiter verifies eligibility rules", { ownerRole: "Recruiter" }),
  node("se6_4", "communication", 0, 360, "Notify Referrer Ineligible", "automated", "Autoflow", "Notify employee if referral is not eligible", { channel: "email", messageTemplate: "Referral ineligible", talkpushAction: "send_email" }),
  node("se6_5", "communication", 460, 360, "Invite Candidate to Screen", "automated", "Autoflow", "Send candidate screening link", { channel: "sms", messageTemplate: "Referral screening invite", talkpushAction: "send_sms" }),
  node("se6_6", "decision", 460, 480, "Candidate Passes Screen?", "automated", "Lead Scoring", "Evaluate referral candidate against requirements", { talkpushAction: "trigger_lead_scoring" }),
  node("se6_7", "manual_action", 460, 600, "Recruiter Interview", "manual", "Recruiter", "Recruiter interviews referred candidate", { ownerRole: "Recruiter" }),
  node("se6_8", "stage", 460, 720, "Referral Hired", "manual", "Recruiter", "Candidate hired through referral", { talkpushStage: "Hired" }),
  node("se6_9", "communication", 460, 840, "Notify Referrer Bonus", "automated", "Autoflow", "Notify employee about referral bonus process", { channel: "email", messageTemplate: "Referral bonus update", talkpushAction: "send_email" }),
];

const referralFlowEdges = [
  edge("se6_e1", "se6_1", "se6_2"),
  edge("se6_e2", "se6_2", "se6_3"),
  edge("se6_e3", "se6_3", "se6_4", "No"),
  edge("se6_e4", "se6_3", "se6_5", "Yes", { isHappyPath: true, isPrimary: true }),
  edge("se6_e5", "se6_5", "se6_6"),
  edge("se6_e6", "se6_6", "se6_4", "Fail"),
  edge("se6_e7", "se6_6", "se6_7", "Pass", { isHappyPath: true, isPrimary: true }),
  edge("se6_e8", "se6_7", "se6_8"),
  edge("se6_e9", "se6_8", "se6_9"),
];

export const workflowTemplates: SeedWorkflowTemplate[] = [
  {
    name: "High-volume screening",
    description:
      "Core SE template for high-volume recruitment: source capture, instant screening, lead scoring, rejection branch, interview invite, recruiter interview, and hire.",
    industry: "bpo",
    nodes: highVolumeScreeningNodes,
    edges: highVolumeScreeningEdges,
  },
  {
    name: "Interview scheduling and no-show recovery",
    description:
      "Scheduling flow with attendance decision and a recovery path that sends no-show candidates back to the scheduling link.",
    industry: "general",
    nodes: interviewNoShowNodes,
    edges: interviewNoShowEdges,
  },
  {
    name: "Offer and onboarding document collection",
    description:
      "Post-offer document collection with missing-document reminders, HR verification, contract send, and ready-for-Day-1 stage.",
    industry: "bpo",
    nodes: offerDocsNodes,
    edges: offerDocsEdges,
  },
  {
    name: "Retail frontline hiring",
    description:
      "Retail frontline hiring flow based on QR/walk-in/job board sourcing, chatbot screening, store manager interview, offer, and hire.",
    industry: "retail",
    nodes: retailHiringNodes,
    edges: retailHiringEdges,
  },
  {
    name: "ATS/HRIS status sync",
    description:
      "Integration scoping template for mapped candidate status updates, ATS push, response wait, success capture, and error resolution.",
    industry: "general",
    nodes: atsSyncNodes,
    edges: atsSyncEdges,
  },
  {
    name: "Background/reference checks in parallel",
    description:
      "Parallel pre-employment check template for background checks and reference checks, with HR review and exception branch.",
    industry: "bpo",
    nodes: parallelChecksNodes,
    edges: parallelChecksEdges,
  },
  {
    name: "Employee referral flow",
    description:
      "Employee referral process with eligibility validation, candidate screening, recruiter interview, hire, and referrer bonus notification.",
    industry: "general",
    nodes: referralFlowNodes,
    edges: referralFlowEdges,
  },
  {
    name: "BPO Screening Flow",
    description:
      "Standard BPO screening pipeline: source -> chatbot screening -> AI voice call -> ops interview -> hire. Includes rejection branches and lead scoring.",
    industry: "bpo",
    nodes: bpoScreeningNodes,
    edges: bpoScreeningEdges,
  },
  {
    name: "BPO Onboarding Flow",
    description:
      "Post-offer onboarding: document collection -> parallel BGV + PEME checks -> contract -> Day 1. Includes integration nodes for vendor APIs.",
    industry: "bpo",
    nodes: bpoOnboardingNodes,
    edges: bpoOnboardingEdges,
  },
  {
    name: "Retail Store Hiring",
    description:
      "Retail hiring flow: walk-in/QR/job board -> chatbot screening -> store manager profile share -> in-store interview -> offer -> hired.",
    industry: "retail",
    nodes: retailHiringNodes,
    edges: retailHiringEdges,
  },
];
