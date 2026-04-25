"use client";

import { useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { SectionFooter } from "@/components/shared/SectionFooter";
import { EditableTable } from "@/components/shared/EditableTable";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import type {
  AtsAuthRequirement,
  AtsDataFormat,
  AtsFailureAction,
  AtsFieldMappingRow,
  AtsHandoffStatus,
  AtsIntegration,
  AtsSystem,
  AtsTalkpushEnvironment,
  AtsTriggerRow,
  ColumnDef,
  IntegrationAuthType,
  IntegrationDirection,
  IntegrationEnvironment,
  AtsIntegrationStatus,
} from "@/lib/types";

const ATS_SYSTEM_OPTIONS: AtsSystem[] = [
  "Workday",
  "SAP SuccessFactors",
  "PeopleStrong",
  "iCIMS",
  "Greenhouse",
  "Lever",
  "SmartRecruiters",
  "Oracle HCM",
  "Microsoft Dynamics HR",
  "BambooHR",
  "Other",
];

const DIRECTION_OPTIONS: IntegrationDirection[] = [
  "Talkpush → ATS",
  "ATS → Talkpush",
  "Bidirectional",
];
const TRIGGER_DIRECTION_OPTIONS: AtsTriggerRow["direction"][] = ["Talkpush → ATS", "ATS → Talkpush"];
const ENVIRONMENT_OPTIONS: IntegrationEnvironment[] = ["Sandbox", "Production", "Both"];
const STATUS_OPTIONS: AtsIntegrationStatus[] = ["Not Started", "In Progress", "UAT", "Live", "On Hold"];
const AUTH_TYPE_OPTIONS: IntegrationAuthType[] = ["API Key", "OAuth 2.0", "Basic Auth", "Webhook", "SFTP", "Other"];
const DATA_FORMAT_OPTIONS: AtsDataFormat[] = ["JSON", "XML", "Flat file", "Unknown"];
const FAILURE_ACTION_OPTIONS: AtsFailureAction[] = ["Retry", "Error folder", "Email alert", "TBD"];
const YES_NO_OPTIONS = ["Yes", "No"] as const;
const DEDUPE_OPTIONS = ["Yes", "No", "TBD"] as const;
const HANDOFF_STATUS_OPTIONS: AtsHandoffStatus[] = [
  "Not shared",
  "Shared with integration team",
  "Shared with vendor",
  "Confirmed by vendor",
];
const TALKPUSH_ENVIRONMENT_OPTIONS: AtsTalkpushEnvironment[] = [
  "Prod (test campaign)",
  "Staging",
  "Full production",
];

const AUTH_REQUIREMENT_DEFAULTS: Record<IntegrationAuthType, string[]> = {
  "API Key": ["API Base URL", "API Key"],
  "OAuth 2.0": ["API Base URL", "Client ID", "Client Secret", "Token Endpoint URL", "Scopes"],
  "Basic Auth": ["API Base URL", "Username", "Password"],
  Webhook: ["Webhook Secret", "Allowed IP ranges"],
  SFTP: ["SFTP Host", "SFTP Port", "Username", "SSH Key or Password", "File path / directory"],
  Other: [],
};

const triggerColumns: ColumnDef[] = [
  { key: "direction", label: "Direction", type: "dropdown", options: TRIGGER_DIRECTION_OPTIONS },
  { key: "talkpushFolder", label: "Talkpush folder", type: "text" },
  { key: "atsObject", label: "ATS object / event", type: "text" },
  { key: "action", label: "Action", type: "text" },
  { key: "notes", label: "Notes", type: "text" },
];

const fieldMappingColumns: ColumnDef[] = [
  { key: "talkpushAttribute", label: "Talkpush attribute", type: "text" },
  { key: "atsField", label: "ATS field", type: "text" },
  { key: "dataType", label: "Data type", type: "text" },
  { key: "direction", label: "Direction", type: "dropdown", options: DIRECTION_OPTIONS },
  { key: "notes", label: "Notes", type: "text" },
];

const authRequirementColumns: ColumnDef[] = [
  { key: "item", label: "Required item", type: "text" },
  { key: "value", label: "Value", type: "text" },
  { key: "receivedFromClient", label: "Received", type: "boolean" },
  { key: "notes", label: "Notes", type: "text" },
];

function makeAuthRequirement(item = ""): AtsAuthRequirement {
  return {
    id: crypto.randomUUID(),
    item,
    value: "",
    receivedFromClient: false,
    notes: "",
  };
}

function makeIntegration(): AtsIntegration {
  return {
    id: crypto.randomUUID(),
    name: "",
    system: "Workday",
    systemOther: "",
    direction: "Talkpush → ATS",
    environment: "Sandbox",
    status: "Not Started",
    integrationOwner: "",
    targetGoLiveDate: "",
    notes: "",
    triggers: [],
    fieldMappings: [],
    authType: "API Key",
    authTypeOther: "",
    authRequirements: [],
    sandboxBaseUrl: "",
    productionBaseUrl: "",
    apiVersion: "",
    additionalTechnicalNotes: "",
    checklist: {
      dataFormat: null,
      failureAction: null,
      deduplicationNeeded: null,
      deduplicationNotes: "",
      apiRateLimit: "",
      sandboxAccessConfirmed: null,
      testCandidateAgreed: null,
    },
    handoff: {
      talkpushEnvironment: "Prod (test campaign)",
      webhookUrlFormat: "",
      payloadSchema: "",
      sampleJsonPayload: "",
      handoffStatus: "Not shared",
    },
  };
}

function normalizeIntegration(integration: Partial<AtsIntegration>): AtsIntegration {
  const defaults = makeIntegration();
  return {
    ...defaults,
    ...integration,
    id: integration.id || defaults.id,
    triggers: Array.isArray(integration.triggers) ? integration.triggers : [],
    fieldMappings: Array.isArray(integration.fieldMappings) ? integration.fieldMappings : [],
    authRequirements: Array.isArray(integration.authRequirements) ? integration.authRequirements : [],
    checklist: {
      ...defaults.checklist,
      ...(integration.checklist ?? {}),
    },
    handoff: {
      ...defaults.handoff,
      ...(integration.handoff ?? {}),
    },
  };
}

function SectionDivider({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 mt-6 flex items-center gap-3 first:mt-0">
      <h3 className="shrink-0 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      <div className="h-px flex-1 bg-gray-200" />
      {children}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  className,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={className}
        rows={rows}
      />
    </div>
  );
}

function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly T[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      <Select value={value} onValueChange={(next) => onChange(next as T)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function PillSelector<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | null;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border">
      {options.map((option, index) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              "min-h-9 px-3 text-sm transition-colors",
              index > 0 && "border-l",
              selected
                ? "bg-primary text-primary-foreground"
                : "bg-white text-gray-700 hover:bg-slate-50"
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function HandoffStatusButton({
  value,
  onCycle,
  disabled,
}: {
  value: AtsHandoffStatus;
  onCycle: () => void;
  disabled: boolean;
}) {
  const colorClass: Record<AtsHandoffStatus, string> = {
    "Not shared": "border-gray-200 bg-gray-100 text-gray-700",
    "Shared with integration team": "border-amber-200 bg-amber-100 text-amber-800",
    "Shared with vendor": "border-blue-200 bg-blue-100 text-blue-800",
    "Confirmed by vendor": "border-green-200 bg-green-100 text-green-800",
  };

  return (
    <button
      type="button"
      onClick={onCycle}
      disabled={disabled}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70",
        colorClass[value]
      )}
    >
      {value}
    </button>
  );
}

function ChecklistRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 border-b py-3 last:border-b-0 sm:grid-cols-[220px_1fr] sm:items-center">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      <div>{children}</div>
    </div>
  );
}

function CopyTextarea({
  label,
  value,
  onChange,
  placeholder,
  copyKey,
  copiedKey,
  onCopied,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  copyKey: string;
  copiedKey: string | null;
  onCopied: (key: string) => void;
}) {
  const copied = copiedKey === copyKey;

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      <div className="relative">
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="font-mono text-sm"
          rows={6}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="absolute right-2 top-2 h-8 bg-white"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            onCopied(copyKey);
          }}
        >
          <Copy className="mr-1 h-3.5 w-3.5" />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

