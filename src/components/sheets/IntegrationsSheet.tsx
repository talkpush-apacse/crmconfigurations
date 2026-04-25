"use client";

import { useMemo } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { SectionFooter } from "@/components/shared/SectionFooter";
import { EditableTable } from "@/components/shared/EditableTable";
import { HybridPicker } from "@/components/shared/HybridPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useChecklistContext } from "@/lib/checklist-context";
import {
  INTEGRATION_ACTION_LABELS,
  INTEGRATION_API_ENVIRONMENT_LABELS,
  INTEGRATION_AUTH_LABELS,
  INTEGRATION_CAMPAIGN_SCOPE_LABELS,
  INTEGRATION_CANDIDATE_ID_SOURCE_LABELS,
  INTEGRATION_CATEGORY_LABELS,
  INTEGRATION_MATCH_KEY_LABELS,
  INTEGRATION_MULTI_MATCH_BEHAVIOR_LABELS,
  INTEGRATION_STATUS_LABELS,
  integrationActionValue,
  integrationApiEnvironmentValue,
  integrationAuthValue,
  integrationCampaignScopeValue,
  integrationCandidateIdSourceValue,
  integrationCategoryValue,
  integrationMatchKeyValue,
  integrationMultiMatchBehaviorValue,
  integrationStatusValue,
  integrationToCsvRow,
  parseInboundAttributeMapping,
  parseOutboundPayloadMapping,
  parseResponseHandling,
} from "@/lib/integration-utils";
import { cn } from "@/lib/utils";
import type {
  AttributeRow,
  ColumnDef,
  DocumentRow,
  FolderRow,
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
} from "@/lib/types";
import { softDeleteByIds, appendBulkDuplicates } from "@/lib/duplicate-row";

const mainColumns: ColumnDef[] = [
  { key: "vendorName", label: "Vendor Name", type: "text", width: "180px" },
  { key: "vendorCategory", label: "Category", type: "dropdown", width: "180px" },
  { key: "actionType", label: "Action Type", type: "dropdown", width: "240px" },
  { key: "triggerFolder", label: "Trigger Folder", type: "text", width: "220px" },
  { key: "status", label: "Status", type: "dropdown", width: "170px" },
];

const csvDetailColumns: ColumnDef[] = [
  { key: "endpointUrl", label: "Endpoint URL", type: "text" },
  { key: "authMethod", label: "Auth Method", type: "text" },
  { key: "authParamName", label: "Auth Param / Header", type: "text" },
  { key: "outboundPayloadMapping", label: "Outbound Payload Mapping", type: "textarea" },
  { key: "responseHandling", label: "Response Handling", type: "textarea" },
  { key: "inboundAttributeMapping", label: "Inbound Attribute Mapping", type: "textarea" },
  { key: "matchKey", label: "Match Key", type: "text" },
  { key: "documentTag", label: "Document Tag", type: "text" },
  { key: "targetFolder", label: "Target Folder", type: "text" },
  { key: "filterCriteria", label: "Filter Criteria", type: "textarea" },
  { key: "talkpushApiBaseUrl", label: "Talkpush API Base URL", type: "text" },
  { key: "apiEnvironment", label: "API Environment", type: "text" },
  { key: "inboundAuthMethod", label: "Inbound Auth Method", type: "text" },
  { key: "inboundAuthParamName", label: "Inbound Auth Param / Header", type: "text" },
  { key: "campaignScope", label: "Campaign Scope", type: "text" },
  { key: "campaignIds", label: "Campaign IDs", type: "text" },
  { key: "campaignNames", label: "Campaign Names", type: "text" },
  { key: "candidateIdSource", label: "Candidate ID Retrieval Method", type: "text" },
  { key: "candidateIdFieldName", label: "Candidate ID Field Name", type: "text" },
  { key: "lookupQueryParams", label: "Lookup Query Params", type: "textarea" },
  { key: "multiMatchBehavior", label: "Multi-match Behavior", type: "text" },
  { key: "sampleRequest", label: "Sample Request", type: "textarea" },
  { key: "sampleSuccessResponse", label: "Sample Success Response", type: "textarea" },
  { key: "sampleErrorResponse", label: "Sample Error Response", type: "textarea" },
  { key: "rateLimitNotes", label: "Rate Limit Notes", type: "textarea" },
  { key: "retryTimeoutNotes", label: "Retry / Timeout Notes", type: "textarea" },
  { key: "idempotencyNotes", label: "Idempotency Notes", type: "textarea" },
  { key: "uatTestCandidate", label: "UAT Test Candidate", type: "textarea" },
  { key: "expectedTalkpushResult", label: "Expected Talkpush Result", type: "textarea" },
  { key: "vendorContactName", label: "Vendor Contact Name", type: "text" },
  { key: "vendorContactEmail", label: "Vendor Contact Email", type: "text" },
  { key: "vendorDocsUrl", label: "Vendor Docs URL", type: "text" },
  { key: "notes", label: "Notes", type: "textarea" },
];

const systemFieldOptions = [
  "applicationId",
  "candidateId",
  "first_name",
  "last_name",
  "email",
  "user_phone_number",
  "campaign_id",
  "folder_id",
  "source",
  "created_at",
  "resume_url",
].map((value) => ({ value, label: value, group: "System Fields" }));

