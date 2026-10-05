import { clean, normalizeName } from "./names";
import type { SectionKey } from "./types";

/**
 * Reads the captured CRM Config Checklist into plain names per kind of CRM object.
 *
 * Only an allow-list of safe fields is ever read. Contact details (email, phone), integration endpoints and
 * credentials, and the whole admin-settings block are never read here, so they cannot reach a plan.
 */

export interface ChecklistInput {
  slug: string;
  clientName: string;
  version: number;
  attributes?: unknown;
  labels?: unknown;
  folders?: unknown;
  documents?: unknown;
  messaging?: unknown;
  prescreening?: unknown;
  autoflows?: unknown;
  campaigns?: unknown;
  sites?: unknown;
  users?: unknown;
  sources?: unknown;
  rejectionReasons?: unknown;
  integrations?: unknown;
  atsIntegrations?: unknown;
  fbWhatsapp?: unknown;
  aiCallFaqs?: unknown;
  companyInfo?: unknown;
  communicationChannels?: unknown;
}

export interface Named {
  name: string;
  detail?: string;
}

export type ChecklistFindings = Record<SectionKey, Named[]> & { warnings: string[] };

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  if (!Array.isArray(value)) return [];
  return value.filter((r): r is Row => !!r && typeof r === "object" && !(r as Row).deletedAt);
}

const str = (r: Row, key: string) => clean(r[key]);

