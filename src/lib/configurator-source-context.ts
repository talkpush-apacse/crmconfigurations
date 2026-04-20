export interface ConfiguratorSourceContext {
  title: string;
  lines: string[];
}

const MAX_LINES = 40;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item))
    : [];
}

function value(row: Record<string, unknown>, key: string): string {
  const raw = row[key];
  if (raw === null || raw === undefined || raw === "") return "";
  if (Array.isArray(raw)) return raw.filter(Boolean).join(", ");
  if (typeof raw === "object") return "";
  return String(raw);
}

function compact(parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" · ");
}

function withLimit(lines: string[]): string[] {
  if (lines.length <= MAX_LINES) return lines;
  return [...lines.slice(0, MAX_LINES), `+ ${lines.length - MAX_LINES} more`];
}

function numbered(rows: Record<string, unknown>[], format: (row: Record<string, unknown>, index: number) => string): string[] {
  return withLimit(rows.map((row, index) => format(row, index)).filter(Boolean));
}

function rowsFor(sourceData: unknown, key: string): Record<string, unknown>[] {
  return asArray(asRecord(sourceData)[key]);
}

function objectFor(sourceData: unknown, key: string): Record<string, unknown> {
  return asRecord(asRecord(sourceData)[key]);
}

function companyContext(sourceData: unknown): ConfiguratorSourceContext | null {
  const company = objectFor(sourceData, "companyInfo");
  const lines = [
    compact(["Company", value(company, "companyName")]),
    compact(["Address", value(company, "companyAddress")]),
    compact(["Website", value(company, "companyWebsiteUrl")]),
    compact(["Privacy policy", value(company, "privacyPolicyUrl")]),
    compact(["Primary color", value(company, "companyColor")]),
    compact(["Duplicate handling", value(company, "allowDuplicates")]),
    compact(["Cooling period", value(company, "coolingPeriod")]),
    compact(["Rehires allowed", value(company, "rehiresAllowed")]),
  ].filter((line) => line.split(" · ")[1]);

  return lines.length > 0 ? { title: "Company checklist data", lines } : null;
}

function usersContext(sourceData: unknown): ConfiguratorSourceContext | null {
  const rows = rowsFor(sourceData, "users");
  if (rows.length === 0) return null;
  return {
    title: "Users to create",
    lines: numbered(rows, (row, index) =>
      compact([
        `${index + 1}. ${value(row, "name") || "Unnamed user"}`,
        value(row, "accessType"),
        value(row, "email"),
        value(row, "site"),
        value(row, "stage"),
      ])
    ),
  };
}

function campaignsContext(sourceData: unknown): ConfiguratorSourceContext | null {
  const rows = rowsFor(sourceData, "campaigns");
  if (rows.length === 0) return null;
  return {
    title: "Campaigns from CRM checklist",
    lines: numbered(rows, (row, index) =>
      compact([
        `${index + 1}. ${value(row, "nameInternal") || value(row, "jobTitleExternal") || "Unnamed campaign"}`,
        value(row, "jobTitleExternal"),
        value(row, "site"),
        value(row, "assignedRecruiters") && `Recruiters: ${value(row, "assignedRecruiters")}`,
        value(row, "campaignId") && `Talkpush ID: ${value(row, "campaignId")}`,
      ])
    ),
  };
}

function sitesContext(sourceData: unknown): ConfiguratorSourceContext | null {
  const rows = rowsFor(sourceData, "sites");
  if (rows.length === 0) return null;
  return {
    title: "Sites to configure",
    lines: numbered(rows, (row, index) =>
      compact([
        `${index + 1}. ${value(row, "siteName") || value(row, "internalName") || "Unnamed site"}`,
        value(row, "fullAddress"),
        value(row, "interviewType"),
        value(row, "interviewHours"),
      ])
    ),
  };
}

function sourcesContext(sourceData: unknown): ConfiguratorSourceContext | null {
  const rows = rowsFor(sourceData, "sources");
  if (rows.length === 0) return null;
  return {
    title: "Sources to configure",
    lines: numbered(rows, (row, index) =>
      compact([
        `${index + 1}. ${value(row, "category") || "Source"}`,
        value(row, "subcategory"),
        value(row, "link"),
      ])
    ),
  };
}

function foldersContext(sourceData: unknown): ConfiguratorSourceContext | null {
  const rows = rowsFor(sourceData, "folders");
  if (rows.length === 0) return null;
  return {
    title: "Folders to create",
    lines: numbered(rows, (row, index) =>
      compact([
        `${index + 1}. ${value(row, "folderName") || "Unnamed folder"}`,
        value(row, "movementType"),
        value(row, "description"),
      ])
    ),
  };
}

function attributesContext(sourceData: unknown): ConfiguratorSourceContext | null {
  const rows = rowsFor(sourceData, "attributes");
  if (rows.length === 0) return null;
  return {
    title: "Candidate attributes to create",
    lines: numbered(rows, (row, index) =>
      compact([
        `${index + 1}. ${value(row, "attributeName") || "Unnamed attribute"}`,
        value(row, "key"),
        value(row, "dataType"),
        value(row, "suggestedValues") && `Values: ${value(row, "suggestedValues")}`,
      ])
    ),
  };
}

