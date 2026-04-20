export interface ConfiguratorSummaryRow {
  id: string;
  path: string;
  testerPerspective: string;
  action: string;
  module: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item))
    : [];
}

function field(row: Record<string, unknown>, key: string): string {
  const raw = row[key];
  if (raw === null || raw === undefined || raw === "") return "";
  if (Array.isArray(raw)) return raw.filter(Boolean).join(", ");
  if (typeof raw === "object") return "";
  return String(raw);
}

function joinValues(values: string[], limit = 8): string {
  const filtered = values.map((value) => value.trim()).filter(Boolean);
  if (filtered.length === 0) return "";
  if (filtered.length <= limit) return filtered.join(", ");
  return `${filtered.slice(0, limit).join(", ")} + ${filtered.length - limit} more`;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function pushRow(
  rows: ConfiguratorSummaryRow[],
  input: Omit<ConfiguratorSummaryRow, "id" | "testerPerspective">
) {
  rows.push({
    id: `${rows.length + 1}-${input.module}-${input.path}`,
    testerPerspective: "Talkpush",
    ...input,
  });
}

export function buildConfiguratorSummaryRows(sourceData: unknown): ConfiguratorSummaryRow[] {
  const source = asRecord(sourceData);
  const rows: ConfiguratorSummaryRow[] = [];
  const company = asRecord(source.companyInfo);

  const companyName = field(company, "companyName");
  const website = field(company, "companyWebsiteUrl");
  const privacyPolicy = field(company, "privacyPolicyUrl");
  const color = field(company, "companyColor");
  const address = field(company, "companyAddress");
  if (companyName || website || privacyPolicy || color || address) {
    pushRow(rows, {
      path: "Admin -> Company Info",
      action: `Confirm company profile${companyName ? ` for ${companyName}` : ""}: address ${address || "not provided"}, website ${website || "not provided"}, privacy policy ${privacyPolicy || "not provided"}, primary color ${color || "not provided"}.`,
      module: "Company Info",
    });
  }

  const duplicateSetting = field(company, "allowDuplicates");
  const coolingPeriod = field(company, "coolingPeriod");
  const rehiresAllowed = field(company, "rehiresAllowed");
  if (duplicateSetting || coolingPeriod || rehiresAllowed) {
    pushRow(rows, {
      path: "Admin -> Company Info",
      action: `Confirm duplicate candidates setting ${duplicateSetting || "not provided"}, cooling period ${coolingPeriod || "not provided"}, and rehires ${rehiresAllowed || "not provided"}.`,
      module: "Company Info",
    });
  }

  const fbWhatsapp = asRecord(source.fbWhatsapp);
  const fbPage = field(company, "fbPageName") || field(fbWhatsapp, "facebookPageName") || field(company, "fbPageUrl") || field(fbWhatsapp, "facebookPageUrl");
  if (fbPage) {
    pushRow(rows, {
      path: "Admin -> Channels",
      action: `Connect and verify Facebook Page: ${fbPage}.`,
      module: "Facebook",
    });
  }

  const users = asRows(source.users);
  if (users.length > 0) {
    const roleSummary = joinValues(Array.from(new Set(users.map((row) => field(row, "accessType")))));
    const siteSummary = joinValues(Array.from(new Set(users.map((row) => field(row, "site")))));
    pushRow(rows, {
      path: "Admin -> Users",
      action: `Create ${plural(users.length, "user")} with correct access types${roleSummary ? ` (${roleSummary})` : ""}${siteSummary ? ` and recruitment centers/sites (${siteSummary})` : ""}.`,
      module: "Users",
    });
  }

  const folders = asRows(source.folders);
  if (folders.length > 0) {
    pushRow(rows, {
      path: "Admin -> Folders",
      action: `Create all ${plural(folders.length, "pipeline folder")}: ${joinValues(folders.map((row) => field(row, "folderName")), 14)}.`,
      module: "Folders",
    });
  }

  const sites = asRows(source.sites);
  if (sites.length > 0) {
    pushRow(rows, {
      path: "Admin -> Sites",
      action: `Create all ${plural(sites.length, "site")} with addresses, interview hours, interview type, maps links, and meeting links: ${joinValues(sites.map((row) => field(row, "siteName") || field(row, "internalName")), 10)}.`,
      module: "Sites",
    });
  }

  const campaigns = asRows(source.campaigns);
  if (campaigns.length > 0) {
    pushRow(rows, {
      path: "Admin -> Campaigns",
      action: `Create all ${plural(campaigns.length, "campaign")} with job titles, sites, recruiters, and routing: ${joinValues(campaigns.map((row) => field(row, "nameInternal") || field(row, "jobTitleExternal")), 10)}.`,
      module: "Campaigns",
    });
  }

  const sources = asRows(source.sources);
  if (sources.length > 0) {
    pushRow(rows, {
      path: "Admin -> Sources",
      action: `Create ${plural(sources.length, "source")} and verify attribution links/UTMs: ${joinValues(sources.map((row) => [field(row, "category"), field(row, "subcategory")].filter(Boolean).join(" - ")), 10)}.`,
      module: "Sources",
    });
  }

  const attributes = asRows(source.attributes);
  if (attributes.length > 0) {
    pushRow(rows, {
      path: "Admin -> Attributes",
      action: `Create ${plural(attributes.length, "candidate attribute")} with correct keys, data types, privacy settings, and suggested values: ${joinValues(attributes.map((row) => field(row, "attributeName")), 12)}.`,
      module: "Attributes",
    });
  }

  const prescreening = asRows(source.prescreening);
  if (prescreening.length > 0) {
    pushRow(rows, {
      path: "Admin -> Questions",
      action: `Create ${plural(prescreening.length, "prescreening question")} with answer options, branching/pass-fail logic, and auto-reject rules where specified.`,
      module: "Prescreening",
    });
  }

  const documents = asRows(source.documents);
  if (documents.length > 0) {
    pushRow(rows, {
      path: "Admin -> Documents",
      action: `Configure ${plural(documents.length, "document type")} with requirement rules, folder access, templates, and applicable campaigns: ${joinValues(documents.map((row) => field(row, "documentName")), 12)}.`,
      module: "Documents",
    });
  }

  const messaging = asRows(source.messaging);
  if (messaging.length > 0) {
    pushRow(rows, {
      path: "Admin -> Message Templates",
      action: `Create ${plural(messaging.length, "message template")} across enabled channels/languages and link each template to the correct folder or campaign purpose: ${joinValues(messaging.map((row) => field(row, "name")), 12)}.`,
      module: "Message Templates",
    });
  }

  const aiCall = asRecord(source.aiCallFaqs);
  const aiFaqs = asRows(aiCall.faqs);
  if (aiFaqs.length > 0) {
    pushRow(rows, {
      path: "Admin -> AI Call",
      action: `Upload ${plural(aiFaqs.length, "AI Call FAQ")} into the voice AI knowledge base and verify sample call responses.`,
      module: "AI Call",
    });
  }

  const agencies = asRows(source.agencyPortal);
  const agencyUsers = asRows(source.agencyPortalUsers);
  if (agencies.length > 0 || agencyUsers.length > 0) {
    pushRow(rows, {
      path: "Admin -> Agency Portal",
      action: `Configure ${plural(agencies.length, "agency", "agencies")} and ${plural(agencyUsers.length, "agency user")} with permissions and folder access.`,
      module: "Agency Portal",
    });
  }

  const autoflows = asRows(source.autoflows);
  if (autoflows.length > 0) {
    const groups = Array.from(new Set(autoflows.map((row) => field(row, "group")).filter(Boolean)));
    pushRow(rows, {
      path: "Admin -> Autoflow Sets",
      action: `Create autoflow set groups: ${joinValues(groups, 12) || "review grouped autoflow rules"}. Keep happy path and non-happy path flows separate where applicable.`,
      module: "Autoflow Sets",
    });
    autoflows.forEach((rule, index) => {
      pushRow(rows, {
        path: "Admin -> Autoflows",
        action: `${field(rule, "group") ? `${field(rule, "group")} / ` : ""}Rule ${index + 1}: Trigger ${field(rule, "triggerType") || "not set"} from ${field(rule, "triggerSource") || "not set"}${field(rule, "condition") ? ` when ${field(rule, "condition")}` : ""}. Action: ${field(rule, "action") || "not set"}${field(rule, "targetFolder") ? ` -> ${field(rule, "targetFolder")}` : ""}${field(rule, "messageTemplate") ? `. Template: ${field(rule, "messageTemplate")}` : ""}${field(rule, "rejectionReason") ? `. Rejection reason: ${field(rule, "rejectionReason")}` : ""}.`,
        module: "Autoflows",
      });
    });
  }

  const integrations = asRows(source.integrations);
  if (integrations.length > 0) {
    pushRow(rows, {
      path: "Admin -> Integrations",
      action: `Configure ${plural(integrations.length, "integration")} with trigger folders, endpoint/auth details, mappings, match keys, and target folders: ${joinValues(integrations.map((row) => field(row, "vendorName")), 8)}.`,
      module: "Integrations",
    });
  }

  return rows;
}
