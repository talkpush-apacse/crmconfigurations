import type {
  IntegrationActionType,
  IntegrationApiEnvironment,
  IntegrationAttributeMapping,
  IntegrationAuthMethod,
  IntegrationCampaignScope,
  IntegrationCandidateIdSource,
  IntegrationCategory,
  IntegrationMatchKey,
  IntegrationMultiMatchBehavior,
  IntegrationPayloadMapping,
  IntegrationResponseMapping,
  IntegrationRow,
  IntegrationStatus,
} from "./types";

export const INTEGRATION_CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  hris_ats: "HRIS/ATS",
  assessment: "Assessment",
  background_check: "Background Check",
  medical_exam: "Medical Exam",
  others: "Others",
};

export const INTEGRATION_ACTION_LABELS: Record<IntegrationActionType, string> = {
  outbound_post: "Outbound: POST to vendor",
  inbound_pull: "Inbound: Vendor pulls data",
  inbound_patch_attribute: "Inbound: Vendor updates attribute",
  inbound_upload_document: "Inbound: Vendor uploads document",
  inbound_change_status: "Inbound: Vendor changes status",
};

export const INTEGRATION_AUTH_LABELS: Record<IntegrationAuthMethod, string> = {
  none: "None",
  api_key_query: "API Key (query param)",
  bearer_token: "Bearer Token",
  custom_header: "Custom Header",
  basic_auth: "Basic Auth",
};

export const INTEGRATION_STATUS_LABELS: Record<IntegrationStatus, string> = {
  not_started: "Not Started",
  scoping: "Scoping",
  in_development: "In Development",
  uat: "UAT",
  live: "Live",
};

export const INTEGRATION_MATCH_KEY_LABELS: Record<IntegrationMatchKey, string> = {
  candidate_id: "Candidate ID",
  email: "Email",
  phone: "Phone",
  application_id: "Application ID",
};

export const INTEGRATION_API_ENVIRONMENT_LABELS: Record<IntegrationApiEnvironment, string> = {
  production: "Production",
  staging: "Staging",
  test_campaign: "Test Campaign",
  tbd: "TBD",
};

export const INTEGRATION_CAMPAIGN_SCOPE_LABELS: Record<IntegrationCampaignScope, string> = {
  single_campaign: "Single Campaign",
  multiple_campaigns: "Multiple Campaigns",
  all_campaigns: "All Campaigns",
  tbd: "TBD",
};

export const INTEGRATION_CANDIDATE_ID_SOURCE_LABELS: Record<IntegrationCandidateIdSource, string> = {
  provided_in_outbound_payload: "Provided in outbound payload",
  vendor_stores_talkpush_id: "Vendor stores Talkpush ID",
  lookup_get_campaign_invitations: "Lookup via GET /campaign_invitations",
  provided_by_talkpush_se: "Provided by Talkpush SE",
  other: "Other",
};

export const INTEGRATION_MULTI_MATCH_BEHAVIOR_LABELS: Record<IntegrationMultiMatchBehavior, string> = {
  reject: "Reject",
  use_most_recent: "Use most recent",
  use_first_match: "Use first match",
  manual_review: "Manual review",
  tbd: "TBD",
};

function labelFromMap<T extends string>(map: Record<T, string>, value: T | "" | undefined): string {
  return value ? map[value as T] ?? value : "";
}

function valueFromLabel<T extends string>(map: Record<T, string>, input: string): T | "" {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return "";
  const direct = Object.keys(map).find((key) => key.toLowerCase() === normalized) as T | undefined;
  if (direct) return direct;
  const matched = Object.entries(map).find(([, label]) => String(label).toLowerCase() === normalized);
  return (matched?.[0] as T | undefined) ?? "";
}

export const integrationCategoryLabel = (value: IntegrationCategory | "" | undefined) =>
  labelFromMap(INTEGRATION_CATEGORY_LABELS, value);