export function AtsIntegrationsSheet() {
  const { data, updateField, isReadOnly } = useChecklistContext();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const allIntegrations = Array.isArray(data.atsIntegrations)
    ? data.atsIntegrations.map((integration) => normalizeIntegration(integration))
    : [];
  const integrations = allIntegrations.filter((i) => !i.deletedAt);
  const deleteTarget = integrations.find((integration) => integration.id === deleteTargetId) ?? null;

  const saveIntegrations = (next: AtsIntegration[]) => {
    updateField("atsIntegrations", JSON.parse(JSON.stringify(next)) as AtsIntegration[]);
  };

  const updateIntegration = (
    integrationId: string,
    updater: (integration: AtsIntegration) => AtsIntegration
  ) => {
    saveIntegrations(
      allIntegrations.map((integration) =>
        integration.id === integrationId ? updater(integration) : integration
      )
    );
  };

  const updateIntegrationField = <K extends keyof AtsIntegration>(
    integrationId: string,
    field: K,
    value: AtsIntegration[K]
  ) => {
    updateIntegration(integrationId, (integration) => ({
      ...integration,
      [field]: value,
    }));
  };

  const addIntegration = () => {
    saveIntegrations([...allIntegrations, makeIntegration()]);
  };

  // Soft delete: stamp deletedAt instead of removing — consistent with other sections.
  const deleteIntegration = () => {
    if (!deleteTargetId) return;
    const now = new Date().toISOString();
    saveIntegrations(
      allIntegrations.map((integration) =>
        integration.id === deleteTargetId
          ? { ...integration, deletedAt: now }
          : integration
      )
    );
  };

  const handleCopied = (key: string) => {
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((current) => (current === key ? null : current));
    }, 2000);
  };

  return (
    <div>
      <SectionHeader
        title="ATS / HRIS Integrations"
        description="Internal Talkpush setup notes for ATS and HRIS integrations. Only visible to authenticated Talkpush admins."
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Track integration scope, required client credentials, and vendor handoff details.
        </p>
        {!isReadOnly && (
          <Button type="button" onClick={addIntegration} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Add Integration
          </Button>
        )}
      </div>

      {integrations.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No integrations configured yet. Click &quot;Add Integration&quot; to get started.
          </p>
        </div>
      ) : (
        <Accordion
          type="multiple"
          defaultValue={integrations.map((integration) => integration.id)}
          className="space-y-4"
        >
          {integrations.map((integration) => (
            <AccordionItem
              key={integration.id}
              value={integration.id}
              className="overflow-hidden rounded-lg border bg-white"
            >
              <div className="flex items-center gap-2 border-b px-4">
                <AccordionTrigger className="flex-1 hover:no-underline">
                  <div className="flex min-w-0 flex-col text-left">
                    <span className="truncate text-base font-semibold text-gray-900">
                      {integration.name || `${integration.system} Integration`}
                    </span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      {integration.environment} - {integration.status}
                    </span>
                  </div>
                </AccordionTrigger>
                {!isReadOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:bg-red-50 hover:text-destructive"
                    onClick={() => setDeleteTargetId(integration.id)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Delete
                  </Button>
                )}
              </div>

              <AccordionContent className="px-4 pb-5 pt-4">
                <SectionDivider title="SE Configuration" />
                <Accordion type="multiple" defaultValue={["overview", "triggers", "fields", "auth"]}>
                  <AccordionItem value="overview">
                    <AccordionTrigger>Overview</AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-4 md:grid-cols-2">
                        <TextField
                          label="Integration name"
                          value={integration.name}
                          onChange={(value) => updateIntegrationField(integration.id, "name", value)}
                          placeholder="e.g. Workday Production"
                        />
                        <SelectField
                          label="ATS / HRIS system"
                          value={integration.system}
                          onChange={(value) => updateIntegrationField(integration.id, "system", value)}
                          options={ATS_SYSTEM_OPTIONS}
                        />
                        {integration.system === "Other" && (
                          <TextField
                            label="System (if Other)"
                            value={integration.systemOther}
                            onChange={(value) => updateIntegrationField(integration.id, "systemOther", value)}
                          />
                        )}
                        <SelectField
                          label="Integration direction"
                          value={integration.direction}
                          onChange={(value) => updateIntegrationField(integration.id, "direction", value)}
                          options={DIRECTION_OPTIONS}
                        />
                        <SelectField
                          label="Environment"
                          value={integration.environment}
                          onChange={(value) => updateIntegrationField(integration.id, "environment", value)}
                          options={ENVIRONMENT_OPTIONS}
                        />
                        <SelectField
                          label="Status"
                          value={integration.status}
                          onChange={(value) => updateIntegrationField(integration.id, "status", value)}
                          options={STATUS_OPTIONS}
                        />
                        <TextField
                          label="Integration owner"
                          value={integration.integrationOwner}
                          onChange={(value) => updateIntegrationField(integration.id, "integrationOwner", value)}
                          placeholder="Integration team member"
                        />
                        <TextField
                          label="Target go-live date"
                          type="date"
                          value={integration.targetGoLiveDate}
                          onChange={(value) => updateIntegrationField(integration.id, "targetGoLiveDate", value)}
                        />
                        <div className="md:col-span-2">
                          <TextareaField
                            label="Notes"
                            value={integration.notes}
                            onChange={(value) => updateIntegrationField(integration.id, "notes", value)}
                            placeholder="Edge cases, dependencies, or scope notes"
                          />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="triggers">
                    <AccordionTrigger>Trigger Configuration</AccordionTrigger>
                    <AccordionContent>
                      <p className="mb-3 text-sm italic text-muted-foreground">
                        Define what happens in each system when a candidate moves folders. List one trigger per row. Both Talkpush-initiated and ATS-initiated triggers can be added here.
                      </p>
                      <EditableTable<AtsTriggerRow>
                        columns={triggerColumns}
                        data={integration.triggers}
                        addLabel="Add Trigger"
                        onUpdate={(index, field, value) =>
                          updateIntegration(integration.id, (current) => ({
                            ...current,
                            triggers: current.triggers.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, [field]: value } : row
                            ),
                          }))
                        }
                        onAdd={() =>
                          updateIntegration(integration.id, (current) => ({
                            ...current,
                            triggers: [
                              ...current.triggers,
                              {
                                id: crypto.randomUUID(),
                                direction: "Talkpush → ATS",
                                talkpushFolder: "",
                                atsObject: "",
                                action: "",
                                notes: "",
                              },
                            ],
                          }))
                        }
                        onDelete={(index) =>
                          updateIntegration(integration.id, (current) => ({
                            ...current,
                            triggers: current.triggers.filter((_, rowIndex) => rowIndex !== index),
                          }))
                        }
                      />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="fields">
                    <AccordionTrigger>Field Mapping</AccordionTrigger>
                    <AccordionContent>
                      <p className="mb-3 text-sm italic text-muted-foreground">
                        Map Talkpush candidate attributes to ATS/HRIS fields. Use the exact attribute key from the Attributes tab (e.g. `first_name`, `1 - Has BPO Experience`).
                      </p>
                      <EditableTable<AtsFieldMappingRow>
                        columns={fieldMappingColumns}
                        data={integration.fieldMappings}
                        addLabel="Add Mapping"
                        onUpdate={(index, field, value) =>
                          updateIntegration(integration.id, (current) => ({
                            ...current,
                            fieldMappings: current.fieldMappings.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, [field]: value } : row
                            ),
                          }))
                        }
                        onAdd={() =>
                          updateIntegration(integration.id, (current) => ({
                            ...current,
                            fieldMappings: [
                              ...current.fieldMappings,
                              {
                                id: crypto.randomUUID(),
                                talkpushAttribute: "",
                                atsField: "",
                                dataType: "",
                                direction: "Talkpush → ATS",
                                notes: "",
                              },
                            ],
                          }))
                        }
                        onDelete={(index) =>
                          updateIntegration(integration.id, (current) => ({
                            ...current,
                            fieldMappings: current.fieldMappings.filter((_, rowIndex) => rowIndex !== index),
                          }))
                        }
                      />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="auth">
                    <AccordionTrigger>Auth & Technical Requirements</AccordionTrigger>
                    <AccordionContent>
                      <p className="mb-3 text-sm italic text-muted-foreground">
                        List everything the integration team will need to build and test this integration. Check &quot;Received&quot; once the client has provided the item.
                      </p>
                      <div className="mb-5 grid gap-4 md:grid-cols-2">
                        <SelectField
                          label="Auth type"
                          value={integration.authType}
                          onChange={(value) =>
                            updateIntegration(integration.id, (current) => ({
                              ...current,
                              authType: value,
                              authRequirements:
                                current.authRequirements.length === 0
                                  ? AUTH_REQUIREMENT_DEFAULTS[value].map((item) => makeAuthRequirement(item))
                                  : current.authRequirements,
                            }))
                          }
                          options={AUTH_TYPE_OPTIONS}
                        />
                        {integration.authType === "Other" && (
                          <TextField
                            label="Auth type (if Other)"
                            value={integration.authTypeOther}
                            onChange={(value) => updateIntegrationField(integration.id, "authTypeOther", value)}
                          />
                        )}
                        <TextField
                          label="Sandbox base URL"
                          value={integration.sandboxBaseUrl}
                          onChange={(value) => updateIntegrationField(integration.id, "sandboxBaseUrl", value)}
                        />
                        <TextField
                          label="Production base URL"
                          value={integration.productionBaseUrl}
                          onChange={(value) => updateIntegrationField(integration.id, "productionBaseUrl", value)}
                        />
                        <TextField
                          label="API version"
                          value={integration.apiVersion}
                          onChange={(value) => updateIntegrationField(integration.id, "apiVersion", value)}
                        />
                        <div className="md:col-span-2">
                          <TextareaField
                            label="Additional technical notes"
                            value={integration.additionalTechnicalNotes}
                            onChange={(value) => updateIntegrationField(integration.id, "additionalTechnicalNotes", value)}
                          />
                        </div>
                      </div>
                      <EditableTable<AtsAuthRequirement>
                        columns={authRequirementColumns}
                        data={integration.authRequirements}
                        addLabel="Add Requirement"
                        onUpdate={(index, field, value) =>
                          updateIntegration(integration.id, (current) => ({
                            ...current,
                            authRequirements: current.authRequirements.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, [field]: value } : row
                            ),
                          }))
                        }
                        onAdd={() =>
                          updateIntegration(integration.id, (current) => ({
                            ...current,
                            authRequirements: [...current.authRequirements, makeAuthRequirement()],
                          }))
                        }
                        onDelete={(index) =>
                          updateIntegration(integration.id, (current) => ({
                            ...current,
                            authRequirements: current.authRequirements.filter((_, rowIndex) => rowIndex !== index),
                          }))
                        }
                      />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <SectionDivider title="Integration Handoff">
                  <HandoffStatusButton
                    value={integration.handoff.handoffStatus}
                    disabled={isReadOnly}
                    onCycle={() =>
                      updateIntegration(integration.id, (current) => {
                        const currentIndex = HANDOFF_STATUS_OPTIONS.indexOf(current.handoff.handoffStatus);
                        const nextStatus = HANDOFF_STATUS_OPTIONS[(currentIndex + 1) % HANDOFF_STATUS_OPTIONS.length];
                        return {
                          ...current,
                          handoff: { ...current.handoff, handoffStatus: nextStatus },
                        };
                      })
                    }
                  />
                </SectionDivider>
                <Accordion type="multiple" defaultValue={["checklist", "handoff"]}>
                  <AccordionItem value="checklist">
                    <AccordionTrigger>Integration Checklist</AccordionTrigger>
                    <AccordionContent>
                      <p className="mb-3 text-sm italic text-muted-foreground">
                        Answer these before handing off to the integration team. They prevent the most common blockers during build and UAT.
                      </p>
                      <div className="rounded-lg border px-4">
                        <ChecklistRow label="Data format expected by ATS">
                          <PillSelector
                            value={integration.checklist.dataFormat}
                            options={DATA_FORMAT_OPTIONS}
                            onChange={(value) =>
                              updateIntegration(integration.id, (current) => ({
                                ...current,
                                checklist: { ...current.checklist, dataFormat: value },
                              }))
                            }
                          />
                        </ChecklistRow>
                        <ChecklistRow label="On integration failure">
                          <PillSelector
                            value={integration.checklist.failureAction}
                            options={FAILURE_ACTION_OPTIONS}
                            onChange={(value) =>
                              updateIntegration(integration.id, (current) => ({
                                ...current,
                                checklist: { ...current.checklist, failureAction: value },
                              }))
                            }
                          />
                        </ChecklistRow>
                        <ChecklistRow label="Deduplication needed?">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <PillSelector
                              value={integration.checklist.deduplicationNeeded}
                              options={DEDUPE_OPTIONS}
                              onChange={(value) =>
                                updateIntegration(integration.id, (current) => ({
                                  ...current,
                                  checklist: { ...current.checklist, deduplicationNeeded: value },
                                }))
                              }
                            />
                            {integration.checklist.deduplicationNeeded === "Yes" && (
                              <Input
                                value={integration.checklist.deduplicationNotes}
                                onChange={(event) =>
                                  updateIntegration(integration.id, (current) => ({
                                    ...current,
                                    checklist: {
                                      ...current.checklist,
                                      deduplicationNotes: event.target.value,
                                    },
                                  }))
                                }
                                placeholder="Deduplication rule or matching key"
                              />
                            )}
                          </div>
                        </ChecklistRow>
                        <ChecklistRow label="API rate limit">
                          <Input
                            value={integration.checklist.apiRateLimit}
                            onChange={(event) =>
                              updateIntegration(integration.id, (current) => ({
                                ...current,
                                checklist: { ...current.checklist, apiRateLimit: event.target.value },
                              }))
                            }
                            placeholder="Unknown"
                          />
                        </ChecklistRow>
                        <ChecklistRow label="Sandbox access confirmed?">
                          <PillSelector
                            value={integration.checklist.sandboxAccessConfirmed}
                            options={YES_NO_OPTIONS}
                            onChange={(value) =>
                              updateIntegration(integration.id, (current) => ({
                                ...current,
                                checklist: { ...current.checklist, sandboxAccessConfirmed: value },
                              }))
                            }
                          />
                        </ChecklistRow>
                        <ChecklistRow label="Test candidate agreed?">
                          <PillSelector
                            value={integration.checklist.testCandidateAgreed}
                            options={YES_NO_OPTIONS}
                            onChange={(value) =>
                              updateIntegration(integration.id, (current) => ({
                                ...current,
                                checklist: { ...current.checklist, testCandidateAgreed: value },
                              }))
                            }
                          />
                        </ChecklistRow>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="handoff">
                    <AccordionTrigger>Talkpush Handoff Info</AccordionTrigger>
                    <AccordionContent>
                      <p className="mb-3 text-sm italic text-muted-foreground">
                        Information to share with the vendor&apos;s integration engineer so they can point to Talkpush correctly.
                      </p>
                      <div className="space-y-4 rounded-lg bg-muted p-4">
                        <div className="flex flex-col gap-2">
                          <Label className="text-sm font-medium text-gray-700">Talkpush environment</Label>
                          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                            {TALKPUSH_ENVIRONMENT_OPTIONS.map((option) => (
                              <label key={option} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                                <input
                                  type="radio"
                                  name={`talkpush-environment-${integration.id}`}
                                  value={option}
                                  checked={integration.handoff.talkpushEnvironment === option}
                                  onChange={() =>
                                    updateIntegration(integration.id, (current) => ({
                                      ...current,
                                      handoff: { ...current.handoff, talkpushEnvironment: option },
                                    }))
                                  }
                                  className="h-4 w-4"
                                />
                                {option}
                              </label>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Recommended - isolates issues while using real infrastructure.
                          </p>
                        </div>
                        <TextField
                          label="Webhook URL format"
                          value={integration.handoff.webhookUrlFormat}
                          onChange={(value) =>
                            updateIntegration(integration.id, (current) => ({
                              ...current,
                              handoff: { ...current.handoff, webhookUrlFormat: value },
                            }))
                          }
                          placeholder="Talkpush webhook URL to share with the vendor"
                        />
                        <CopyTextarea
                          label="Payload schema"
                          value={integration.handoff.payloadSchema}
                          onChange={(value) =>
                            updateIntegration(integration.id, (current) => ({
                              ...current,
                              handoff: { ...current.handoff, payloadSchema: value },
                            }))
                          }
                          placeholder="Describe the outgoing payload shape"
                          copyKey={`${integration.id}-payloadSchema`}
                          copiedKey={copiedKey}
                          onCopied={handleCopied}
                        />
                        <CopyTextarea
                          label="Sample JSON payload"
                          value={integration.handoff.sampleJsonPayload}
                          onChange={(value) =>
                            updateIntegration(integration.id, (current) => ({
                              ...current,
                              handoff: { ...current.handoff, sampleJsonPayload: value },
                            }))
                          }
                          placeholder="{ }"
                          copyKey={`${integration.id}-sampleJsonPayload`}
                          copiedKey={copiedKey}
                          onCopied={handleCopied}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null);
        }}
        title="Delete this integration?"
        fileName={deleteTarget?.name || "this integration"}
        onConfirm={deleteIntegration}
        description={
          <>
            <strong>{deleteTarget?.name || "This integration"}</strong> and its trigger, field mapping, auth, and handoff details will be permanently removed.
          </>
        }
      />

      <SectionFooter />
    </div>
  );
}
