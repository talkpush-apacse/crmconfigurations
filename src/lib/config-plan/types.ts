/**
 * The Talkpush MCP Configuration Plan: for one client, what to create in the CRM, built from the captured
 * CRM Config Checklist and the Process Workflow. READ-ONLY: it describes work, it never writes to a CRM.
 */

export type SectionKey =
  | "attributes"
  | "labels"
  | "folders"
  | "rejection_reasons"
  | "documents"
  | "questions"
  | "message_templates"
  | "autoflows"
  | "autoflow_sets"
  | "campaigns"
  | "ai_agents"
  | "chatbot"
  | "users"
  | "sites"
  | "sources"
  | "integrations"
  | "company_settings"
  | "admin_settings";

/** mcp = Claude can create it with the Talkpush CRM tools; manual = do it in the CRM by hand; ticket = another team does it. */
export type Configure = "mcp" | "manual" | "ticket";

export type EntrySource = "both" | "checklist" | "workflow";

export interface StepRef {
  /** The step number in the workflow ("3.1"), or "" when it cannot be numbered. */
  step: string;
  label: string;
  /** "field" = the workflow step has this name in a dedicated field. "wording" = read from the step's title. */
  basis: "field" | "wording";
}

export interface PlanEntry {
  name: string;
  source: EntrySource;
  /** A safe extra fact from the checklist row (for example a data type). Never a secret, never contact details. */
  detail?: string;
  steps?: StepRef[];
  /** A close-but-different name on the other side. Shown for a person to decide; never merged. */
  possibleMatch?: string;
}

export interface Unresolved {
  section: SectionKey;
  step: string;
  label: string;
  reason: string;
}

export interface PlanSection {
  key: SectionKey;
  label: string;
  configure: Configure;
  /** The Talkpush CRM tools that create this kind of object (empty unless configure is "mcp"). */
  tools: string[];
  /** 1 = build first. Objects in a later number depend on earlier ones. */
  order: number;
  dependsOn: SectionKey[];
  note?: string;
  entries: PlanEntry[];
  counts: { total: number; both: number; checklistOnly: number; workflowOnly: number };
}

export interface ConfigPlan {
  client: string;
  checklist: { slug: string; clientName: string; version: number };
  workflow: { id: string; name: string; version: "published" | "current"; stepCount: number } | null;
  sections: PlanSection[];
  /** Steps that name something to configure only in their wording, or not at all. A person has to decide. */
  unresolved: Unresolved[];
  /** Workflow things the checklist does not list yet, per section: candidates to add to the checklist. */
  workflowNotInChecklist: { section: SectionKey; label: string; names: string[] }[];
  /** Checklist things no workflow step mentions: not an error, but worth a look. */
  checklistNotInWorkflow: { section: SectionKey; label: string; names: string[] }[];
  warnings: string[];
}