function makeIntegrationRow(overrides: Partial<IntegrationRow> = {}): IntegrationRow {
  return {
    id: crypto.randomUUID(),
    vendorName: "",
    vendorCategory: "",
    actionType: "",
    triggerFolder: "",
    status: "",
    vendorContactName: "",
    vendorContactEmail: "",
    vendorDocsUrl: "",
    notes: "",
    endpointUrl: "",
    authMethod: "none",
    authParamName: "",
    authValue: "",
    outboundPayloadMapping: [],
    responseHandling: [],
    inboundAttributeMapping: [],
    matchKey: "",
    documentTag: "",
    targetFolder: "",
    filterCriteria: "",
    talkpushApiBaseUrl: "",
    apiEnvironment: "",
    inboundAuthMethod: "",
    inboundAuthParamName: "",
    inboundAuthValue: "",
    campaignScope: "",
    campaignIds: "",
    campaignNames: "",
    candidateIdSource: "",
    candidateIdFieldName: "",
    lookupQueryParams: "",
    multiMatchBehavior: "",
    sampleRequest: "",
    sampleSuccessResponse: "",
    sampleErrorResponse: "",
    rateLimitNotes: "",
    retryTimeoutNotes: "",
    idempotencyNotes: "",
    uatTestCandidate: "",
    expectedTalkpushResult: "",
    ...overrides,
  };
}

function normalizeIntegrationRow(row: Partial<IntegrationRow>): IntegrationRow {
  return makeIntegrationRow({
    ...row,
    id: row.id || crypto.randomUUID(),
    vendorName: row.vendorName ?? "",
    vendorCategory: row.vendorCategory ?? "",
    actionType: row.actionType ?? "",
    triggerFolder: row.triggerFolder ?? "",
    status: row.status ?? "",
    vendorContactName: row.vendorContactName ?? "",
    vendorContactEmail: row.vendorContactEmail ?? "",
    vendorDocsUrl: row.vendorDocsUrl ?? "",
    notes: row.notes ?? "",
    endpointUrl: row.endpointUrl ?? "",
    authMethod: row.authMethod ?? "none",
    authParamName: row.authParamName ?? "",
    authValue: row.authValue ?? "",
    outboundPayloadMapping: Array.isArray(row.outboundPayloadMapping) ? row.outboundPayloadMapping : [],
    responseHandling: Array.isArray(row.responseHandling) ? row.responseHandling : [],
    inboundAttributeMapping: Array.isArray(row.inboundAttributeMapping) ? row.inboundAttributeMapping : [],
    matchKey: row.matchKey ?? "",
    documentTag: row.documentTag ?? "",
    targetFolder: row.targetFolder ?? "",
    filterCriteria: row.filterCriteria ?? "",
    talkpushApiBaseUrl: row.talkpushApiBaseUrl ?? "",
    apiEnvironment: row.apiEnvironment ?? "",
    inboundAuthMethod: row.inboundAuthMethod ?? "",
    inboundAuthParamName: row.inboundAuthParamName ?? "",
    inboundAuthValue: row.inboundAuthValue ?? "",
    campaignScope: row.campaignScope ?? "",
    campaignIds: row.campaignIds ?? "",
    campaignNames: row.campaignNames ?? "",
    candidateIdSource: row.candidateIdSource ?? "",
    candidateIdFieldName: row.candidateIdFieldName ?? "",
    lookupQueryParams: row.lookupQueryParams ?? "",
    multiMatchBehavior: row.multiMatchBehavior ?? "",
    sampleRequest: row.sampleRequest ?? "",
    sampleSuccessResponse: row.sampleSuccessResponse ?? "",
    sampleErrorResponse: row.sampleErrorResponse ?? "",
    rateLimitNotes: row.rateLimitNotes ?? "",
    retryTimeoutNotes: row.retryTimeoutNotes ?? "",
    idempotencyNotes: row.idempotencyNotes ?? "",
    uatTestCandidate: row.uatTestCandidate ?? "",
    expectedTalkpushResult: row.expectedTalkpushResult ?? "",
  });
}