export const integrationActionLabel = (value: IntegrationActionType | "" | undefined) =>
  labelFromMap(INTEGRATION_ACTION_LABELS, value);
export const integrationAuthLabel = (value: IntegrationAuthMethod | "" | undefined) =>
  labelFromMap(INTEGRATION_AUTH_LABELS, value);
export const integrationStatusLabel = (value: IntegrationStatus | "" | undefined) =>
  labelFromMap(INTEGRATION_STATUS_LABELS, value);
export const integrationMatchKeyLabel = (value: IntegrationMatchKey | "" | undefined) =>
  labelFromMap(INTEGRATION_MATCH_KEY_LABELS, value);
export const integrationApiEnvironmentLabel = (value: IntegrationApiEnvironment | "" | undefined) =>
  labelFromMap(INTEGRATION_API_ENVIRONMENT_LABELS, value);
export const integrationCampaignScopeLabel = (value: IntegrationCampaignScope | "" | undefined) =>
  labelFromMap(INTEGRATION_CAMPAIGN_SCOPE_LABELS, value);
export const integrationCandidateIdSourceLabel = (value: IntegrationCandidateIdSource | "" | undefined) =>
  labelFromMap(INTEGRATION_CANDIDATE_ID_SOURCE_LABELS, value);
export const integrationMultiMatchBehaviorLabel = (value: IntegrationMultiMatchBehavior | "" | undefined) =>
  labelFromMap(INTEGRATION_MULTI_MATCH_BEHAVIOR_LABELS, value);

export const integrationCategoryValue = (value: string) =>
  valueFromLabel(INTEGRATION_CATEGORY_LABELS, value);
export const integrationActionValue = (value: string) =>
  valueFromLabel(INTEGRATION_ACTION_LABELS, value);
export const integrationAuthValue = (value: string) =>
  valueFromLabel(INTEGRATION_AUTH_LABELS, value);
export const integrationStatusValue = (value: string) =>
  valueFromLabel(INTEGRATION_STATUS_LABELS, value);
export const integrationMatchKeyValue = (value: string) =>
  valueFromLabel(INTEGRATION_MATCH_KEY_LABELS, value);
export const integrationApiEnvironmentValue = (value: string) =>
  valueFromLabel(INTEGRATION_API_ENVIRONMENT_LABELS, value);
export const integrationCampaignScopeValue = (value: string) =>
  valueFromLabel(INTEGRATION_CAMPAIGN_SCOPE_LABELS, value);
export const integrationCandidateIdSourceValue = (value: string) =>
  valueFromLabel(INTEGRATION_CANDIDATE_ID_SOURCE_LABELS, value);
export const integrationMultiMatchBehaviorValue = (value: string) =>
  valueFromLabel(INTEGRATION_MULTI_MATCH_BEHAVIOR_LABELS, value);

export function flattenOutboundPayloadMapping(rows: IntegrationPayloadMapping[] | undefined): string {
  if (!rows || rows.length === 0) return "";
  return rows
    .map((row) => {
      const source = row.talkpushSource.trim();
      const target = row.vendorFieldName.trim();
      if (!source && !target) return "";
      return `${source} → ${target} (${row.required ? "required" : "optional"})`;
    })
    .filter(Boolean)
    .join("\n");
}

export function flattenResponseHandling(rows: IntegrationResponseMapping[] | undefined): string {
  if (!rows || rows.length === 0) return "";
  return rows
    .map((row) => {
      const source = row.vendorResponseField.trim();
      const target = row.targetAttribute.trim();
      if (!source && !target) return "";
      return `${source} → ${target}`;
    })
    .filter(Boolean)
    .join("\n");
}

export function flattenInboundAttributeMapping(rows: IntegrationAttributeMapping[] | undefined): string {
  if (!rows || rows.length === 0) return "";
  return rows
    .map((row) => {
      const source = row.vendorCallbackField.trim();
      const target = row.targetAttribute.trim();
      if (!source && !target) return "";
      return `${source} → ${target}`;
    })
    .filter(Boolean)
    .join("\n");
}

