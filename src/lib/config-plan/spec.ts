import type { Configure, SectionKey } from "./types";

/**
 * How each kind of CRM object gets configured, and in what order.
 *
 * "tools" are tool names on the separate Talkpush CRM MCP connector. This app cannot see that connector, so this
 * table is the one place to correct when a tool is added or removed there. Where there is no create tool the
 * object is "manual" (do it in the CRM) or "ticket" (another team does it).
 *
 * Order follows the CRM dependency chain: attributes, labels and folders first; questions and message templates
 * next; then autoflows, autoflow sets, and campaigns last.
 */

export interface SectionSpec {
  label: string;
  configure: Configure;
  tools: string[];
  order: number;
  dependsOn: SectionKey[];
  note?: string;
}

export const SECTION_SPECS: Record<SectionKey, SectionSpec> = {
  attributes: { label: "Candidate attributes", configure: "mcp", tools: ["create_candidate_attribute"], order: 1, dependsOn: [] },
  labels: { label: "Labels", configure: "mcp", tools: ["create_label"], order: 1, dependsOn: [] },
  folders: { label: "Folders (pipeline stages)", configure: "mcp", tools: ["create_company_folder"], order: 1, dependsOn: [] },
  rejection_reasons: {
    label: "Rejection and shortlisting reasons",
    configure: "manual",
    tools: [],
    order: 1,
    dependsOn: [],
    note: "No create tool exists on the CRM connector. Add them in Company Settings.",
  },
  documents: {
    label: "Document templates",
    configure: "manual",
    tools: [],
    order: 1,
    dependsOn: [],
    note: "No create tool exists on the CRM connector. Add them under Templates, Documents. File-upload questions need them.",
  },
  questions: {
    label: "Questions and question sets",
    configure: "mcp",
    tools: ["create_question", "create_question_set", "link_questions_to_set"],
    order: 2,
    dependsOn: ["attributes", "documents"],
  },
  message_templates: {
    label: "Message templates",
    configure: "mcp",
    tools: ["create_message_template"],
    order: 2,
    dependsOn: [],
    note: "WhatsApp templates also need Meta approval, which takes time. Email, SMS, WhatsApp and Messenger are separate bodies per template.",
  },
  autoflows: {
    label: "Autoflows",
    configure: "mcp",
    tools: ["create_autoflow", "create_autoflow_rules_draft"],
    order: 3,
    dependsOn: ["folders", "attributes", "message_templates", "questions"],
    note: "One action per autoflow. A move plus a message is two autoflows.",
  },
  autoflow_sets: {
    label: "Autoflow sets",
    configure: "manual",
    tools: [],
    order: 4,
    dependsOn: ["autoflows"],
    note: "The CRM connector can update and reorder sets but this plan found no tool to create one. Check before relying on it.",
  },
  campaigns: {
    label: "Campaigns",
    configure: "mcp",
    tools: ["create_campaign", "link_questions_to_campaign", "associate_campaign_folder", "update_campaign_message_settings"],
    order: 5,
    dependsOn: ["autoflow_sets", "questions", "users"],
  },
  ai_agents: {
    label: "AI voice agents",
    configure: "mcp",
    tools: ["create_voice_agent"],
    order: 3,
    dependsOn: ["questions", "attributes"],
    note: "The playbook routes AI agent creation and voice cloning through the CD team. Confirm before creating one here.",
  },
  chatbot: {
    label: "Chatbot (WhatsApp and Messenger)",
    configure: "ticket",
    tools: [],
    order: 3,
    dependsOn: ["questions", "message_templates"],
    note: "Built by the CD team from a ticket. Define the flow from the approved workflow.",
  },
  users: { label: "Users and roles", configure: "manual", tools: [], order: 4, dependsOn: [], note: "Add under Company Settings, Teams. Campaigns need them for permissions." },
  sites: { label: "Sites and recruitment centers", configure: "manual", tools: [], order: 2, dependsOn: [], note: "One site, one recruitment center, one campaign. Booking questions need the recruitment center." },
  sources: { label: "Sourcing channels", configure: "manual", tools: [], order: 6, dependsOn: ["campaigns"], note: "Set in each campaign's Sourcing section, plus job boards, referral and agency portals." },
  integrations: { label: "Integrations", configure: "ticket", tools: [], order: 3, dependsOn: ["folders", "attributes"], note: "The Integration team builds these. Needs the trigger folders and attribute mapping first." },
  company_settings: { label: "Company settings", configure: "manual", tools: [], order: 1, dependsOn: [], note: "Company details, duplicate management and business hours are set in Company Settings." },
  admin_settings: { label: "Admin settings", configure: "manual", tools: [], order: 1, dependsOn: [], note: "Talkpush staff only. Values are not shown in this plan." },
};

/** The sections whose names are compared between the checklist and the workflow. */
export const MATCHED_SECTIONS: SectionKey[] = ["folders", "message_templates", "rejection_reasons", "integrations"];