function dedupe(list: Named[]): Named[] {
  const seen = new Set<string>();
  return list.filter((n) => {
    const k = normalizeName(n.name);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function named(list: Row[], nameKey: string, detail?: (r: Row) => string | undefined): Named[] {
  return dedupe(
    list
      .map((r) => ({ name: str(r, nameKey), detail: detail?.(r) || undefined }))
      .filter((n) => n.name)
  );
}

function short(text: string, max = 100): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}...` : text;
}

const CHANNELS: [string, string][] = [
  ["emailActive", "email"],
  ["smsActive", "SMS"],
  ["whatsappActive", "WhatsApp"],
  ["messengerActive", "Messenger"],
];

export function readChecklist(input: ChecklistInput): ChecklistFindings {
  const out = {
    attributes: [],
    labels: [],
    folders: [],
    rejection_reasons: [],
    documents: [],
    questions: [],
    message_templates: [],
    autoflows: [],
    autoflow_sets: [],
    campaigns: [],
    ai_agents: [],
    chatbot: [],
    users: [],
    sites: [],
    sources: [],
    integrations: [],
    company_settings: [],
    admin_settings: [],
    warnings: [],
  } as ChecklistFindings;

  out.attributes = named(rows(input.attributes), "attributeName", (r) => [str(r, "dataType"), str(r, "key") && `key ${str(r, "key")}`].filter(Boolean).join(", "));
  out.labels = named(rows(input.labels), "name");
  out.folders = named(rows(input.folders), "folderName", (r) => (str(r, "movementType") ? `${str(r, "movementType").toLowerCase()} moves` : ""));
  out.documents = named(rows(input.documents), "documentName", (r) => (str(r, "required") ? `required: ${str(r, "required")}` : ""));
  out.questions = dedupe(
    rows(input.prescreening)
      .map((r) => ({ name: short(str(r, "question")), detail: [str(r, "category"), str(r, "questionType")].filter(Boolean).join(", ") || undefined }))
      .filter((n) => n.name)
  );

  // Templates the client marked not applicable are left out.
  out.message_templates = dedupe(
    rows(input.messaging)
      .filter((r) => r.notApplicable !== true)
      .map((r) => {
        const channels = CHANNELS.filter(([k]) => r[k] === true).map(([, label]) => label);
        const detail = [channels.length ? channels.join(", ") : "no channel switched on", str(r, "language")].filter(Boolean).join("; ");
        return { name: str(r, "name"), detail };
      })
      .filter((n) => n.name)
  );

  const autoflowRows = rows(input.autoflows);
  out.autoflows = dedupe(
    autoflowRows
      .map((r) => {
        const trigger = str(r, "triggerSource") || "(no trigger)";
        const action = str(r, "action") || "(no action)";
        const target = str(r, "targetFolder");
        const group = str(r, "group");
        return { name: `${group ? `${group}: ` : ""}when ${trigger}, ${action}${target ? ` to ${target}` : ""}`, detail: str(r, "timing") || undefined };
      })
      .filter((n) => n.name)
  );
  out.autoflow_sets = dedupe(
    [...new Set(autoflowRows.map((r) => str(r, "group")).filter(Boolean))].map((g) => ({
      name: g,
      detail: `${autoflowRows.filter((r) => str(r, "group") === g).length} autoflows`,
    }))
  );

  out.campaigns = named(rows(input.campaigns), "nameInternal", (r) => (str(r, "site") ? `site: ${str(r, "site")}` : ""));
  out.sites = named(rows(input.sites), "siteName", (r) => str(r, "interviewType"));
  out.users = named(rows(input.users), "name", (r) => str(r, "accessType")); // never email or phone
  out.sources = dedupe(
    rows(input.sources)
      .map((r) => ({ name: [str(r, "category"), str(r, "subcategory")].filter(Boolean).join(" / ") }))
      .filter((n) => n.name)
  );

  if (Array.isArray(input.rejectionReasons)) {
    out.rejection_reasons = dedupe(input.rejectionReasons.map((v) => ({ name: clean(v) })).filter((n) => n.name));
  }

  // Integrations: names and direction only. Endpoints, auth names and values are never read.
  const generic = rows(input.integrations).map((r) => ({
    name: str(r, "vendorName"),
    detail: [str(r, "vendorCategory"), str(r, "actionType")].filter(Boolean).join(", ") || undefined,
  }));
  const ats = rows(input.atsIntegrations).map((r) => ({
    name: str(r, "name") || str(r, "system"),
    detail: [str(r, "direction"), str(r, "status")].filter(Boolean).join(", ") || undefined,
  }));
  out.integrations = dedupe([...generic, ...ats].filter((n) => n.name));

  const ai = input.aiCallFaqs && typeof input.aiCallFaqs === "object" ? (input.aiCallFaqs as Row) : null;
  if (ai && (str(ai, "agentName") || str(ai, "interviewRole"))) {
    out.ai_agents = [{ name: str(ai, "agentName") || `AI agent for ${str(ai, "interviewRole")}`, detail: str(ai, "callType") || undefined }];
  }
  const fb = input.fbWhatsapp && typeof input.fbWhatsapp === "object" ? (input.fbWhatsapp as Row) : null;
  if (fb && str(fb, "chatbotName")) out.chatbot = [{ name: str(fb, "chatbotName") }];

  // Company settings: a few non-secret facts, so the plan says what to set. Not the whole block.
  const info = input.companyInfo && typeof input.companyInfo === "object" ? (input.companyInfo as Row) : null;
  if (info) {
    if (str(info, "allowDuplicates") || str(info, "coolingPeriod")) {
      out.company_settings.push({
        name: "Duplicate management",
        detail: [str(info, "allowDuplicates") && `allow duplicates: ${str(info, "allowDuplicates")}`, str(info, "coolingPeriod") && `cooling period: ${str(info, "coolingPeriod")}`].filter(Boolean).join("; "),
      });
    }
    const hours = Array.isArray(info.businessHours) ? (info.businessHours as Row[]) : [];
    const open = hours.filter((h) => h.isOpen === true).length;
    if (hours.length > 0) out.company_settings.push({ name: "Business hours", detail: `${open} of ${hours.length} days open` });
  }
  const channels = input.communicationChannels && typeof input.communicationChannels === "object" ? (input.communicationChannels as Row) : null;
  if (channels) {
    const on = Object.entries(channels).filter(([, v]) => v === true).map(([k]) => k);
    if (on.length > 0) out.company_settings.push({ name: "Communication channels", detail: on.join(", ") });
  }
  out.admin_settings = [{ name: "Admin settings (Talkpush staff)" }];

  // Cross-checks inside the checklist itself.
  const folderNames = new Set(out.folders.map((f) => normalizeName(f.name)));
  const templateNames = new Set(out.message_templates.map((t) => normalizeName(t.name)));
  const missingFolders = new Set<string>();
  const missingTemplates = new Set<string>();
  for (const r of autoflowRows) {
    for (const key of ["triggerSource", "targetFolder"]) {
      const v = str(r, key);
      if (r.triggerType === "Attribute Change" && key === "triggerSource") continue;
      if (v && folderNames.size > 0 && !folderNames.has(normalizeName(v))) missingFolders.add(v);
    }
    const t = str(r, "messageTemplate");
    if (t && templateNames.size > 0 && !templateNames.has(normalizeName(t))) missingTemplates.add(t);
  }
  if (missingFolders.size > 0) out.warnings.push(`Autoflow rules use folders that are not in the folders list: ${[...missingFolders].slice(0, 8).join(", ")}.`);
  if (missingTemplates.size > 0) out.warnings.push(`Autoflow rules use message templates that are not in the templates list: ${[...missingTemplates].slice(0, 8).join(", ")}.`);

  return out;
}