function splitMappingLine(line: string): [string, string] {
  const arrow = line.includes("→") ? "→" : "->";
  const [source = "", ...rest] = line.split(arrow);
  return [source.trim(), rest.join(arrow).trim()];
}

export function parseOutboundPayloadMapping(value: string): IntegrationPayloadMapping[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [source, targetWithRequired] = splitMappingLine(line);
      const requiredMatch = targetWithRequired.match(/\((required|optional)\)\s*$/i);
      const vendorFieldName = targetWithRequired.replace(/\((required|optional)\)\s*$/i, "").trim();
      return {
        id: crypto.randomUUID(),
        talkpushSource: source,
        vendorFieldName,
        required: requiredMatch ? requiredMatch[1].toLowerCase() === "required" : false,
      };
    });
}

export function parseResponseHandling(value: string): IntegrationResponseMapping[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [source, target] = splitMappingLine(line);
      return { id: crypto.randomUUID(), vendorResponseField: source, targetAttribute: target };
    });
}

export function parseInboundAttributeMapping(value: string): IntegrationAttributeMapping[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [source, target] = splitMappingLine(line);
      return { id: crypto.randomUUID(), vendorCallbackField: source, targetAttribute: target };
    });
}

export function integrationToCsvRow(row: IntegrationRow): Record<string, string> {
  return {
    vendorName: row.vendorName,
    vendorCategory: integrationCategoryLabel(row.vendorCategory),
    actionType: integrationActionLabel(row.actionType),
    triggerFolder: row.triggerFolder,
    status: integrationStatusLabel(row.status),
    endpointUrl: row.endpointUrl ?? "",
    authMethod: integrationAuthLabel(row.authMethod),
    authParamName: row.authParamName ?? "",
    outboundPayloadMapping: flattenOutboundPayloadMapping(row.outboundPayloadMapping),
    responseHandling: flattenResponseHandling(row.responseHandling),
    inboundAttributeMapping: flattenInboundAttributeMapping(row.inboundAttributeMapping),
    matchKey: integrationMatchKeyLabel(row.matchKey),
    documentTag: row.documentTag ?? "",
    targetFolder: row.targetFolder ?? "",
    filterCriteria: row.filterCriteria ?? "",
    talkpushApiBaseUrl: row.talkpushApiBaseUrl ?? "",
    apiEnvironment: integrationApiEnvironmentLabel(row.apiEnvironment),
    inboundAuthMethod: integrationAuthLabel(row.inboundAuthMethod),
    inboundAuthParamName: row.inboundAuthParamName ?? "",
    campaignScope: integrationCampaignScopeLabel(row.campaignScope),
    campaignIds: row.campaignIds ?? "",
    campaignNames: row.campaignNames ?? "",
    candidateIdSource: integrationCandidateIdSourceLabel(row.candidateIdSource),
    candidateIdFieldName: row.candidateIdFieldName ?? "",
    lookupQueryParams: row.lookupQueryParams ?? "",
    multiMatchBehavior: integrationMultiMatchBehaviorLabel(row.multiMatchBehavior),
    sampleRequest: row.sampleRequest ?? "",
    sampleSuccessResponse: row.sampleSuccessResponse ?? "",
    sampleErrorResponse: row.sampleErrorResponse ?? "",
    rateLimitNotes: row.rateLimitNotes ?? "",
    retryTimeoutNotes: row.retryTimeoutNotes ?? "",
    idempotencyNotes: row.idempotencyNotes ?? "",
    uatTestCandidate: row.uatTestCandidate ?? "",
    expectedTalkpushResult: row.expectedTalkpushResult ?? "",
    vendorContactName: row.vendorContactName,
    vendorContactEmail: row.vendorContactEmail,
    vendorDocsUrl: row.vendorDocsUrl,
    notes: row.notes,
  };
}