function documentsContext(sourceData: unknown): ConfiguratorSourceContext | null {
  const rows = rowsFor(sourceData, "documents");
  if (rows.length === 0) return null;
  return {
    title: "Documents to configure",
    lines: numbered(rows, (row, index) =>
      compact([
        `${index + 1}. ${value(row, "documentName") || "Unnamed document"}`,
        value(row, "required") && `Required: ${value(row, "required")}`,
        value(row, "folder"),
        value(row, "applicableCampaigns"),
      ])
    ),
  };
}

function prescreeningContext(sourceData: unknown): ConfiguratorSourceContext | null {
  const rows = rowsFor(sourceData, "prescreening");
  if (rows.length === 0) return null;
  return {
    title: "Questions to configure",
    lines: numbered(rows, (row, index) =>
      compact([
        `${index + 1}. ${value(row, "question") || "Untitled question"}`,
        value(row, "category"),
        value(row, "questionType"),
        value(row, "applicableCampaigns"),
        value(row, "autoReject") && `Auto-reject: ${value(row, "autoReject")}`,
        value(row, "rejectCondition"),
      ])
    ),
  };
}

function messageTemplateContext(sourceData: unknown, channel?: "email" | "sms" | "whatsapp" | "messenger"): ConfiguratorSourceContext | null {
  const rows = rowsFor(sourceData, "messaging");
  const filtered = channel
    ? rows.filter((row) => value(row, `${channel}Active`) === "true" || value(row, `${channel}Template`) || value(row, channel === "email" ? "emailSubject" : ""))
    : rows;

  if (filtered.length === 0) return null;

  const title = channel
    ? `${channel.charAt(0).toUpperCase()}${channel.slice(1)} templates to create`
    : "Message templates to create";

  return {
    title,
    lines: numbered(filtered, (row, index) =>
      compact([
        `${index + 1}. ${value(row, "name") || "Unnamed template"}`,
        value(row, "purpose"),
        value(row, "language"),
        value(row, "folder"),
      ])
    ),
  };
}

function aiCallContext(sourceData: unknown): ConfiguratorSourceContext | null {
  const aiCall = asRecord(asRecord(sourceData).aiCallFaqs);
  const faqs = asArray(aiCall.faqs);
  if (faqs.length === 0) return null;
  return {
    title: "AI Call FAQs to upload",
    lines: numbered(faqs, (row, index) =>
      compact([
        `${index + 1}. ${value(row, "faq") || "Untitled FAQ"}`,
        value(row, "faqResponse"),
      ])
    ),
  };
}

function agencyContext(sourceData: unknown): ConfiguratorSourceContext | null {
  const agencies = rowsFor(sourceData, "agencyPortal");
  const users = rowsFor(sourceData, "agencyPortalUsers");
  const lines = [
    ...numbered(agencies, (row, index) =>
      compact([
        `${index + 1}. Agency: ${value(row, "agencyName") || "Unnamed agency"}`,
        value(row, "contactName"),
        value(row, "email"),
      ])
    ),
    ...numbered(users, (row, index) =>
      compact([
        `${index + 1}. User: ${value(row, "name") || "Unnamed user"}`,
        value(row, "agency"),
        value(row, "email"),
        value(row, "userAccess"),
      ])
    ),
  ];

  return lines.length > 0 ? { title: "Agency portal checklist data", lines: withLimit(lines) } : null;
}

export function getConfiguratorSourceContext(itemId: string, sourceData: unknown): ConfiguratorSourceContext[] {
  const contexts: Array<ConfiguratorSourceContext | null> = [];

  if (itemId.startsWith("company-") || itemId.startsWith("dedup-")) contexts.push(companyContext(sourceData));
  if (itemId.startsWith("users-")) contexts.push(usersContext(sourceData));
  if (itemId.startsWith("sites-")) contexts.push(sitesContext(sourceData));
  if (itemId.startsWith("sources-")) contexts.push(sourcesContext(sourceData));
  if (itemId.startsWith("folders-")) contexts.push(foldersContext(sourceData));
  if (itemId === "attributes-custom") contexts.push(attributesContext(sourceData));
  if (itemId.startsWith("documents-")) contexts.push(documentsContext(sourceData));
  if (itemId.startsWith("prescreening-")) contexts.push(prescreeningContext(sourceData));
  if (itemId === "templates-email") contexts.push(messageTemplateContext(sourceData, "email"));
  if (itemId === "templates-sms") contexts.push(messageTemplateContext(sourceData, "sms"));
  if (itemId === "templates-whatsapp") contexts.push(messageTemplateContext(sourceData, "whatsapp"));
  if (itemId === "facebook-autoreply" || itemId === "facebook-test") contexts.push(messageTemplateContext(sourceData, "messenger"));
  if (itemId.startsWith("campaigns-")) contexts.push(campaignsContext(sourceData), foldersContext(sourceData), sourcesContext(sourceData), prescreeningContext(sourceData));
  if (itemId.startsWith("autoflows-") || itemId.startsWith("uat-")) contexts.push(campaignsContext(sourceData), foldersContext(sourceData), messageTemplateContext(sourceData));
  if (itemId.startsWith("aicall-")) contexts.push(aiCallContext(sourceData));
  if (itemId.startsWith("agency-")) contexts.push(agencyContext(sourceData));

  return contexts.filter((context): context is ConfiguratorSourceContext => !!context && context.lines.length > 0);
}