function isInboundAction(actionType: IntegrationActionType | "") {
  return actionType.startsWith("inbound_");
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function SelectField<T extends string>({
  value,
  onChange,
  options,
  labels,
  placeholder = "Select...",
  disabled,
  triggerClassName,
}: {
  value: T | "";
  onChange: (value: T) => void;
  options: readonly T[];
  labels: Record<T, string>;
  placeholder?: string;
  disabled?: boolean;
  triggerClassName?: string;
}) {
  return (
    <Select
      value={value || undefined}
      onValueChange={(next) => onChange(next as T)}
      disabled={disabled}
    >
      <SelectTrigger className={cn("h-9 text-sm", triggerClassName)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {labels[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      {children}
    </div>
  );
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="mb-4 mt-6 flex items-center gap-3 first:mt-0">
      <h3 className="shrink-0 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      <div className="h-px flex-1 bg-gray-200" />
    </div>
  );
}

function statusClass(status: IntegrationStatus | "") {
  const classes: Record<IntegrationStatus, string> = {
    not_started: "border-gray-300 bg-gray-50 text-gray-700",
    scoping: "border-blue-200 bg-blue-50 text-blue-800",
    in_development: "border-amber-200 bg-amber-50 text-amber-800",
    uat: "border-purple-200 bg-purple-50 text-purple-800",
    live: "border-green-200 bg-green-50 text-green-800",
  };
  return status ? classes[status] : "border-gray-300 bg-white text-gray-700";
}

export function IntegrationsSheet() {
  const { data, updateField, isReadOnly } = useChecklistContext();
  const allIntegrations = useMemo(
    () =>
      Array.isArray(data.integrations)
        ? data.integrations.map((row) => normalizeIntegrationRow(row))
        : [],
    [data.integrations]
  );
  const integrations = useMemo(
    () => allIntegrations.filter((r) => !r.deletedAt),
    [allIntegrations]
  );

  const fullIndexOf = (visibleIdx: number) => {
    const target = integrations[visibleIdx];
    if (!target) return -1;
    return allIntegrations.findIndex((r) => r.id === target.id);
  };

  const folderOptions = useMemo(
    () =>
      ((data.folders as FolderRow[] | null) ?? [])
        .map((folder) => folder.folderName)
        .filter(Boolean)
        .map((value) => ({ value, label: value })),
    [data.folders]
  );

  const attributeOptions = useMemo(
    () =>
      ((data.attributes as AttributeRow[] | null) ?? [])
        .map((attribute) => attribute.attributeName || attribute.key)
        .filter(Boolean)
        .map((value) => ({ value, label: value, group: "Attributes" })),
    [data.attributes]
  );

  const documentOptions = useMemo(
    () =>
      ((data.documents as DocumentRow[] | null) ?? [])
        .map((document) => document.documentName)
        .filter(Boolean)
        .map((value) => ({ value, label: value })),
    [data.documents]
  );

  const sourceOptions = useMemo(
    () => [...systemFieldOptions, ...attributeOptions],
    [attributeOptions]
  );

  const duplicateFolderMap = useMemo(() => {
    const map = new Map<string, IntegrationRow[]>();
    for (const row of integrations) {
      const key = normalizeKey(row.triggerFolder);
      if (!key) continue;
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return map;
  }, [integrations]);

  const duplicateSummaries = Array.from(duplicateFolderMap.entries())
    .filter(([, rows]) => rows.length >= 2)
    .map(([, rows]) => `"${rows[0].triggerFolder.trim()}" (${rows.length} integrations)`);

  const saveIntegrations = (next: IntegrationRow[]) => {
    updateField("integrations", JSON.parse(JSON.stringify(next)) as IntegrationRow[]);
  };

  const updateRow = <K extends keyof IntegrationRow>(
    index: number,
    field: K,
    value: IntegrationRow[K]
  ) => {
    const fullIdx = fullIndexOf(index);
    if (fullIdx < 0) return;
    const next = allIntegrations.map((row, rowIndex) =>
      rowIndex === fullIdx ? { ...row, [field]: value } : row
    );
    saveIntegrations(next);
  };

  const updateRowById = (
    rowId: string,
    updater: (row: IntegrationRow) => IntegrationRow
  ) => {
    saveIntegrations(allIntegrations.map((row) => (row.id === rowId ? updater(row) : row)));
  };

  const addRow = () => {
    saveIntegrations([...allIntegrations, makeIntegrationRow()]);
  };

  const handleBulkDelete = (ids: string[]) => {
    saveIntegrations(softDeleteByIds(allIntegrations, ids));
  };

  const handleBulkDuplicate = (ids: string[]) => {
    saveIntegrations(appendBulkDuplicates("integrations", allIntegrations, integrations, ids));
  };

  const handleCsvImport = (rows: Record<string, string>[]) => {
    const imported = rows.map((row) =>
      makeIntegrationRow({
        vendorName: row.vendorName ?? "",
        vendorCategory: integrationCategoryValue(row.vendorCategory ?? "") as IntegrationCategory | "",
        actionType: integrationActionValue(row.actionType ?? "") as IntegrationActionType | "",
        triggerFolder: row.triggerFolder ?? "",
        status: integrationStatusValue(row.status ?? "") as IntegrationStatus | "",
        endpointUrl: row.endpointUrl ?? "",
        authMethod: (integrationAuthValue(row.authMethod ?? "") || "none") as IntegrationAuthMethod,
        authParamName: row.authParamName ?? "",
        outboundPayloadMapping: parseOutboundPayloadMapping(row.outboundPayloadMapping ?? ""),
        responseHandling: parseResponseHandling(row.responseHandling ?? ""),
        inboundAttributeMapping: parseInboundAttributeMapping(row.inboundAttributeMapping ?? ""),
        matchKey: integrationMatchKeyValue(row.matchKey ?? "") as IntegrationMatchKey | "",
        documentTag: row.documentTag ?? "",
        targetFolder: row.targetFolder ?? "",
        filterCriteria: row.filterCriteria ?? "",
        talkpushApiBaseUrl: row.talkpushApiBaseUrl ?? "",
        apiEnvironment: integrationApiEnvironmentValue(row.apiEnvironment ?? "") as IntegrationApiEnvironment | "",
        inboundAuthMethod: integrationAuthValue(row.inboundAuthMethod ?? "") as IntegrationAuthMethod | "",
        inboundAuthParamName: row.inboundAuthParamName ?? "",
        campaignScope: integrationCampaignScopeValue(row.campaignScope ?? "") as IntegrationCampaignScope | "",
        campaignIds: row.campaignIds ?? "",
        campaignNames: row.campaignNames ?? "",
        candidateIdSource: integrationCandidateIdSourceValue(row.candidateIdSource ?? "") as IntegrationCandidateIdSource | "",
        candidateIdFieldName: row.candidateIdFieldName ?? "",
        lookupQueryParams: row.lookupQueryParams ?? "",
        multiMatchBehavior: integrationMultiMatchBehaviorValue(row.multiMatchBehavior ?? "") as IntegrationMultiMatchBehavior | "",
        sampleRequest: row.sampleRequest ?? "",
        sampleSuccessResponse: row.sampleSuccessResponse ?? "",
        sampleErrorResponse: row.sampleErrorResponse ?? "",
        rateLimitNotes: row.rateLimitNotes ?? "",
        retryTimeoutNotes: row.retryTimeoutNotes ?? "",
        idempotencyNotes: row.idempotencyNotes ?? "",
        uatTestCandidate: row.uatTestCandidate ?? "",
        expectedTalkpushResult: row.expectedTalkpushResult ?? "",
        vendorContactName: row.vendorContactName ?? "",
        vendorContactEmail: row.vendorContactEmail ?? "",
        vendorDocsUrl: row.vendorDocsUrl ?? "",
        notes: row.notes ?? "",
      })
    );
    saveIntegrations([...allIntegrations, ...imported]);
  };

  const renderFolderWarning = (row: IntegrationRow) => {
    const key = normalizeKey(row.triggerFolder);
    if (!key) return null;
    const others = (duplicateFolderMap.get(key) ?? []).filter((candidate) => candidate.id !== row.id);
    if (others.length === 0) return null;
    const names = others.map((candidate) => candidate.vendorName || "Unnamed vendor");
    const visible = names.slice(0, 3).join(", ");
    const suffix = names.length > 3 ? ` +${names.length - 3} more` : "";
    return (
      <Badge variant="outline" className="max-w-[220px] border-amber-300 bg-amber-50 text-amber-800">
        <span className="truncate">⚠ Also used by: {visible}{suffix}</span>
      </Badge>
    );
  };

  return (
    <div>
      <SectionHeader
        title="Integrations"
        description="Capture third-party vendor integration actions that Talkpush needs to scope, build, or hand off."
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {duplicateSummaries.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            ⚠ Shared trigger folders: {duplicateSummaries.join(", ")}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Add one row per integration action. A vendor can have multiple rows.
          </p>
        )}
        {!isReadOnly && (
          <Button type="button" onClick={addRow} className="w-full rounded-full sm:w-auto">
            <Plus className="mr-1 h-4 w-4" />
            Add Integration
          </Button>
        )}
      </div>

      <EditableTable<IntegrationRow>
        columns={mainColumns}
        detailColumns={csvDetailColumns}
        data={integrations}
        onAdd={addRow}
        hideAddButton
        onDelete={(index) => {
          const target = integrations[index];
          if (!target) return;
          saveIntegrations(softDeleteByIds(allIntegrations, [target.id]));
        }}
        onUpdate={(index, field, value) => {
          const fullIdx = fullIndexOf(index);
          if (fullIdx < 0) return;
          saveIntegrations(
            allIntegrations.map((row, rowIndex) =>
              rowIndex === fullIdx ? { ...row, [field]: value } : row
            )
          );
        }}
        addLabel="Add Integration"
        emptyMessage={<>No integrations configured yet. Click &quot;Add Integration&quot; to set up a vendor action.</>}
        deleteConfirmation={{
          title: "Delete this integration?",
          getName: (row) => row.vendorName || "this integration",
          getDescription: (row) => (
            <>
              <strong>{row.vendorName || "This integration"}</strong> and its action configuration will be permanently removed.
            </>
          ),
        }}
        csvConfig={{
          sampleRow: {
            vendorName: "RoundZero",
            vendorCategory: "Assessment",
            actionType: "Outbound: POST to vendor",
            triggerFolder: "Completed",
            status: "UAT",
            endpointUrl: "https://example.com/schedule",
            authMethod: "None",
            outboundPayloadMapping: "applicationId → applicationId (required)",
          },
          onImport: handleCsvImport,
          sheetName: "Integrations",
          exportRows: integrations.map(integrationToCsvRow),
        }}
        renderCell={({ row, rowIdx, column, value, onChange }) => {
          if (column.key === "vendorName") {
            return (
              <Input
                value={String(value ?? "")}
                disabled={isReadOnly}
                onChange={(event) => onChange(event.target.value)}
                placeholder="Vendor name"
                className="h-9 text-sm"
              />
            );
          }
          if (column.key === "vendorCategory") {
            return (
              <SelectField
                value={row.vendorCategory}
                disabled={isReadOnly}
                onChange={(next) => updateRow(rowIdx, "vendorCategory", next)}
                options={Object.keys(INTEGRATION_CATEGORY_LABELS) as IntegrationCategory[]}
                labels={INTEGRATION_CATEGORY_LABELS}
                placeholder="Category"
              />
            );
          }
          if (column.key === "actionType") {
            return (
              <SelectField
                value={row.actionType}
                disabled={isReadOnly}
                onChange={(next) => updateRow(rowIdx, "actionType", next)}
                options={Object.keys(INTEGRATION_ACTION_LABELS) as IntegrationActionType[]}
                labels={INTEGRATION_ACTION_LABELS}
                placeholder="Action type"
              />
            );
          }
          if (column.key === "triggerFolder") {
            return (
              <HybridPicker
                value={row.triggerFolder}
                disabled={isReadOnly}
                onChange={(next) => updateRow(rowIdx, "triggerFolder", next)}
                options={folderOptions}
                placeholder="Folder or custom"
                warningBadge={renderFolderWarning(row)}
              />
            );
          }
          if (column.key === "status") {
            return (
              <SelectField
                value={row.status}
                disabled={isReadOnly}
                onChange={(next) => updateRow(rowIdx, "status", next)}
                options={Object.keys(INTEGRATION_STATUS_LABELS) as IntegrationStatus[]}
                labels={INTEGRATION_STATUS_LABELS}
                placeholder="Status"
                triggerClassName={statusClass(row.status)}
              />
            );
          }
          return null;
        }}
        renderDetail={({ row }) => (
          <IntegrationDetails
            row={row}
            disabled={isReadOnly}
            folderOptions={folderOptions}
            attributeOptions={attributeOptions}
            documentOptions={documentOptions}
            sourceOptions={sourceOptions}
            onUpdate={(updater) => updateRowById(row.id, updater)}
          />
        )}
        bulkActions={{
          itemLabel: "integration",
          itemLabelPlural: "integrations",
          onBulkDelete: handleBulkDelete,
          onBulkDuplicate: handleBulkDuplicate,
        }}
      />

      <SectionFooter />
    </div>
  );
}

function IntegrationDetails({
  row,
  disabled,
  folderOptions,
  attributeOptions,
  documentOptions,
  sourceOptions,
  onUpdate,
}: {
  row: IntegrationRow;
  disabled: boolean;
  folderOptions: Array<{ value: string; label: string }>;
  attributeOptions: Array<{ value: string; label: string; group?: string }>;
  documentOptions: Array<{ value: string; label: string }>;
  sourceOptions: Array<{ value: string; label: string; group?: string }>;
  onUpdate: (updater: (row: IntegrationRow) => IntegrationRow) => void;
}) {
  const setField = <K extends keyof IntegrationRow>(field: K, value: IntegrationRow[K]) => {
    onUpdate((current) => ({ ...current, [field]: value }));
  };

  const updatePayloadMapping = (
    updater: (rows: IntegrationPayloadMapping[]) => IntegrationPayloadMapping[]
  ) => {
    onUpdate((current) => ({
      ...current,
      outboundPayloadMapping: updater(current.outboundPayloadMapping ?? []),
    }));
  };

  const updateResponseHandling = (
    updater: (rows: IntegrationResponseMapping[]) => IntegrationResponseMapping[]
  ) => {
    onUpdate((current) => ({
      ...current,
      responseHandling: updater(current.responseHandling ?? []),
    }));
  };

  const updateAttributeMapping = (
    updater: (rows: IntegrationAttributeMapping[]) => IntegrationAttributeMapping[]
  ) => {
    onUpdate((current) => ({
      ...current,
      inboundAttributeMapping: updater(current.inboundAttributeMapping ?? []),
    }));
  };

  return (
    <div>
      <SectionDivider title="Vendor Details" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Vendor Contact Name">
          <Input value={row.vendorContactName} disabled={disabled} onChange={(event) => setField("vendorContactName", event.target.value)} />
        </Field>
        <Field label="Vendor Contact Email">
          <Input type="email" value={row.vendorContactEmail} disabled={disabled} onChange={(event) => setField("vendorContactEmail", event.target.value)} />
        </Field>
        <Field label="Vendor API Docs URL">
          <div className="flex gap-2">
            <Input type="url" value={row.vendorDocsUrl} disabled={disabled} onChange={(event) => setField("vendorDocsUrl", event.target.value)} />
            {row.vendorDocsUrl && (
              <Button type="button" variant="outline" size="icon-sm" asChild>
                <a href={row.vendorDocsUrl} target="_blank" rel="noreferrer" aria-label="Open vendor docs">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </Field>
        <Field label="Notes" className="md:col-span-2">
          <Textarea
            value={row.notes}
            disabled={disabled}
            rows={4}
            onChange={(event) => setField("notes", event.target.value)}
            placeholder="Scope notes, handoff details, markdown-friendly"
          />
        </Field>
      </div>

      {row.actionType === "outbound_post" && (
        <OutboundConfiguration
          row={row}
          disabled={disabled}
          sourceOptions={sourceOptions}
          attributeOptions={attributeOptions}
          setField={setField}
          updatePayloadMapping={updatePayloadMapping}
          updateResponseHandling={updateResponseHandling}
        />
      )}

      {isInboundAction(row.actionType) && (
        <InboundApiHandoffSection
          row={row}
          disabled={disabled}
          setField={setField}
        />
      )}

      {row.actionType === "inbound_patch_attribute" && (
        <div>
          <SectionDivider title="Inbound Configuration" />
          <Field label="Match Key">
            <SelectField
              value={row.matchKey ?? ""}
              disabled={disabled}
              onChange={(next) => setField("matchKey", next)}
              options={Object.keys(INTEGRATION_MATCH_KEY_LABELS) as IntegrationMatchKey[]}
              labels={INTEGRATION_MATCH_KEY_LABELS}
              placeholder="Match key"
            />
            <p className="text-xs text-muted-foreground">
              Field used to match the vendor&apos;s callback to the correct Talkpush candidate
            </p>
          </Field>
          <MappingSection
            title="Inbound Attribute Mapping"
            onAdd={() =>
              updateAttributeMapping((rows) => [
                ...rows,
                { id: crypto.randomUUID(), vendorCallbackField: "", targetAttribute: "" },
              ])
            }
            disabled={disabled}
          >
            {(row.inboundAttributeMapping ?? []).map((mapping, index) => (
              <div key={mapping.id} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <Input
                  value={mapping.vendorCallbackField}
                  disabled={disabled}
                  onChange={(event) =>
                    updateAttributeMapping((rows) =>
                      rows.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, vendorCallbackField: event.target.value } : item
                      )
                    )
                  }
                  placeholder="Vendor callback field"
                />
                <HybridPicker
                  value={mapping.targetAttribute}
                  disabled={disabled}
                  onChange={(next) =>
                    updateAttributeMapping((rows) =>
                      rows.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, targetAttribute: next } : item
                      )
                    )
                  }
                  options={attributeOptions}
                  placeholder="Target Talkpush attribute"
                />
                <RemoveButton disabled={disabled} onClick={() => updateAttributeMapping((rows) => rows.filter((_, itemIndex) => itemIndex !== index))} />
              </div>
            ))}
          </MappingSection>
        </div>
      )}

      {row.actionType === "inbound_upload_document" && (
        <div>
          <SectionDivider title="Inbound Configuration" />
          <Field label="Document Tag">
            <HybridPicker
              value={row.documentTag ?? ""}
              disabled={disabled}
              onChange={(next) => setField("documentTag", next)}
              options={documentOptions}
              placeholder="Document tag"
            />
            <p className="text-xs text-muted-foreground">
              The vendor must call PUT /campaign_invitations/{"{id}"}/documents with document_tag_name matching this value. Tags auto-create if they don&apos;t exist.
            </p>
          </Field>
        </div>
      )}

      {row.actionType === "inbound_change_status" && (
        <div>
          <SectionDivider title="Inbound Configuration" />
          <Field label="Target Folder">
            <HybridPicker
              value={row.targetFolder ?? ""}
              disabled={disabled}
              onChange={(next) => setField("targetFolder", next)}
              options={folderOptions}
              placeholder="Folder or custom"
            />
            <p className="text-xs text-muted-foreground">
              Vendor calls PUT /campaign_invitations/{"{id}"}/custom?folder={"{name}"} to move candidate. Built-in status values (complete, shortlist, reject, on_hold, hire) use their own status param.
            </p>
          </Field>
        </div>
      )}

      {row.actionType === "inbound_pull" && (
        <div>
          <SectionDivider title="Inbound Configuration" />
          <Field label="Filter Criteria">
            <Textarea
              value={row.filterCriteria ?? ""}
              disabled={disabled}
              rows={3}
              onChange={(event) => setField("filterCriteria", event.target.value)}
              placeholder="All candidates in Completed folder, updated in last 24h"
            />
            <p className="text-xs text-muted-foreground">
              Describe which candidates the vendor should pull. Vendor uses GET /campaign_invitations with filter params and api_key for auth.
            </p>
          </Field>
        </div>
      )}
    </div>
  );
}

function getInboundHandoffMissingFields(row: IntegrationRow) {
  const missing: string[] = [];
  const authMethod = row.inboundAuthMethod ?? "";
  const campaignScope = row.campaignScope ?? "";

  if (!row.talkpushApiBaseUrl?.trim()) missing.push("Talkpush API Base URL");
  if (!authMethod) missing.push("Inbound Auth Method");
  if (
    (authMethod === "api_key_query" || authMethod === "custom_header") &&
    !row.inboundAuthParamName?.trim()
  ) {
    missing.push("Inbound Auth Param / Header");
  }
  if (authMethod && authMethod !== "none" && !row.inboundAuthValue?.trim()) {
    missing.push("Inbound Auth Value");
  }
  if (!campaignScope) missing.push("Campaign Scope");
  if (
    campaignScope &&
    campaignScope !== "all_campaigns" &&
    !(row.campaignIds?.trim() || row.campaignNames?.trim())
  ) {
    missing.push("Campaign IDs or Campaign Names");
  }
  if (!row.candidateIdSource) missing.push("Candidate ID Retrieval Method");
  if (!row.sampleRequest?.trim()) missing.push("Sample Request");
  if (!row.uatTestCandidate?.trim()) missing.push("UAT Test Candidate");

  return missing;
}

function InboundApiHandoffSection({
  row,
  disabled,
  setField,
}: {
  row: IntegrationRow;
  disabled: boolean;
  setField: <K extends keyof IntegrationRow>(field: K, value: IntegrationRow[K]) => void;
}) {
  const showAuthFields = !!row.inboundAuthMethod && row.inboundAuthMethod !== "none";
  const showAuthNameField =
    row.inboundAuthMethod === "api_key_query" || row.inboundAuthMethod === "custom_header";
  const missingFields = getInboundHandoffMissingFields(row);

  return (
    <div>
      <SectionDivider title="Inbound API Handoff" />
      {missingFields.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Vendor handoff still needs: {missingFields.join(", ")}.
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Talkpush API Base URL">
          <Input
            value={row.talkpushApiBaseUrl ?? ""}
            disabled={disabled}
            onChange={(event) => setField("talkpushApiBaseUrl", event.target.value)}
            placeholder="https://api.talkpush.com"
          />
        </Field>
        <Field label="API Environment">
          <SelectField
            value={row.apiEnvironment ?? ""}
            disabled={disabled}
            onChange={(next) => setField("apiEnvironment", next)}
            options={Object.keys(INTEGRATION_API_ENVIRONMENT_LABELS) as IntegrationApiEnvironment[]}
            labels={INTEGRATION_API_ENVIRONMENT_LABELS}
            placeholder="Environment"
          />
        </Field>
        <Field label="Inbound Auth Method">
          <SelectField
            value={row.inboundAuthMethod ?? ""}
            disabled={disabled}
            onChange={(next) => setField("inboundAuthMethod", next)}
            options={Object.keys(INTEGRATION_AUTH_LABELS) as IntegrationAuthMethod[]}
            labels={INTEGRATION_AUTH_LABELS}
            placeholder="Auth method"
          />
        </Field>
        {showAuthFields && (
          <>
            {showAuthNameField && (
              <Field label="Inbound Auth Param / Header">
                <Input
                  value={row.inboundAuthParamName ?? ""}
                  disabled={disabled}
                  onChange={(event) => setField("inboundAuthParamName", event.target.value)}
                  placeholder={row.inboundAuthMethod === "api_key_query" ? "api_key" : "X-API-Key"}
                />
              </Field>
            )}
            <Field label="Inbound Auth Value">
              <Input
                type="password"
                value={row.inboundAuthValue ?? ""}
                disabled={disabled}
                onChange={(event) => setField("inboundAuthValue", event.target.value)}
                placeholder="Shared with vendor during handoff"
              />
            </Field>
          </>
        )}
        <Field label="Campaign Scope">
          <SelectField
            value={row.campaignScope ?? ""}
            disabled={disabled}
            onChange={(next) => setField("campaignScope", next)}
            options={Object.keys(INTEGRATION_CAMPAIGN_SCOPE_LABELS) as IntegrationCampaignScope[]}
            labels={INTEGRATION_CAMPAIGN_SCOPE_LABELS}
            placeholder="Campaign scope"
          />
        </Field>
        <Field label="Campaign IDs">
          <Textarea
            value={row.campaignIds ?? ""}
            disabled={disabled}
            rows={2}
            onChange={(event) => setField("campaignIds", event.target.value)}
            placeholder="One or more Talkpush campaign IDs"
          />
        </Field>
        <Field label="Campaign Names">
          <Textarea
            value={row.campaignNames ?? ""}
            disabled={disabled}
            rows={2}
            onChange={(event) => setField("campaignNames", event.target.value)}
            placeholder="Human-readable campaign names for vendor reference"
          />
        </Field>
        <Field label="Candidate ID Retrieval Method">
          <SelectField
            value={row.candidateIdSource ?? ""}
            disabled={disabled}
            onChange={(next) => setField("candidateIdSource", next)}
            options={Object.keys(INTEGRATION_CANDIDATE_ID_SOURCE_LABELS) as IntegrationCandidateIdSource[]}
            labels={INTEGRATION_CANDIDATE_ID_SOURCE_LABELS}
            placeholder="How vendor gets Talkpush ID"
          />
        </Field>
        <Field label="Candidate ID Field Name">
          <Input
            value={row.candidateIdFieldName ?? ""}
            disabled={disabled}
            onChange={(event) => setField("candidateIdFieldName", event.target.value)}
            placeholder="candidate_id, campaign_invitation_id, applicationId"
          />
        </Field>
        <Field label="Lookup Query Params" className="md:col-span-2">
          <Textarea
            value={row.lookupQueryParams ?? ""}
            disabled={disabled}
            rows={3}
            onChange={(event) => setField("lookupQueryParams", event.target.value)}
            placeholder="email={email}&campaign_id={campaign_id}"
          />
        </Field>
        <Field label="Multi-match Behavior">
          <SelectField
            value={row.multiMatchBehavior ?? ""}
            disabled={disabled}
            onChange={(next) => setField("multiMatchBehavior", next)}
            options={Object.keys(INTEGRATION_MULTI_MATCH_BEHAVIOR_LABELS) as IntegrationMultiMatchBehavior[]}
            labels={INTEGRATION_MULTI_MATCH_BEHAVIOR_LABELS}
            placeholder="What if lookup finds multiple candidates?"
          />
        </Field>
        <Field label="Rate Limit Notes">
          <Textarea
            value={row.rateLimitNotes ?? ""}
            disabled={disabled}
            rows={2}
            onChange={(event) => setField("rateLimitNotes", event.target.value)}
            placeholder="Expected request volume or Talkpush limit guidance"
          />
        </Field>
        <Field label="Retry / Timeout Notes">
          <Textarea
            value={row.retryTimeoutNotes ?? ""}
            disabled={disabled}
            rows={2}
            onChange={(event) => setField("retryTimeoutNotes", event.target.value)}
            placeholder="Retry policy, timeout expectations, duplicate callback handling"
          />
        </Field>
        <Field label="Idempotency Notes">
          <Textarea
            value={row.idempotencyNotes ?? ""}
            disabled={disabled}
            rows={2}
            onChange={(event) => setField("idempotencyNotes", event.target.value)}
            placeholder="How repeated callbacks should be handled"
          />
        </Field>
        <Field label="Sample Request" className="md:col-span-2">
          <Textarea
            value={row.sampleRequest ?? ""}
            disabled={disabled}
            rows={4}
            onChange={(event) => setField("sampleRequest", event.target.value)}
            placeholder='PATCH /campaign_invitations/{id}\n{"attributes": {"score": 90}}'
            className="font-mono text-sm"
          />
        </Field>
        <Field label="Sample Success Response">
          <Textarea
            value={row.sampleSuccessResponse ?? ""}
            disabled={disabled}
            rows={4}
            onChange={(event) => setField("sampleSuccessResponse", event.target.value)}
            placeholder='{"success": true}'
            className="font-mono text-sm"
          />
        </Field>
        <Field label="Sample Error Response">
          <Textarea
            value={row.sampleErrorResponse ?? ""}
            disabled={disabled}
            rows={4}
            onChange={(event) => setField("sampleErrorResponse", event.target.value)}
            placeholder='{"error": "Candidate not found"}'
            className="font-mono text-sm"
          />
        </Field>
        <Field label="UAT Test Candidate">
          <Textarea
            value={row.uatTestCandidate ?? ""}
            disabled={disabled}
            rows={2}
            onChange={(event) => setField("uatTestCandidate", event.target.value)}
            placeholder="Candidate name, email, phone, or application ID"
          />
        </Field>
        <Field label="Expected Talkpush Result">
          <Textarea
            value={row.expectedTalkpushResult ?? ""}
            disabled={disabled}
            rows={2}
            onChange={(event) => setField("expectedTalkpushResult", event.target.value)}
            placeholder="Attribute updated, document attached, folder changed, or pull returns expected candidates"
          />
        </Field>
      </div>
    </div>
  );
}

function OutboundConfiguration({
  row,
  disabled,
  sourceOptions,
  attributeOptions,
  setField,
  updatePayloadMapping,
  updateResponseHandling,
}: {
  row: IntegrationRow;
  disabled: boolean;
  sourceOptions: Array<{ value: string; label: string; group?: string }>;
  attributeOptions: Array<{ value: string; label: string; group?: string }>;
  setField: <K extends keyof IntegrationRow>(field: K, value: IntegrationRow[K]) => void;
  updatePayloadMapping: (updater: (rows: IntegrationPayloadMapping[]) => IntegrationPayloadMapping[]) => void;
  updateResponseHandling: (updater: (rows: IntegrationResponseMapping[]) => IntegrationResponseMapping[]) => void;
}) {
  const showAuthFields = (row.authMethod ?? "none") !== "none";

  return (
    <div>
      <SectionDivider title="Outbound Configuration" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Endpoint URL">
          <Input value={row.endpointUrl ?? ""} disabled={disabled} onChange={(event) => setField("endpointUrl", event.target.value)} />
        </Field>
        <Field label="HTTP Method">
          <Input value="POST" readOnly disabled />
        </Field>
        <Field label="Auth Method">
          <SelectField
            value={row.authMethod ?? "none"}
            disabled={disabled}
            onChange={(next) => setField("authMethod", next)}
            options={Object.keys(INTEGRATION_AUTH_LABELS) as IntegrationAuthMethod[]}
            labels={INTEGRATION_AUTH_LABELS}
          />
        </Field>
        {showAuthFields && (
          <>
            <Field label="Auth Param or Header Name">
              <Input value={row.authParamName ?? ""} disabled={disabled} onChange={(event) => setField("authParamName", event.target.value)} />
            </Field>
            <Field label="Auth Value">
              <Input type="password" value={row.authValue ?? ""} disabled={disabled} onChange={(event) => setField("authValue", event.target.value)} />
            </Field>
          </>
        )}
      </div>

      <MappingSection
        title="Outbound Payload Mapping"
        disabled={disabled}
        onAdd={() =>
          updatePayloadMapping((rows) => [
            ...rows,
            { id: crypto.randomUUID(), talkpushSource: "", vendorFieldName: "", required: false },
          ])
        }
      >
        {(row.outboundPayloadMapping ?? []).map((mapping, index) => (
          <div key={mapping.id} className="grid gap-2 md:grid-cols-[1.2fr_1fr_auto_auto]">
            <HybridPicker
              value={mapping.talkpushSource}
              disabled={disabled}
              onChange={(next) =>
                updatePayloadMapping((rows) =>
                  rows.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, talkpushSource: next } : item
                  )
                )
              }
              options={sourceOptions}
              placeholder="Talkpush source"
            />
            <Input
              value={mapping.vendorFieldName}
              disabled={disabled}
              onChange={(event) =>
                updatePayloadMapping((rows) =>
                  rows.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, vendorFieldName: event.target.value } : item
                  )
                )
              }
              placeholder="Vendor field name"
            />
            <label className="flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm text-gray-700">
              <Checkbox
                checked={mapping.required}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  updatePayloadMapping((rows) =>
                    rows.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, required: !!checked } : item
                    )
                  )
                }
              />
              Required
            </label>
            <RemoveButton disabled={disabled} onClick={() => updatePayloadMapping((rows) => rows.filter((_, itemIndex) => itemIndex !== index))} />
          </div>
        ))}
      </MappingSection>

      <MappingSection
        title="Response Handling"
        disabled={disabled}
        onAdd={() =>
          updateResponseHandling((rows) => [
            ...rows,
            { id: crypto.randomUUID(), vendorResponseField: "", targetAttribute: "" },
          ])
        }
      >
        {(row.responseHandling ?? []).map((mapping, index) => (
          <div key={mapping.id} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <Input
              value={mapping.vendorResponseField}
              disabled={disabled}
              onChange={(event) =>
                updateResponseHandling((rows) =>
                  rows.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, vendorResponseField: event.target.value } : item
                  )
                )
              }
              placeholder="Vendor response field"
            />
            <HybridPicker
              value={mapping.targetAttribute}
              disabled={disabled}
              onChange={(next) =>
                updateResponseHandling((rows) =>
                  rows.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, targetAttribute: next } : item
                  )
                )
              }
              options={attributeOptions}
              placeholder="Save to Talkpush attribute"
            />
            <RemoveButton disabled={disabled} onClick={() => updateResponseHandling((rows) => rows.filter((_, itemIndex) => itemIndex !== index))} />
          </div>
        ))}
      </MappingSection>
    </div>
  );
}

function MappingSection({
  title,
  children,
  onAdd,
  disabled,
}: {
  title: string;
  children: React.ReactNode;
  onAdd: () => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-5 rounded-lg border bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
        <Button type="button" variant="outline" size="sm" onClick={onAdd} disabled={disabled}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add
        </Button>
      </div>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}

function RemoveButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={disabled}
      onClick={onClick}
      className="text-muted-foreground hover:bg-red-50 hover:text-destructive"
      aria-label="Remove mapping"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
