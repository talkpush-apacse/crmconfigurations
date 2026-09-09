/**
 * MCP Server for CRM Config Checklist
 *
 * Exposes tools for managing checklists via Claude AI.
 * Most write tools are append-only; configuration tools merge partial updates.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import {
  getCustomTabSectionState,
  getSectionState,
  type SectionState,
} from "./section-status";
import { CHECKLIST_JSON_FIELDS, FIELD_LABELS, type ChecklistJsonField } from "./types";
import { TAB_CONFIG } from "./tab-config";
import {
  assertTableTab,
  CUSTOM_TAB_COLUMN_TYPES,
  CustomTabError,
  describeColumns,
  normalizeColumns,
  normalizeRows,
  renderPreviewTable,
  summarizeTab,
  type ColumnSpec,
} from "./custom-tab-service";
import { CONFIGURATOR_TEMPLATE } from "./configurator-template";
import {
  getAttachmentTabKeys,
  parseStorageUrl,
  scanChecklistForAttachments,
  type Attachment,
} from "./mcp/attachments";
import {
  ConfiguratorServiceError,
  generateConfiguratorChecklist,
  getConfiguratorChecklist,
  getConfiguratorMeta,
  getConfiguratorProgress,
  refreshConfiguratorSnapshot,
  updateConfiguratorItem,
} from "./configurator-service";
import {
  createSnapshot,
  getChecklistIdBySlug,
  listSnapshots,
  restoreSnapshot,
  SnapshotServiceError,
} from "./snapshot-service";
import type {
  QuestionRow,
  SourceRow,
  FolderRow,
  MessagingTemplateRow,
  AttributeRow,
  CampaignRow,
  SiteRow,
  DocumentRow,
  AgencyPortalRow,
  UserRow,
  CustomTab,
  CustomTabRow,
  CustomData,
  LabelRow,
  AtsIntegration,
  AtsTriggerRow,
  AtsFieldMappingRow,
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uuid(): string {
  return crypto.randomUUID();
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function mcpJson(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

function mcpError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

const MAX_INLINE_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function appendWarning(current: string | undefined, next: string | undefined): string | undefined {
  if (!next) return current;
  if (!current) return next;
  return `${current}; ${next}`;
}

async function createAttachmentSignedUrl(
  attachment: Attachment,
  expirySeconds: number
): Promise<{ signedUrl: string; signedUrlExpiresAt: string; warning?: string }> {
  const signedUrlExpiresAt = new Date(Date.now() + expirySeconds * 1000).toISOString();
  const storageParts = parseStorageUrl(attachment.url);

  if (!storageParts) {
    return {
      signedUrl: attachment.url,
      signedUrlExpiresAt,
      warning: "Stored URL is not a Supabase Storage URL; returning stored URL without signing",
    };
  }

  const { supabase } = await import("./supabase");
  if (!supabase) {
    throw new Error("Supabase service-role client is not configured; cannot create signed URL");
  }

  const { data, error } = await supabase.storage
    .from(storageParts.bucket)
    .createSignedUrl(storageParts.path, expirySeconds);

  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  if (!data?.signedUrl) {
    throw new Error("Failed to create signed URL: Supabase returned no URL");
  }

  return { signedUrl: data.signedUrl, signedUrlExpiresAt };
}

async function fetchAttachmentBytesBase64(
  signedUrl: string
): Promise<{ bytesBase64?: string; warning?: string }> {
  const response = await fetch(signedUrl);

  if (!response.ok) {
    throw new Error(`Failed to download attachment: ${response.status} ${response.statusText}`);
  }

  const contentLengthHeader = response.headers.get("content-length");
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : null;
  if (contentLength !== null && Number.isFinite(contentLength) && contentLength > MAX_INLINE_ATTACHMENT_BYTES) {
    return { warning: "File too large for inline bytes; use signedUrl" };
  }

  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_INLINE_ATTACHMENT_BYTES) {
      return { warning: "File too large for inline bytes; use signedUrl" };
    }
    return { bytesBase64: buffer.toString("base64") };
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > MAX_INLINE_ATTACHMENT_BYTES) {
      await reader.cancel();
      return { warning: "File too large for inline bytes; use signedUrl" };
    }

    chunks.push(Buffer.from(value));
  }

  return { bytesBase64: Buffer.concat(chunks).toString("base64") };
}

const integrationPayloadMappingSchema = z.object({
  talkpushSource: z.string().optional().default(""),
  vendorFieldName: z.string().optional().default(""),
  required: z.boolean().optional().default(false),
});

const integrationResponseMappingSchema = z.object({
  vendorResponseField: z.string().optional().default(""),
  targetAttribute: z.string().optional().default(""),
});

const integrationAttributeMappingSchema = z.object({
  vendorCallbackField: z.string().optional().default(""),
  targetAttribute: z.string().optional().default(""),
});

const integrationRowSchema = z.object({
  vendorName: z.string(),
  vendorCategory: z.enum(["hris_ats", "assessment", "background_check", "medical_exam", "others"]).optional(),
  actionType: z.enum(["outbound_post", "inbound_pull", "inbound_patch_attribute", "inbound_upload_document", "inbound_change_status"]).optional(),
  triggerFolder: z.string().optional(),
  status: z.enum(["not_started", "scoping", "in_development", "uat", "live"]).optional(),
  vendorContactName: z.string().optional(),
  vendorContactEmail: z.string().optional(),
  vendorDocsUrl: z.string().optional(),
  notes: z.string().optional(),
  endpointUrl: z.string().optional(),
  authMethod: z.enum(["none", "api_key_query", "bearer_token", "custom_header", "basic_auth"]).optional(),
  authParamName: z.string().optional(),
  authValue: z.string().optional(),
  outboundPayloadMapping: z.array(integrationPayloadMappingSchema).optional(),
  responseHandling: z.array(integrationResponseMappingSchema).optional(),
  inboundAttributeMapping: z.array(integrationAttributeMappingSchema).optional(),
  matchKey: z.enum(["candidate_id", "email", "phone", "application_id"]).optional(),
  documentTag: z.string().optional(),
  targetFolder: z.string().optional(),
  filterCriteria: z.string().optional(),
  talkpushApiBaseUrl: z.string().optional(),
  apiEnvironment: z.enum(["production", "staging", "test_campaign", "tbd"]).optional(),
  inboundAuthMethod: z.enum(["none", "api_key_query", "bearer_token", "custom_header", "basic_auth"]).optional(),
  inboundAuthParamName: z.string().optional(),
  inboundAuthValue: z.string().optional(),
  campaignScope: z.enum(["single_campaign", "multiple_campaigns", "all_campaigns", "tbd"]).optional(),
  campaignIds: z.string().optional(),
  campaignNames: z.string().optional(),
  candidateIdSource: z.enum([
    "provided_in_outbound_payload",
    "vendor_stores_talkpush_id",
    "lookup_get_campaign_invitations",
    "provided_by_talkpush_se",
    "other",
  ]).optional(),
  candidateIdFieldName: z.string().optional(),
  lookupQueryParams: z.string().optional(),
  multiMatchBehavior: z.enum(["reject", "use_most_recent", "use_first_match", "manual_review", "tbd"]).optional(),
  sampleRequest: z.string().optional(),
  sampleSuccessResponse: z.string().optional(),
  sampleErrorResponse: z.string().optional(),
  rateLimitNotes: z.string().optional(),
  retryTimeoutNotes: z.string().optional(),
  idempotencyNotes: z.string().optional(),
  uatTestCandidate: z.string().optional(),
  expectedTalkpushResult: z.string().optional(),
});

/** Convert attributeName to snake_case key with "1_" prefix (matches UI behavior) */
function deriveAttributeKey(name: string): string {
  return (
    "1_" +
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
  );
}

/**
 * Generic append helper — reads current array from a checklist section,
 * appends new rows, and saves with field-level versioning in a transaction.
 */
async function appendToSection<T extends { id: string }>(
  slug: string,
  sectionField: string,
  newRows: T[]
): Promise<{ added: T[]; totalCount: number; version: number }> {
  const result = await prisma.$transaction(async (tx) => {
    // Lock the row
    const locked = await tx.$queryRaw<
      Array<{ id: string; version: number; fieldVersions: Record<string, number> | null }>
    >`SELECT id, version, "fieldVersions" FROM "Checklist" WHERE slug = ${slug} FOR UPDATE`;

    const current = locked[0];
    if (!current) {
      throw new Error(`Checklist with slug "${slug}" not found`);
    }

    // Read the full row to get the section data
    const checklist = await tx.checklist.findUnique({
      where: { id: current.id },
      select: { [sectionField]: true } as Record<string, boolean>,
    });

    const existingData = ((checklist as Record<string, unknown>)?.[sectionField] as T[]) ?? [];
    const merged = [...existingData, ...newRows];

    const newVersion = current.version + 1;
    const fieldVersions = { ...(current.fieldVersions ?? {}), [sectionField]: newVersion };

    await tx.checklist.update({
      where: { id: current.id },
      data: {
        [sectionField]: toPrismaJson(merged),
        version: newVersion,
        fieldVersions: toPrismaJson(fieldVersions),
      },
    });

    return { added: newRows, totalCount: merged.length, version: newVersion };
  });

  return result;
}

/**
 * Generic remove-by-id helper — reads current array from a checklist section,
 * removes the row whose `id` matches, and saves with field-level versioning.
 * Throws when the checklist slug or the row id cannot be found so callers
 * can surface a 404.
 */
async function removeFromSectionById<T extends { id: string }>(
  slug: string,
  sectionField: string,
  rowId: string
): Promise<{ removedId: string; totalCount: number; version: number }> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<
      Array<{ id: string; version: number; fieldVersions: Record<string, number> | null }>
    >`SELECT id, version, "fieldVersions" FROM "Checklist" WHERE slug = ${slug} FOR UPDATE`;

    const current = locked[0];
    if (!current) {
      throw new Error(`Checklist with slug "${slug}" not found`);
    }

    const checklist = await tx.checklist.findUnique({
      where: { id: current.id },
      select: { [sectionField]: true } as Record<string, boolean>,
    });

    const existingData = ((checklist as Record<string, unknown>)?.[sectionField] as T[]) ?? [];
    const index = existingData.findIndex((row) => row.id === rowId);
    if (index === -1) {
      throw new Error(`Row with id "${rowId}" not found in section "${sectionField}"`);
    }

    const nextRows = [...existingData.slice(0, index), ...existingData.slice(index + 1)];
    const newVersion = current.version + 1;
    const fieldVersions = { ...(current.fieldVersions ?? {}), [sectionField]: newVersion };

    await tx.checklist.update({
      where: { id: current.id },
      data: {
        [sectionField]: toPrismaJson(nextRows),
        version: newVersion,
        fieldVersions: toPrismaJson(fieldVersions),
      },
    });

    return { removedId: rowId, totalCount: nextRows.length, version: newVersion };
  });
}

/** Same as appendToSection but for string arrays (rejectionReasons) */
async function appendStringsToSection(
  slug: string,
  sectionField: string,
  newStrings: string[]
): Promise<{ added: string[]; totalCount: number; version: number }> {
  const result = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<
      Array<{ id: string; version: number; fieldVersions: Record<string, number> | null }>
    >`SELECT id, version, "fieldVersions" FROM "Checklist" WHERE slug = ${slug} FOR UPDATE`;

    const current = locked[0];
    if (!current) {
      throw new Error(`Checklist with slug "${slug}" not found`);
    }

    const checklist = await tx.checklist.findUnique({
      where: { id: current.id },
      select: { [sectionField]: true } as Record<string, boolean>,
    });

    const existingData = ((checklist as Record<string, unknown>)?.[sectionField] as string[]) ?? [];
    const merged = [...existingData, ...newStrings];

    const newVersion = current.version + 1;
    const fieldVersions = { ...(current.fieldVersions ?? {}), [sectionField]: newVersion };

    await tx.checklist.update({
      where: { id: current.id },
      data: {
        [sectionField]: toPrismaJson(merged),
        version: newVersion,
        fieldVersions: toPrismaJson(fieldVersions),
      },
    });

    return { added: newStrings, totalCount: merged.length, version: newVersion };
  });

  return result;
}

async function appendToSectionByEditorToken<T extends { id: string }>(
  editorToken: string,
  sectionField: string,
  newRows: T[]
): Promise<{ added: T[]; totalCount: number; version: number }> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<
      Array<{ id: string; version: number; fieldVersions: Record<string, number> | null }>
    >`SELECT id, version, "fieldVersions" FROM "Checklist" WHERE "editorToken" = ${editorToken} FOR UPDATE`;

    const current = locked[0];
    if (!current) {
      throw new Error("Checklist not found for the provided editor token");
    }

    const checklist = await tx.checklist.findUnique({
      where: { id: current.id },
      select: { [sectionField]: true } as Record<string, boolean>,
    });

    const existingData = ((checklist as Record<string, unknown>)?.[sectionField] as T[]) ?? [];
    const merged = [...existingData, ...newRows];
    const newVersion = current.version + 1;
    const fieldVersions = { ...(current.fieldVersions ?? {}), [sectionField]: newVersion };

    await tx.checklist.update({
      where: { id: current.id },
      data: {
        [sectionField]: toPrismaJson(JSON.parse(JSON.stringify(merged))),
        version: newVersion,
        fieldVersions: toPrismaJson(fieldVersions),
      },
    });

    return { added: newRows, totalCount: merged.length, version: newVersion };
  });
}

async function appendToAtsIntegration<
  TRow extends AtsTriggerRow | AtsFieldMappingRow
>(
  slug: string,
  integrationId: string,
  rowField: "triggers" | "fieldMappings",
  newRows: TRow[]
): Promise<{ added: TRow[]; totalCount: number; version: number; integrationName: string }> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<
      Array<{ id: string; version: number; fieldVersions: Record<string, number> | null }>
    >`SELECT id, version, "fieldVersions" FROM "Checklist" WHERE slug = ${slug} FOR UPDATE`;

    const current = locked[0];
    if (!current) {
      throw new Error(`Checklist with slug "${slug}" not found`);
    }

    const checklist = await tx.checklist.findUnique({
      where: { id: current.id },
      select: { atsIntegrations: true },
    });

    const existingIntegrations = ((checklist?.atsIntegrations ?? []) as unknown) as AtsIntegration[];
    const integrationIndex = existingIntegrations.findIndex((integration) => integration.id === integrationId);
    if (integrationIndex === -1) {
      throw new Error(`ATS integration with id "${integrationId}" not found`);
    }

    const existingIntegration = existingIntegrations[integrationIndex];
    const existingRows = Array.isArray(existingIntegration[rowField])
      ? (existingIntegration[rowField] as TRow[])
      : [];
    const updatedIntegration: AtsIntegration = {
      ...existingIntegration,
      [rowField]: [...existingRows, ...newRows],
    };
    const nextIntegrations = [...existingIntegrations];
    nextIntegrations[integrationIndex] = updatedIntegration;

    const newVersion = current.version + 1;
    const fieldVersions = { ...(current.fieldVersions ?? {}), atsIntegrations: newVersion };

    await tx.checklist.update({
      where: { id: current.id },
      data: {
        atsIntegrations: toPrismaJson(JSON.parse(JSON.stringify(nextIntegrations))),
        version: newVersion,
        fieldVersions: toPrismaJson(fieldVersions),
      },
    });

    return {
      added: newRows,
      totalCount: existingRows.length + newRows.length,
      version: newVersion,
      integrationName: updatedIntegration.name || updatedIntegration.system || integrationId,
    };
  });
}

// ---------------------------------------------------------------------------
// MCP Server Factory
// ---------------------------------------------------------------------------

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "CRM Config Checklist",
    version: "1.0.0",
  });

  // =========================================================================
  // READ TOOLS
  // =========================================================================

  server.tool(
    "list_checklists",
    "List all CRM configuration checklists with client name, slug, and dates",
    {},
    async () => {
      const checklists = await prisma.checklist.findMany({
        select: {
          clientName: true,
          slug: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(checklists, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get_checklist",
    "Get full checklist data by slug, including all sections",
    { slug: z.string().describe("The checklist URL slug (e.g. 'acme-corp')") },
    async ({ slug }) => {
      const checklist = await prisma.checklist.findUnique({
        where: { slug },
      });

      if (!checklist) {
        return {
          content: [{ type: "text" as const, text: `Checklist with slug "${slug}" not found` }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(checklist, null, 2) }],
      };
    }
  );

  server.tool(
    "get_checklist_progress",
    "Get completion status (not-started / in-progress / complete) for each section of a checklist",
    { slug: z.string().describe("The checklist URL slug") },
    async ({ slug }) => {
      const checklist = await prisma.checklist.findUnique({ where: { slug } });

      if (!checklist) {
        return {
          content: [{ type: "text" as const, text: `Checklist with slug "${slug}" not found` }],
          isError: true,
        };
      }

      const progress: Record<string, SectionState> = {};

      for (const field of CHECKLIST_JSON_FIELDS) {
        // Skip config fields — only report data sections
        if (["enabledTabs", "tabOrder", "communicationChannels", "featureToggles", "customSchema", "customData", "customTabs"].includes(field)) {
          continue;
        }

        const label = FIELD_LABELS[field as ChecklistJsonField] ?? field;
        const value = (checklist as Record<string, unknown>)[field];
        progress[label] = getSectionState(value, field as ChecklistJsonField);
      }

      // Custom tabs live in one JSON blob rather than their own column, so they
      // are reported per tab here instead of by the loop above. A client filling
      // in a custom tab is doing real work on the checklist and it should show.
      const customTabs = (checklist.customTabs ?? []) as unknown as CustomTab[];
      const customData = (checklist.customData ?? null) as CustomData | null;
      for (const tab of customTabs) {
        progress[`${tab.label} (custom)`] = getCustomTabSectionState(tab, customData);
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(progress, null, 2) }],
      };
    }
  );

  server.tool(
    "get_section",
    "Get a specific section's data from a checklist (e.g. prescreening, sources, folders, messaging, attributes)",
    {
      slug: z.string().describe("The checklist URL slug"),
      section: z
        .enum(CHECKLIST_JSON_FIELDS as unknown as [string, ...string[]])
        .describe("Section field name (e.g. 'prescreening', 'sources', 'folders', 'messaging', 'attributes')"),
    },
    async ({ slug, section }) => {
      const checklist = await prisma.checklist.findUnique({
        where: { slug },
        select: { [section]: true } as Record<string, boolean>,
      });

      if (!checklist) {
        return {
          content: [{ type: "text" as const, text: `Checklist with slug "${slug}" not found` }],
          isError: true,
        };
      }

      const data = (checklist as Record<string, unknown>)[section];
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "list_attachments",
    "List every file attachment uploaded across a checklist's tabs, optionally filtered to one tab key",
    {
      slug: z.string().describe("The checklist URL slug"),
      tab: z.string().optional().describe("Optional tab key to filter by, e.g. 'companyInfo' or 'documents'"),
    },
    async ({ slug, tab }) => {
      try {
        const checklist = await prisma.checklist.findUnique({
          where: { slug },
        });

        if (!checklist) {
          return mcpError(new Error(`Checklist with slug "${slug}" not found`));
        }

        const checklistRecord = checklist as unknown as Record<string, unknown>;
        const validTabs = getAttachmentTabKeys(checklistRecord);
        if (tab && !validTabs.has(tab)) {
          return mcpError(new Error(`Tab "${tab}" not found`));
        }

        const attachments = scanChecklistForAttachments(checklistRecord);
        const filteredAttachments = tab
          ? attachments.filter((attachment) => attachment.tab === tab)
          : attachments;

        return mcpJson({
          slug,
          clientName: checklist.clientName,
          count: filteredAttachments.length,
          attachments: filteredAttachments,
        });
      } catch (error) {
        return mcpError(error);
      }
    }
  );

  server.tool(
    "fetch_attachment",
    "Return a fresh signed URL for a checklist attachment and optionally inline base64 bytes for files under 10 MB",
    {
      slug: z.string().describe("The checklist URL slug"),
      tab: z.string().describe("Tab key returned by list_attachments"),
      fieldPath: z.string().describe("Attachment fieldPath returned by list_attachments"),
      includeBytes: z.boolean().optional().default(false).describe("Include file bytes as base64 when the file is under 10 MB"),
      signedUrlExpirySeconds: z
        .number()
        .int()
        .positive()
        .max(3600)
        .optional()
        .default(300)
        .describe("Signed URL expiry in seconds, max 3600"),
    },
    async ({ slug, tab, fieldPath, includeBytes, signedUrlExpirySeconds }) => {
      try {
        const checklist = await prisma.checklist.findUnique({
          where: { slug },
        });

        if (!checklist) {
          return mcpError(new Error(`Checklist with slug "${slug}" not found`));
        }

        const checklistRecord = checklist as unknown as Record<string, unknown>;
        const validTabs = getAttachmentTabKeys(checklistRecord);
        if (!validTabs.has(tab)) {
          return mcpError(new Error(`Tab "${tab}" not found`));
        }

        const attachment = scanChecklistForAttachments(checklistRecord).find(
          (candidate) => candidate.tab === tab && candidate.fieldPath === fieldPath
        );

        if (!attachment) {
          return mcpError(new Error(`Attachment not found at ${tab}.${fieldPath}`));
        }

        const signed = await createAttachmentSignedUrl(attachment, signedUrlExpirySeconds);
        let warning = signed.warning;
        let bytesBase64: string | undefined;

        if (includeBytes) {
          const bytes = await fetchAttachmentBytesBase64(signed.signedUrl);
          bytesBase64 = bytes.bytesBase64;
          warning = appendWarning(warning, bytes.warning);
        }

        return mcpJson({
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          size: attachment.size,
          signedUrl: signed.signedUrl,
          signedUrlExpiresAt: signed.signedUrlExpiresAt,
          ...(bytesBase64 ? { bytesBase64 } : {}),
          ...(warning ? { warning } : {}),
        });
      } catch (error) {
        return mcpError(error);
      }
    }
  );

  // =========================================================================
  // WRITE TOOLS (Append-Only)
  // =========================================================================

  // --- Prescreening Questions ---
  server.tool(
    "add_prescreening_questions",
    "Append pre-screening questions to a checklist. Does NOT remove existing questions.",
    {
      slug: z.string().describe("The checklist URL slug"),
      questions: z
        .array(
          z.object({
            category: z.string().describe("Question category (e.g. 'Pre-screening', 'Follow-up')"),
            question: z.string().describe("The question text"),
            questionType: z.string().describe("Type: Text, Number, Multiple Choice, Dropdown, Audio, Video, File Upload, Booking, Geolocation, Play Media"),
            answerOptions: z.string().optional().default("").describe("Comma-separated answer options (for Multiple Choice / Dropdown)"),
            applicableCampaigns: z.string().optional().default("").describe("Which campaigns this applies to"),
            autoReject: z.string().optional().default("").describe("Whether to auto-reject: Yes / No"),
            rejectCondition: z.string().optional().default("").describe("Condition for auto-reject"),
            rejectReason: z.string().optional().default("").describe("Rejection reason shown to candidate"),
            comments: z.string().optional().default(""),
          })
        )
        .describe("Array of questions to add"),
    },
    async ({ slug, questions }) => {
      const rows: QuestionRow[] = questions.map((q) => ({
        id: uuid(),
        category: q.category,
        question: q.question,
        questionType: q.questionType,
        answerOptions: q.answerOptions,
        applicableCampaigns: q.applicableCampaigns,
        autoReject: q.autoReject,
        rejectCondition: q.rejectCondition,
        rejectReason: q.rejectReason,
        comments: q.comments,
      }));

      const result = await appendToSection<QuestionRow>(slug, "prescreening", rows);
      return {
        content: [
          {
            type: "text" as const,
            text: `Added ${result.added.length} question(s). Total: ${result.totalCount}. Version: ${result.version}`,
          },
        ],
      };
    }
  );

  // --- Sources ---
  server.tool(
    "add_sources",
    "Append recruitment sources to a checklist. Does NOT remove existing sources.",
    {
      slug: z.string().describe("The checklist URL slug"),
      sources: z
        .array(
          z.object({
            category: z.string().describe("Source category (e.g. 'Job Board', 'Social Media', 'Referral')"),
            subcategory: z.string().describe("Specific source (e.g. 'Indeed', 'LinkedIn', 'Facebook Ads')"),
            link: z.string().optional().default("").describe("URL link to the source"),
            comments: z.string().optional().default(""),
          })
        )
        .describe("Array of sources to add"),
    },
    async ({ slug, sources }) => {
      const rows: SourceRow[] = sources.map((s) => ({
        id: uuid(),
        category: s.category,
        subcategory: s.subcategory,
        link: s.link,
        comments: s.comments,
      }));

      const result = await appendToSection<SourceRow>(slug, "sources", rows);
      return {
        content: [
          {
            type: "text" as const,
            text: `Added ${result.added.length} source(s). Total: ${result.totalCount}. Version: ${result.version}`,
          },
        ],
      };
    }
  );

  // --- Folders ---
  server.tool(
    "add_folders",
    "Append pipeline folders to a checklist. Does NOT remove existing folders.",
    {
      slug: z.string().describe("The checklist URL slug"),
      folders: z
        .array(
          z.object({
            folderName: z.string().describe("Folder name (e.g. 'Interview Scheduled', 'Assessment')"),
            description: z.string().optional().default("").describe("Folder description"),
            movementType: z.string().optional().default("").describe("Movement type (e.g. 'Manual', 'Autoflow')"),
            comments: z.string().optional().default(""),
          })
        )
        .describe("Array of folders to add"),
    },
    async ({ slug, folders }) => {
      const rows: FolderRow[] = folders.map((f) => ({
        id: uuid(),
        folderName: f.folderName,
        description: f.description,
        movementType: f.movementType,
        comments: f.comments,
      }));

      const result = await appendToSection<FolderRow>(slug, "folders", rows);
      return {
        content: [
          {
            type: "text" as const,
            text: `Added ${result.added.length} folder(s). Total: ${result.totalCount}. Version: ${result.version}`,
          },
        ],
      };
    }
  );

  // --- Message Templates ---
  server.tool(
    "add_message_templates",
    "Append message templates to a checklist. Supports email, SMS, WhatsApp, and Messenger channels. Does NOT remove existing templates.",
    {
      slug: z.string().describe("The checklist URL slug"),
      templates: z
        .array(
          z.object({
            name: z.string().describe("Template name (e.g. 'Invitation to Interview')"),
            purpose: z.string().describe("When this template is used (e.g. 'Sent after screening completion')"),
            language: z.string().optional().default("").describe("Template language (e.g. 'English', 'Filipino')"),
            folder: z.string().optional().default("").describe("Which pipeline folder triggers this template"),
            emailSubject: z.string().optional().default(""),
            emailTemplate: z.string().optional().default(""),
            emailActive: z.boolean().optional().default(false),
            smsTemplate: z.string().optional().default(""),
            smsActive: z.boolean().optional().default(false),
            whatsappTemplate: z.string().optional().default(""),
            whatsappActive: z.boolean().optional().default(false),
            messengerTemplate: z.string().optional().default(""),
            messengerActive: z.boolean().optional().default(false),
            comments: z.string().optional().default(""),
          })
        )
        .describe("Array of message templates to add"),
    },
    async ({ slug, templates }) => {
      const rows: MessagingTemplateRow[] = templates.map((t) => ({
        id: uuid(),
        name: t.name,
        purpose: t.purpose,
        language: t.language,
        folder: t.folder,
        emailSubject: t.emailSubject,
        emailTemplate: t.emailTemplate,
        emailActive: t.emailActive,
        smsTemplate: t.smsTemplate,
        smsActive: t.smsActive,
        whatsappTemplate: t.whatsappTemplate,
        whatsappActive: t.whatsappActive,
        messengerTemplate: t.messengerTemplate,
        messengerActive: t.messengerActive,
        comments: t.comments,
      }));

      const result = await appendToSection<MessagingTemplateRow>(slug, "messaging", rows);
      return {
        content: [
          {
            type: "text" as const,
            text: `Added ${result.added.length} template(s). Total: ${result.totalCount}. Version: ${result.version}`,
          },
        ],
      };
    }
  );

  server.tool(
    "delete_message_template",
    "Delete a single message template from a checklist's messaging section by its ID. Use `get_section` with section='messaging' first to retrieve template IDs, then pass the target ID here. This is permanent and cannot be undone.",
    {
      slug: z.string().describe("The checklist URL slug (e.g. 'exl', 'accenture')"),
      template_id: z.string().describe("The UUID of the message template to delete"),
    },
    async ({ slug, template_id }) => {
      try {
        const result = await removeFromSectionById<MessagingTemplateRow>(
          slug,
          "messaging",
          template_id
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `Deleted template ${result.removedId}. Remaining: ${result.totalCount}. Version: ${result.version}`,
            },
          ],
        };
      } catch (error) {
        return mcpError(error);
      }
    }
  );

  // --- Attributes ---
  server.tool(
    "add_attributes",
    "Append candidate attributes to a checklist. Auto-derives the key from the attribute name. Does NOT remove existing attributes.",
    {
      slug: z.string().describe("The checklist URL slug"),
      attributes: z
        .array(
          z.object({
            attributeName: z.string().describe("Attribute display name (e.g. 'Has BPO Experience')"),
            dataType: z.string().describe("Data type: Text, Number, Date, Boolean, URL, Email, Phone, Dropdown"),
            description: z.string().optional().default(""),
            suggestedValues: z.string().optional().default("").describe("Comma-separated suggested values"),
            addToAllFutureCandidates: z.boolean().optional().default(false),
            showAcrossApplications: z.boolean().optional().default(false),
            markDataPrivate: z.boolean().optional().default(false),
            restrictToOwners: z.boolean().optional().default(false),
            hideAttributeCompliance: z.boolean().optional().default(false),
            useSuggestedValuesOnly: z.boolean().optional().default(false),
            readOnlyMode: z.boolean().optional().default(false),
          })
        )
        .describe("Array of attributes to add"),
    },
    async ({ slug, attributes }) => {
      const rows: AttributeRow[] = attributes.map((a) => ({
        id: uuid(),
        attributeName: a.attributeName,
        key: deriveAttributeKey(a.attributeName),
        description: a.description,
        dataType: a.dataType,
        suggestedValues: a.suggestedValues,
        addToAllFutureCandidates: a.addToAllFutureCandidates,
        showAcrossApplications: a.showAcrossApplications,
        markDataPrivate: a.markDataPrivate,
        restrictToOwners: a.restrictToOwners,
        hideAttributeCompliance: a.hideAttributeCompliance,
        useSuggestedValuesOnly: a.useSuggestedValuesOnly,
        readOnlyMode: a.readOnlyMode,
      }));

      const result = await appendToSection<AttributeRow>(slug, "attributes", rows);
      return {
        content: [
          {
            type: "text" as const,
            text: `Added ${result.added.length} attribute(s). Total: ${result.totalCount}. Version: ${result.version}`,
          },
        ],
      };
    }
  );

  // --- Campaigns ---
  server.tool(
    "add_campaigns",
    "Append campaigns to a checklist. Does NOT remove existing campaigns.",
    {
      slug: z.string().describe("The checklist URL slug"),
      campaigns: z
        .array(
          z.object({
            nameInternal: z.string().describe("Internal campaign name (e.g. 'Manila - Messenger Evergreen')"),
            jobTitleExternal: z.string().describe("External-facing job title (e.g. 'Customer Service Representative')"),
            site: z.string().optional().default("").describe("Site/location for this campaign"),
            jobDescription: z.string().optional().default(""),
            googleMapsLink: z.string().optional().default(""),
            zoomLink: z.string().optional().default(""),
            comments: z.string().optional().default(""),
          })
        )
        .describe("Array of campaigns to add"),
    },
    async ({ slug, campaigns }) => {
      const rows: CampaignRow[] = campaigns.map((c) => ({
        id: uuid(),
        nameInternal: c.nameInternal,
        jobTitleExternal: c.jobTitleExternal,
        site: c.site,
        jobDescription: c.jobDescription,
        googleMapsLink: c.googleMapsLink,
        zoomLink: c.zoomLink,
        comments: c.comments,
      }));

      const result = await appendToSection<CampaignRow>(slug, "campaigns", rows);
      return {
        content: [
          {
            type: "text" as const,
            text: `Added ${result.added.length} campaign(s). Total: ${result.totalCount}. Version: ${result.version}`,
          },
        ],
      };
    }
  );

  // --- Sites ---
  server.tool(
    "add_sites",
    "Append interview sites/locations to a checklist. Does NOT remove existing sites.",
    {
      slug: z.string().describe("The checklist URL slug"),
      sites: z
        .array(
          z.object({
            siteName: z.string().describe("Site display name (e.g. 'BGC Tower 1')"),
            internalName: z.string().optional().default("").describe("Internal reference name"),
            interviewHours: z.string().optional().default("").describe("Interview schedule hours"),
            interviewType: z.string().optional().default("").describe("Type: Face-to-Face, Virtual, Hybrid"),
            fullAddress: z.string().optional().default(""),
            documentsToRing: z.string().optional().default("").describe("Documents candidates should bring"),
            googleMapsLink: z.string().optional().default(""),
            comments: z.string().optional().default(""),
          })
        )
        .describe("Array of sites to add"),
    },
    async ({ slug, sites }) => {
      const rows: SiteRow[] = sites.map((s) => ({
        id: uuid(),
        siteName: s.siteName,
        internalName: s.internalName,
        interviewHours: s.interviewHours,
        interviewType: s.interviewType,
        fullAddress: s.fullAddress,
        documentsToRing: s.documentsToRing,
        googleMapsLink: s.googleMapsLink,
        comments: s.comments,
      }));

      const result = await appendToSection<SiteRow>(slug, "sites", rows);
      return {
        content: [
          {
            type: "text" as const,
            text: `Added ${result.added.length} site(s). Total: ${result.totalCount}. Version: ${result.version}`,
          },
        ],
      };
    }
  );

  // --- Documents ---
  server.tool(
    "add_documents",
    "Append document collection requirements to a checklist. Does NOT remove existing documents.",
    {
      slug: z.string().describe("The checklist URL slug"),
      documents: z
        .array(
          z.object({
            documentName: z.string().describe("Document name (e.g. 'Government ID', 'NBI Clearance')"),
            applicableCandidates: z.string().optional().default("").describe("Who needs to submit this"),
            required: z.string().optional().default("").describe("Required or Optional"),
            blankTemplateLink: z.string().optional().default("").describe("Link to blank template"),
            applicableCampaigns: z.string().optional().default(""),
            accessPermissions: z.string().optional().default("").describe("Who can view: Full / Onboarding Admin / Owner Admin"),
            folder: z.string().optional().default("").describe("Pipeline folder where document is collected"),
            comments: z.string().optional().default(""),
          })
        )
        .describe("Array of documents to add"),
    },
    async ({ slug, documents }) => {
      const rows: DocumentRow[] = documents.map((d) => ({
        id: uuid(),
        documentName: d.documentName,
        applicableCandidates: d.applicableCandidates,
        required: d.required,
        blankTemplateLink: d.blankTemplateLink,
        applicableCampaigns: d.applicableCampaigns,
        accessPermissions: d.accessPermissions,
        folder: d.folder,
        comments: d.comments,
      }));

      const result = await appendToSection<DocumentRow>(slug, "documents", rows);
      return {
        content: [
          {
            type: "text" as const,
            text: `Added ${result.added.length} document(s). Total: ${result.totalCount}. Version: ${result.version}`,
          },
        ],
      };
    }
  );

  // --- Rejection Reasons ---
  server.tool(
    "add_rejection_reasons",
    "Append rejection reasons to a checklist. Does NOT remove existing reasons.",
    {
      slug: z.string().describe("The checklist URL slug"),
      reasons: z
        .array(z.string().describe("A rejection reason (e.g. 'Failed assessment', 'No-show')"))
        .describe("Array of rejection reason strings to add"),
    },
    async ({ slug, reasons }) => {
      const result = await appendStringsToSection(slug, "rejectionReasons", reasons);
      return {
        content: [
          {
            type: "text" as const,
            text: `Added ${result.added.length} reason(s). Total: ${result.totalCount}. Version: ${result.version}`,
          },
        ],
      };
    }
  );

  // --- Labels ---
  server.tool(
    "add_labels",
    "Append candidate labels to a checklist. Each label has a name and a hex color.",
    {
      slug: z.string().describe("The checklist URL slug"),
      labels: z
        .array(
          z.object({
            name: z.string().describe("Label name (e.g. 'Priority Candidate')"),
            color: z.string().optional().default("#6366F1").describe("Hex color string (e.g. '#FF5733')"),
          })
        )
        .describe("Array of labels to add"),
    },
    async ({ slug, labels }) => {
      const rows: LabelRow[] = labels.map((label) => ({
        id: uuid(),
        name: label.name,
        color: label.color || "#6366F1",
      }));

      const result = await appendToSection<LabelRow>(slug, "labels", rows);
      return {
        content: [
          {
            type: "text" as const,
            text: `Added ${result.added.length} label(s). Total: ${result.totalCount}. Version: ${result.version}`,
          },
        ],
      };
    }
  );

  // --- Agency Portal ---
  server.tool(
    "add_agency_portal_entries",
    "Append agency portal entries to a checklist. Does NOT remove existing agencies.",
    {
      slug: z.string().describe("The checklist URL slug"),
      agencies: z
        .array(
          z.object({
            agencyName: z.string().describe("Agency name"),
            contactName: z.string().optional().default("").describe("Primary contact person"),
            email: z.string().optional().default(""),
            phone: z.string().optional().default(""),
            country: z.string().optional().default(""),
            comments: z.string().optional().default(""),
          })
        )
        .describe("Array of agency entries to add"),
    },
    async ({ slug, agencies }) => {
      const rows: AgencyPortalRow[] = agencies.map((a) => ({
        id: uuid(),
        agencyName: a.agencyName,
        contactName: a.contactName,
        email: a.email,
        phone: a.phone,
        country: a.country,
        comments: a.comments,
      }));

      const result = await appendToSection<AgencyPortalRow>(slug, "agencyPortal", rows);
      return {
        content: [
          {
            type: "text" as const,
            text: `Added ${result.added.length} agency(ies). Total: ${result.totalCount}. Version: ${result.version}`,
          },
        ],
      };
    }
  );

  // --- Users ---
  server.tool(
    "add_users",
    "Append users to a checklist. Does NOT remove existing users.",
    {
      slug: z.string().describe("The checklist URL slug"),
      users: z
        .array(
          z.object({
            name: z.string().describe("User's full name"),
            accessType: z
              .string()
              .describe('Access level: "Owner", "Manager", or "Recruiter"'),
            email: z.string().optional().default(""),
            phone: z.string().optional().default(""),
            jobTitle: z.string().optional().default(""),
            site: z.string().optional().default("").describe("Site the user is assigned to"),
            reportsTo: z.string().optional().default("").describe("Name of the user's manager"),
            stage: z
              .string()
              .optional()
              .default("")
              .describe('Vertical or team (e.g. "Sourcing Luzon", "Healthcare", "L&A")'),
            comments: z.string().optional().default(""),
          })
        )
        .describe("Array of users to add"),
    },
    async ({ slug, users }) => {
      const rows: UserRow[] = users.map((u) => ({
        id: uuid(),
        name: u.name,
        accessType: u.accessType,
        email: u.email ?? "",
        phone: u.phone ?? "",
        jobTitle: u.jobTitle ?? "",
        site: u.site ?? "",
        reportsTo: u.reportsTo ?? "",
        stage: u.stage ?? "",
        comments: u.comments ?? "",
      }));

      const result = await appendToSection<UserRow>(slug, "users", rows);
      return {
        content: [
          {
            type: "text" as const,
            text: `Added ${result.added.length} user(s). Total: ${result.totalCount}. Version: ${result.version}`,
          },
        ],
      };
    }
  );

  // --- ATS / HRIS Integrations ---
  server.tool(
    "add_ats_trigger_rows",
    "Append trigger rows to a specific ATS integration. Use this to populate the Trigger Configuration table from the client's folder list.",
    {
      slug: z.string(),
      integrationId: z.string().describe("ID of the AtsIntegration to append to"),
      triggers: z.array(
        z.object({
          direction: z.enum(["Talkpush → ATS", "ATS → Talkpush"]),
          talkpushFolder: z.string(),
          atsObject: z.string().optional().default(""),
          action: z.string().optional().default(""),
          notes: z.string().optional().default(""),
        })
      ),
    },
    async ({ slug, integrationId, triggers }) => {
      const rows: AtsTriggerRow[] = triggers.map((trigger) => ({
        id: uuid(),
        direction: trigger.direction,
        talkpushFolder: trigger.talkpushFolder,
        atsObject: trigger.atsObject,
        action: trigger.action,
        notes: trigger.notes,
      }));

      const result = await appendToAtsIntegration<AtsTriggerRow>(
        slug,
        integrationId,
        "triggers",
        rows
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `Added ${result.added.length} ATS trigger row(s) to "${result.integrationName}". Total triggers: ${result.totalCount}. Version: ${result.version}`,
          },
        ],
      };
    }
  );

  server.tool(
    "add_ats_field_mappings",
    "Append field mapping rows to a specific ATS integration. Use this to populate the Field Mapping table from the client's attribute list.",
    {
      slug: z.string(),
      integrationId: z.string(),
      fieldMappings: z.array(
        z.object({
          talkpushAttribute: z.string().describe("Exact attribute key, e.g. 'first_name'"),
          atsField: z.string().optional().default(""),
          dataType: z.string().optional().default(""),
          direction: z
            .enum(["Talkpush → ATS", "ATS → Talkpush", "Bidirectional"])
            .optional()
            .default("Talkpush → ATS"),
          notes: z.string().optional().default(""),
        })
      ),
    },
    async ({ slug, integrationId, fieldMappings }) => {
      const rows: AtsFieldMappingRow[] = fieldMappings.map((mapping) => ({
        id: uuid(),
        talkpushAttribute: mapping.talkpushAttribute,
        atsField: mapping.atsField,
        dataType: mapping.dataType,
        direction: mapping.direction,
        notes: mapping.notes,
      }));

      const result = await appendToAtsIntegration<AtsFieldMappingRow>(
        slug,
        integrationId,
        "fieldMappings",
        rows
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `Added ${result.added.length} ATS field mapping row(s) to "${result.integrationName}". Total mappings: ${result.totalCount}. Version: ${result.version}`,
          },
        ],
      };
    }
  );

  // --- Integrations ---
  server.tool(
    "add_integrations",
    "Append one or more integration action rows to the Integrations tab. Each row represents a single integration action (outbound POST, inbound attribute update, etc.) for a vendor. A single vendor with multiple actions should be passed as multiple rows.",
    {
      token: z.string().describe("Editor token for the target checklist"),
      rows: z.array(integrationRowSchema).describe("Integration action rows to append"),
    },
    async ({ token, rows }) => {
      const integrationRows: IntegrationRow[] = rows.map((row) => ({
        id: uuid(),
        vendorName: row.vendorName,
        vendorCategory: (row.vendorCategory ?? "") as IntegrationCategory | "",
        actionType: (row.actionType ?? "") as IntegrationActionType | "",
        triggerFolder: row.triggerFolder ?? "",
        status: (row.status ?? "") as IntegrationStatus | "",
        vendorContactName: row.vendorContactName ?? "",
        vendorContactEmail: row.vendorContactEmail ?? "",
        vendorDocsUrl: row.vendorDocsUrl ?? "",
        notes: row.notes ?? "",
        endpointUrl: row.endpointUrl ?? "",
        authMethod: (row.authMethod ?? "none") as IntegrationAuthMethod,
        authParamName: row.authParamName ?? "",
        authValue: row.authValue ?? "",
        outboundPayloadMapping: (row.outboundPayloadMapping ?? []).map((mapping) => ({
          id: uuid(),
          talkpushSource: mapping.talkpushSource ?? "",
          vendorFieldName: mapping.vendorFieldName ?? "",
          required: !!mapping.required,
        })) as IntegrationPayloadMapping[],
        responseHandling: (row.responseHandling ?? []).map((mapping) => ({
          id: uuid(),
          vendorResponseField: mapping.vendorResponseField ?? "",
          targetAttribute: mapping.targetAttribute ?? "",
        })) as IntegrationResponseMapping[],
        inboundAttributeMapping: (row.inboundAttributeMapping ?? []).map((mapping) => ({
          id: uuid(),
          vendorCallbackField: mapping.vendorCallbackField ?? "",
          targetAttribute: mapping.targetAttribute ?? "",
        })) as IntegrationAttributeMapping[],
        matchKey: (row.matchKey ?? "") as IntegrationMatchKey | "",
        documentTag: row.documentTag ?? "",
        targetFolder: row.targetFolder ?? "",
        filterCriteria: row.filterCriteria ?? "",
        talkpushApiBaseUrl: row.talkpushApiBaseUrl ?? "",
        apiEnvironment: (row.apiEnvironment ?? "") as IntegrationApiEnvironment | "",
        inboundAuthMethod: (row.inboundAuthMethod ?? "") as IntegrationAuthMethod | "",
        inboundAuthParamName: row.inboundAuthParamName ?? "",
        inboundAuthValue: row.inboundAuthValue ?? "",
        campaignScope: (row.campaignScope ?? "") as IntegrationCampaignScope | "",
        campaignIds: row.campaignIds ?? "",
        campaignNames: row.campaignNames ?? "",
        candidateIdSource: (row.candidateIdSource ?? "") as IntegrationCandidateIdSource | "",
        candidateIdFieldName: row.candidateIdFieldName ?? "",
        lookupQueryParams: row.lookupQueryParams ?? "",
        multiMatchBehavior: (row.multiMatchBehavior ?? "") as IntegrationMultiMatchBehavior | "",
        sampleRequest: row.sampleRequest ?? "",
        sampleSuccessResponse: row.sampleSuccessResponse ?? "",
        sampleErrorResponse: row.sampleErrorResponse ?? "",
        rateLimitNotes: row.rateLimitNotes ?? "",
        retryTimeoutNotes: row.retryTimeoutNotes ?? "",
        idempotencyNotes: row.idempotencyNotes ?? "",
        uatTestCandidate: row.uatTestCandidate ?? "",
        expectedTalkpushResult: row.expectedTalkpushResult ?? "",
      }));

      const result = await appendToSectionByEditorToken<IntegrationRow>(
        token,
        "integrations",
        integrationRows
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `Added ${result.added.length} integration row(s). Total: ${result.totalCount}. Version: ${result.version}`,
          },
        ],
      };
    }
  );

  // =========================================================================
  // CUSTOM TAB TOOLS
  // =========================================================================

  // Fixed slugs that custom tabs must not collide with
  const FIXED_SLUGS = new Set(TAB_CONFIG.map((t) => t.slug));

  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function isSlugAvailable(slug: string, existingTabs: CustomTab[]): boolean {
    if (FIXED_SLUGS.has(slug)) return false;
    return !existingTabs.some((t) => t.slug === slug);
  }

  type CustomTabFilledBy = "talkpush" | "client";

  interface CustomTabMutationContext {
    tabs: CustomTab[];
    tabOrder: string[] | null;
    tabFilledBy: Record<string, CustomTabFilledBy> | null;
  }

  interface CustomTabMutationOutcome {
    tabs: CustomTab[];
    result: Record<string, unknown>;
    /** Full replacement sidebar order. Omit to leave the stored order alone. */
    tabOrder?: string[] | null;
    /** Full replacement filled-by map. Omit to leave the stored map alone. */
    tabFilledBy?: Record<string, CustomTabFilledBy> | null;
  }

  /**
   * Read + write a checklist's custom tabs inside a transaction with a
   * row-level lock to prevent race conditions.
   *
   * A tab's position and its filled-by flag live outside `customTabs` (in
   * `tabOrder` / `tabFilledBy`), so the mutator can return those too and they
   * are written in the same transaction — otherwise creating a Talkpush-only
   * tab would briefly expose it to the client between two writes.
   */
  async function mutateCustomTabs(
    slug: string,
    mutator: (ctx: CustomTabMutationContext) => CustomTabMutationOutcome
  ): Promise<{ result: Record<string, unknown>; version: number }> {
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ id: string; version: number; fieldVersions: Record<string, number> | null }>
      >`SELECT id, version, "fieldVersions" FROM "Checklist" WHERE slug = ${slug} FOR UPDATE`;

      const current = locked[0];
      if (!current) throw new Error(`Checklist with slug "${slug}" not found`);

      const checklist = await tx.checklist.findUnique({
        where: { id: current.id },
        select: { customTabs: true, tabOrder: true, tabFilledBy: true },
      });

      const outcome = mutator({
        tabs: (checklist?.customTabs ?? []) as unknown as CustomTab[],
        tabOrder: (checklist?.tabOrder ?? null) as string[] | null,
        tabFilledBy: (checklist?.tabFilledBy ?? null) as Record<string, CustomTabFilledBy> | null,
      });

      const newVersion = current.version + 1;
      const fieldVersions: Record<string, number> = {
        ...(current.fieldVersions ?? {}),
        customTabs: newVersion,
      };

      const data: Prisma.ChecklistUpdateInput = {
        customTabs: toPrismaJson(JSON.parse(JSON.stringify(outcome.tabs))),
        version: newVersion,
      };

      if (outcome.tabOrder !== undefined) {
        data.tabOrder = toPrismaJson(outcome.tabOrder ?? []);
        fieldVersions.tabOrder = newVersion;
      }
      if (outcome.tabFilledBy !== undefined) {
        data.tabFilledBy = toPrismaJson(outcome.tabFilledBy ?? {});
        fieldVersions.tabFilledBy = newVersion;
      }
      data.fieldVersions = toPrismaJson(fieldVersions);

      await tx.checklist.update({ where: { id: current.id }, data });

      return { result: outcome.result, version: newVersion };
    });
  }

  /**
   * The sidebar order of every tab, standard and custom.
   *
   * `tabOrder` may be null (natural order) or hold a stale list from before a
   * tab existed, so the stored list is only used to sort the current full set
   * rather than trusted as the set itself.
   */
  function buildFullTabOrder(
    storedOrder: string[] | null,
    tabs: CustomTab[]
  ): string[] {
    const all = [
      ...TAB_CONFIG.map((t) => t.slug),
      ...tabs.map((t) => `custom-${t.slug}`),
    ];
    if (!storedOrder || storedOrder.length === 0) return all;
    const rank = new Map(storedOrder.map((slug, i) => [slug, i]));
    return all
      .map((slug, i) => ({ slug, rank: rank.get(slug) ?? Infinity, i }))
      .sort((a, b) => a.rank - b.rank || a.i - b.i)
      .map((entry) => entry.slug);
  }

  /** Moves `slug` to sit directly after `placeAfter` in the sidebar. */
  function placeTabAfter(
    storedOrder: string[] | null,
    tabs: CustomTab[],
    slug: string,
    placeAfter: string
  ): string[] {
    const order = buildFullTabOrder(storedOrder, tabs);
    const target = placeAfter.trim();
    const targetIndex = order.indexOf(target);
    if (targetIndex === -1) {
      throw new CustomTabError(
        `Can't place the tab after "${target}" — no such tab. Valid values: ${order.join(", ")}.`
      );
    }
    const without = order.filter((entry) => entry !== slug);
    const insertAt = without.indexOf(target) + 1;
    without.splice(insertAt, 0, slug);
    return without;
  }

  /** Turns a service-layer validation failure into a readable tool error. */
  function customTabToolError(error: unknown) {
    if (error instanceof CustomTabError) {
      return {
        content: [{ type: "text" as const, text: error.message }],
        isError: true as const,
      };
    }
    throw error;
  }

  /** Shared zod shape for a column definition across the custom-tab tools. */
  const customTabColumnSchema = z.object({
    key: z
      .string()
      .optional()
      .describe("Unique snake_case identifier. Derived from the label when omitted."),
    label: z.string().describe("Column header shown to whoever fills the tab in"),
    type: z
      .enum(CUSTOM_TAB_COLUMN_TYPES)
      .describe(
        "Column data type. 'select'/'multiselect' require options; multiselect cells are stored comma-joined."
      ),
    required: z.boolean().optional().default(false),
    options: z
      .array(z.string())
      .optional()
      .describe("Choices — required for type 'select' and 'multiselect'."),
    description: z
      .string()
      .optional()
      .describe(
        "Help text shown in the column-header tooltip. Use this for the instruction the client would otherwise need emailed to them."
      ),
    example: z.string().optional().describe("Sample value shown as the cell placeholder"),
    width: z.number().optional().describe("Starting column width in pixels"),
  });

  const filledBySchema = z
    .enum(["client", "talkpush"])
    .optional()
    .describe(
      "Who fills this tab in. 'talkpush' hides it from the client-facing checklist (still visible in the editor and admin views). Defaults to 'client'."
    );

  const placeAfterSchema = z
    .string()
    .optional()
    .describe(
      "Slug of the tab this one should sit after in the sidebar, e.g. 'documents' or 'custom-pre-boarding'. Defaults to last."
    );

  // --- add_custom_tab ---
  server.tool(
    "add_custom_tab",
    "Create a custom table tab on a checklist: column definitions, per-column help text, and optional starting rows. " +
      "Use this when the standard tabs don't fit what a client needs to give us, instead of forcing the data into an unrelated tab. " +
      "Call preview_custom_tab first to confirm the shape with the user — this tool writes immediately and the tab becomes visible to the client (unless filled_by is 'talkpush').",
    {
      slug: z.string().describe("The checklist URL slug"),
      tab_name: z.string().describe("Display name for the tab (e.g. 'Pre-boarding Documents')"),
      tab_description: z
        .string()
        .optional()
        .describe(
          "One or two sentences on what the tab is for, shown next to the title. Without it the client opens a bare grid with no explanation."
        ),
      tab_icon: z.string().optional().default("Table").describe("Lucide icon name (default: 'Table')"),
      filled_by: filledBySchema,
      place_after: placeAfterSchema,
      columns: z.array(customTabColumnSchema).describe("Column definitions for the tab table"),
      rows: z
        .array(z.record(z.string(), z.unknown()))
        .optional()
        .default([])
        .describe("Optional starting rows (each row is a key→value object matching column keys)"),
    },
    async ({ slug, tab_name, tab_description, tab_icon, filled_by, place_after, columns, rows }) => {
      try {
        const tabSlug = generateSlug(tab_name);
        if (!tabSlug) {
          throw new CustomTabError(
            `"${tab_name}" doesn't produce a usable tab slug. Use a name with letters or numbers in it.`
          );
        }

        const { columns: tabColumns, warnings: columnWarnings } = normalizeColumns(
          columns as ColumnSpec[]
        );
        const { rows: tabRows, warnings: rowWarnings } = normalizeRows(
          tabColumns,
          (rows ?? []) as Array<Record<string, unknown>>,
          { makeId: uuid }
        );

        const { result, version } = await mutateCustomTabs(slug, (ctx) => {
          if (!isSlugAvailable(tabSlug, ctx.tabs)) {
            throw new CustomTabError(
              `Slug "${tabSlug}" is already in use by another tab. Choose a different tab name.`
            );
          }

          const newTab: CustomTab = {
            id: `ct_${uuid()}`,
            slug: tabSlug,
            label: tab_name,
            ...(tab_description?.trim() ? { description: tab_description.trim() } : {}),
            icon: tab_icon || "Table",
            fields: [], // empty — this is a table-based tab
            columns: tabColumns,
            rows: tabRows,
            uploadedFile: null,
            sortOrder: ctx.tabs.length,
            createdAt: new Date().toISOString(),
          };

          const nextTabs = [...ctx.tabs, newTab];
          const urlSlug = `custom-${tabSlug}`;

          const outcome: CustomTabMutationOutcome = {
            tabs: nextTabs,
            result: {
              id: newTab.id,
              slug: tabSlug,
              url_slug: urlSlug,
              columnCount: tabColumns.length,
              rowCount: tabRows.length,
            },
          };

          if (filled_by) {
            outcome.tabFilledBy = { ...(ctx.tabFilledBy ?? {}), [urlSlug]: filled_by };
          }
          if (place_after) {
            outcome.tabOrder = placeTabAfter(ctx.tabOrder, nextTabs, urlSlug, place_after);
          }

          return outcome;
        });

        const notes = [...columnWarnings, ...rowWarnings];
        const text = [
          `Created custom tab "${tab_name}" on ${slug}.`,
          ``,
          `- id: ${result.id}`,
          `- tab URL: /client/${slug}/${result.url_slug}`,
          `- filled by: ${filled_by ?? "client"}${filled_by === "talkpush" ? " (hidden from the client view)" : ""}`,
          `- ${result.columnCount} column(s), ${result.rowCount} starting row(s)`,
          `- checklist version: ${version}`,
          ``,
          describeColumns(tabColumns),
          ...(notes.length > 0 ? ["", "Notes:", ...notes.map((n) => `- ${n}`)] : []),
        ].join("\n");

        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return customTabToolError(error);
      }
    }
  );

  // --- update_custom_tab ---
  server.tool(
    "update_custom_tab",
    "Update an existing custom tab's name, description, icon, columns, sidebar position, or who fills it in. " +
      "Columns are a full replacement — cell values under a removed column stay in storage but stop rendering, so removals are reported back. " +
      "Use edit_custom_tab_rows to change row data.",
    {
      slug: z.string().describe("The checklist URL slug"),
      tab_id: z.string().describe("The custom tab ID (e.g. 'ct_abc123')"),
      tab_name: z.string().optional().describe("New display name for the tab"),
      tab_description: z
        .string()
        .optional()
        .describe("New description. Pass an empty string to clear it."),
      tab_icon: z.string().optional().describe("New Lucide icon name"),
      filled_by: filledBySchema,
      place_after: placeAfterSchema,
      columns: z
        .array(customTabColumnSchema)
        .optional()
        .describe("Full replacement of column definitions (omit to keep existing columns)"),
    },
    async ({ slug, tab_id, tab_name, tab_description, tab_icon, filled_by, place_after, columns }) => {
      try {
        const normalized = columns
          ? normalizeColumns(columns as ColumnSpec[])
          : null;

        const { result, version } = await mutateCustomTabs(slug, (ctx) => {
          const idx = ctx.tabs.findIndex((t) => t.id === tab_id);
          if (idx === -1) {
            throw new CustomTabError(
              `Custom tab with id "${tab_id}" not found on ${slug}. Use list_custom_tabs to see the ids.`
            );
          }

          const existing = ctx.tabs[idx];
          const previousColumns = existing.columns ?? [];

          // Slug collision check if renaming. The slug itself is kept so that
          // bookmarked tab URLs stay valid across a rename.
          let newLabel = existing.label;
          if (tab_name && tab_name !== existing.label) {
            newLabel = tab_name;
          }

          let description = existing.description;
          if (tab_description !== undefined) {
            const trimmed = tab_description.trim();
            description = trimmed === "" ? undefined : trimmed;
          }

          const nextColumns = normalized ? normalized.columns : existing.columns;

          const droppedKeys = normalized
            ? previousColumns
                .map((column) => column.key)
                .filter((key) => !normalized.columns.some((column) => column.key === key))
                .filter((key) => (existing.rows ?? []).some((row) => {
                  const value = row[key];
                  return value !== "" && value !== false && value != null;
                }))
            : [];

          const updatedTab: CustomTab = {
            ...existing,
            label: newLabel,
            icon: tab_icon ?? existing.icon,
            columns: nextColumns,
          };
          if (description) updatedTab.description = description;
          else delete updatedTab.description;

          const nextTabs = [...ctx.tabs];
          nextTabs[idx] = updatedTab;
          const urlSlug = `custom-${updatedTab.slug}`;

          const outcome: CustomTabMutationOutcome = {
            tabs: nextTabs,
            result: {
              id: updatedTab.id,
              slug: updatedTab.slug,
              url_slug: urlSlug,
              label: updatedTab.label,
              columnCount: (nextColumns ?? []).length,
              droppedKeys,
            },
          };

          if (filled_by) {
            outcome.tabFilledBy = { ...(ctx.tabFilledBy ?? {}), [urlSlug]: filled_by };
          }
          if (place_after) {
            outcome.tabOrder = placeTabAfter(ctx.tabOrder, nextTabs, urlSlug, place_after);
          }

          return outcome;
        });

        const dropped = result.droppedKeys as string[];
        const text = [
          `Updated custom tab "${result.label}" (${result.id}) on ${slug}.`,
          `- tab URL: /client/${slug}/${result.url_slug}`,
          `- ${result.columnCount} column(s)`,
          ...(filled_by ? [`- filled by: ${filled_by}`] : []),
          ...(place_after ? [`- moved after: ${place_after}`] : []),
          `- checklist version: ${version}`,
          ...(dropped.length > 0
            ? [
                ``,
                `Heads up: ${dropped.length} removed column(s) still hold data that will no longer render — ${dropped.join(", ")}. Re-add the column to see those values again.`,
              ]
            : []),
          ...(normalized && normalized.warnings.length > 0
            ? ["", "Notes:", ...normalized.warnings.map((n) => `- ${n}`)]
            : []),
        ].join("\n");

        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return customTabToolError(error);
      }
    }
  );

  // --- delete_custom_tab ---
  server.tool(
    "delete_custom_tab",
    "Remove a custom tab and all its data from a checklist. This is permanent — create_snapshot first if the rows matter.",
    {
      slug: z.string().describe("The checklist URL slug"),
      tab_id: z.string().describe("The custom tab ID to delete (e.g. 'ct_abc123')"),
    },
    async ({ slug, tab_id }) => {
      try {
        const { result, version } = await mutateCustomTabs(slug, (ctx) => {
          const tab = ctx.tabs.find((t) => t.id === tab_id);
          if (!tab) {
            throw new CustomTabError(
              `Custom tab with id "${tab_id}" not found on ${slug}. Use list_custom_tabs to see the ids.`
            );
          }

          const urlSlug = `custom-${tab.slug}`;
          const nextTabs = ctx.tabs.filter((t) => t.id !== tab_id);

          // Leave no orphan entries pointing at a tab that no longer exists.
          const nextFilledBy = { ...(ctx.tabFilledBy ?? {}) };
          const hadFilledBy = urlSlug in nextFilledBy;
          delete nextFilledBy[urlSlug];

          const hadOrder = !!ctx.tabOrder?.includes(urlSlug);

          return {
            tabs: nextTabs,
            result: { label: tab.label, slug: tab.slug, rowCount: (tab.rows ?? []).length },
            ...(hadFilledBy ? { tabFilledBy: nextFilledBy } : {}),
            ...(hadOrder
              ? { tabOrder: (ctx.tabOrder ?? []).filter((entry) => entry !== urlSlug) }
              : {}),
          };
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Deleted custom tab "${result.label}" (slug: custom-${result.slug}) and its ${result.rowCount} row(s) from ${slug}. Version: ${version}`,
            },
          ],
        };
      } catch (error) {
        return customTabToolError(error);
      }
    }
  );

  // --- design_custom_tab (prompt) ---
  //
  // The interview, not a tool. The standard tabs don't fit every
  // implementation, and the failure mode when an SE asks for a custom tab is a
  // model that guesses the columns and writes them straight to a live client
  // checklist. This makes the questions explicit and puts the preview step
  // before the write.
  server.prompt(
    "design_custom_tab",
    "Interview the user about a new custom checklist tab, then build it once they approve.",
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              "I want to add a custom tab to a CRM config checklist. Custom tabs exist because the standard tabs don't fit every implementation — don't try to bend my requirement into an existing tab.",
              "",
              "Work through this in order:",
              "",
              "1. Ask me these, in one message, and wait for my answers:",
              "   - Which checklist (client name or slug)? Use list_checklists if I'm vague.",
              "   - What is this tab collecting, in plain terms?",
              "   - What does ONE ROW represent? (one document, one site, one shift, one approver…)",
              "   - Who fills it in: the client, or Talkpush internally?",
              "",
              "2. Propose the columns yourself based on my answers — don't ask me to list them. For each column give a label, a type (text, textarea, number, date, select, multiselect, email, url, checkbox), whether it's required, dropdown options where it's a choice, and one line of help text aimed at whoever fills it in. Add an example value for any column where the expected format isn't obvious.",
              "",
              "3. Call preview_custom_tab with your proposal, including 2-3 realistic sample rows. Show me the rendered table. Nothing is written at this step.",
              "",
              "4. Let me iterate. Re-run preview_custom_tab after each change. Do NOT call add_custom_tab until I explicitly approve.",
              "",
              "5. On my approval, call add_custom_tab with the approved shape — set filled_by from my answer, and place_after if I said where it should sit. Then tell me the tab URL and whether the client can see it yet.",
              "",
              "Two rules: don't invent dropdown options I didn't agree to, and if a tab like this already exists on another client's checklist, offer clone_custom_tab instead of rebuilding it from scratch.",
            ].join("\n"),
          },
        },
      ],
    })
  );

  // --- list_custom_tabs ---
  server.tool(
    "list_custom_tabs",
    "List a checklist's custom tabs with their ids, column keys, row counts, position and who fills them in. " +
      "Use this before update_custom_tab, edit_custom_tab_rows or clone_custom_tab — it returns the ids and column keys those tools need, without pulling the whole checklist.",
    {
      slug: z.string().describe("The checklist URL slug"),
      include_rows: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include every row's data. Off by default to keep the response small."),
    },
    async ({ slug, include_rows }) => {
      const checklist = await prisma.checklist.findUnique({
        where: { slug },
        select: { customTabs: true, tabOrder: true, tabFilledBy: true, customData: true },
      });

      if (!checklist) {
        return {
          content: [{ type: "text" as const, text: `Checklist with slug "${slug}" not found` }],
          isError: true,
        };
      }

      const tabs = (checklist.customTabs ?? []) as unknown as CustomTab[];
      if (tabs.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `${slug} has no custom tabs yet. Use preview_custom_tab to design one, then add_custom_tab to create it.`,
            },
          ],
        };
      }

      const filledBy = (checklist.tabFilledBy ?? {}) as Record<string, string>;
      const order = (checklist.tabOrder ?? []) as string[];
      const customData = (checklist.customData ?? null) as CustomData | null;

      const payload = tabs.map((tab) => {
        const urlSlug = `custom-${tab.slug}`;
        return {
          ...summarizeTab(tab),
          filledBy: filledBy[urlSlug] ?? "client",
          sidebarPosition: order.indexOf(urlSlug) === -1 ? null : order.indexOf(urlSlug),
          status: getCustomTabSectionState(tab, customData),
          ...(include_rows ? { rows: tab.rows ?? [] } : {}),
        };
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
      };
    }
  );

  // --- preview_custom_tab ---
  server.tool(
    "preview_custom_tab",
    "Validate a proposed custom tab and render it as a table WITHOUT writing anything. " +
      "Use this to agree the shape with the user before calling add_custom_tab: it reports column problems, bad dropdown values and slug collisions, and shows what the tab will look like. Nothing is saved.",
    {
      slug: z
        .string()
        .optional()
        .describe("Checklist slug to check the tab name against for collisions. Optional."),
      tab_name: z.string().describe("Proposed display name for the tab"),
      tab_description: z.string().optional().describe("Proposed description"),
      columns: z.array(customTabColumnSchema).describe("Proposed column definitions"),
      rows: z
        .array(z.record(z.string(), z.unknown()))
        .optional()
        .default([])
        .describe("Proposed starting rows"),
    },
    async ({ slug, tab_name, tab_description, columns, rows }) => {
      try {
        const tabSlug = generateSlug(tab_name);
        const { columns: tabColumns, warnings: columnWarnings } = normalizeColumns(
          columns as ColumnSpec[]
        );
        const { rows: tabRows, warnings: rowWarnings } = normalizeRows(
          tabColumns,
          (rows ?? []) as Array<Record<string, unknown>>,
          { makeId: uuid }
        );

        const collisions: string[] = [];
        if (!tabSlug) {
          collisions.push(
            `"${tab_name}" doesn't produce a usable tab slug — use a name with letters or numbers.`
          );
        }
        if (slug) {
          const checklist = await prisma.checklist.findUnique({
            where: { slug },
            select: { customTabs: true },
          });
          if (!checklist) {
            collisions.push(`Checklist "${slug}" not found — the name couldn't be checked.`);
          } else {
            const existing = (checklist.customTabs ?? []) as unknown as CustomTab[];
            if (tabSlug && !isSlugAvailable(tabSlug, existing)) {
              collisions.push(
                `Slug "${tabSlug}" is already taken on ${slug} — pick a different tab name.`
              );
            }
          }
        }

        const notes = [...columnWarnings, ...rowWarnings];
        const text = [
          `Preview only — nothing has been saved.`,
          ``,
          `**${tab_name}**${tabSlug ? ` (would live at custom-${tabSlug})` : ""}`,
          ...(tab_description ? [tab_description] : []),
          ``,
          describeColumns(tabColumns),
          ``,
          renderPreviewTable(tabColumns, tabRows),
          ...(collisions.length > 0 ? ["", "Blocking:", ...collisions.map((c) => `- ${c}`)] : []),
          ...(notes.length > 0 ? ["", "Notes:", ...notes.map((n) => `- ${n}`)] : []),
          ``,
          collisions.length > 0
            ? `Fix the blocking item(s) above before creating this tab.`
            : `Looks valid. Confirm with the user, then call add_custom_tab with the same arguments to create it.`,
        ].join("\n");

        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return customTabToolError(error);
      }
    }
  );

  // --- edit_custom_tab_rows ---
  server.tool(
    "edit_custom_tab_rows",
    "Add, replace, update or delete rows on an existing custom table tab. " +
      "Modes: 'append' adds rows; 'replace' swaps the entire row list (destructive); 'update' patches named rows by id, leaving unnamed columns untouched; 'delete' removes rows by id. " +
      "Cell values are validated against the column types, so a value that isn't one of a dropdown's options comes back as an error rather than a blank cell. Use list_custom_tabs with include_rows=true to get row ids.",
    {
      slug: z.string().describe("The checklist URL slug"),
      tab_id: z.string().describe("The custom tab ID (e.g. 'ct_abc123')"),
      mode: z
        .enum(["append", "replace", "update", "delete"])
        .describe("What to do with the rows supplied"),
      rows: z
        .array(z.record(z.string(), z.unknown()))
        .optional()
        .describe(
          "Rows for append/replace/update. For 'update' each row must include its `id`; only the keys you pass are changed."
        ),
      row_ids: z
        .array(z.string())
        .optional()
        .describe("Row ids to remove — for mode 'delete'."),
      confirm_replace: z
        .boolean()
        .optional()
        .default(false)
        .describe("Required for mode 'replace', which discards every existing row."),
    },
    async ({ slug, tab_id, mode, rows, row_ids, confirm_replace }) => {
      try {
        const { result, version } = await mutateCustomTabs(slug, (ctx) => {
          const idx = ctx.tabs.findIndex((t) => t.id === tab_id);
          if (idx === -1) {
            throw new CustomTabError(
              `Custom tab with id "${tab_id}" not found on ${slug}. Use list_custom_tabs to see the ids.`
            );
          }

          const tab = ctx.tabs[idx];
          const columns = assertTableTab(tab);
          const existingRows = (tab.rows ?? []) as CustomTabRow[];
          const supplied = (rows ?? []) as Array<Record<string, unknown>>;

          let nextRows: CustomTabRow[];
          const warnings: string[] = [];
          let changed = 0;

          if (mode === "append") {
            if (supplied.length === 0) {
              throw new CustomTabError("Mode 'append' needs at least one row in `rows`.");
            }
            const normalized = normalizeRows(columns, supplied, {
              makeId: uuid,
              rowOffset: existingRows.length + 1,
            });
            warnings.push(...normalized.warnings);
            nextRows = [...existingRows, ...normalized.rows];
            changed = normalized.rows.length;
          } else if (mode === "replace") {
            if (!confirm_replace) {
              throw new CustomTabError(
                `Mode 'replace' discards all ${existingRows.length} existing row(s) on "${tab.label}". Re-run with confirm_replace=true once the user has agreed, or use mode 'append'.`
              );
            }
            const normalized = normalizeRows(columns, supplied, { makeId: uuid });
            warnings.push(...normalized.warnings);
            nextRows = normalized.rows;
            changed = normalized.rows.length;
          } else if (mode === "update") {
            if (supplied.length === 0) {
              throw new CustomTabError("Mode 'update' needs at least one row in `rows`.");
            }
            const missingId = supplied.findIndex(
              (row) => typeof row.id !== "string" || !row.id.trim()
            );
            if (missingId !== -1) {
              throw new CustomTabError(
                `Row ${missingId + 1} has no \`id\`. Mode 'update' patches rows by id — get them from list_custom_tabs with include_rows=true.`
              );
            }

            const byId = new Map(existingRows.map((row) => [row.id, row]));
            const unknownIds = supplied
              .map((row) => String(row.id))
              .filter((id) => !byId.has(id));
            if (unknownIds.length > 0) {
              throw new CustomTabError(
                `No row(s) with id ${unknownIds.map((id) => `"${id}"`).join(", ")} on "${tab.label}".`
              );
            }

            const patched = normalizeRows(columns, supplied, {
              makeId: uuid,
              preserveIds: true,
              partial: true,
            });
            warnings.push(...patched.warnings);

            const patchById = new Map(patched.rows.map((row) => [row.id, row]));
            nextRows = existingRows.map((row) => {
              const patch = patchById.get(row.id);
              return patch ? { ...row, ...patch } : row;
            });
            changed = patchById.size;
          } else {
            const ids = (row_ids ?? []).map((id) => id.trim()).filter(Boolean);
            if (ids.length === 0) {
              throw new CustomTabError("Mode 'delete' needs at least one id in `row_ids`.");
            }
            const present = new Set(existingRows.map((row) => row.id));
            const unknownIds = ids.filter((id) => !present.has(id));
            if (unknownIds.length > 0) {
              throw new CustomTabError(
                `No row(s) with id ${unknownIds.map((id) => `"${id}"`).join(", ")} on "${tab.label}".`
              );
            }
            const removing = new Set(ids);
            nextRows = existingRows.filter((row) => !removing.has(row.id));
            changed = existingRows.length - nextRows.length;
          }

          const nextTabs = [...ctx.tabs];
          nextTabs[idx] = { ...tab, rows: nextRows };

          return {
            tabs: nextTabs,
            result: {
              label: tab.label,
              changed,
              totalRows: nextRows.length,
              warnings,
              preview: renderPreviewTable(columns, nextRows),
            },
          };
        });

        const warnings = result.warnings as string[];
        const text = [
          `${mode} on "${result.label}" (${slug}): ${result.changed} row(s) affected, ${result.totalRows} row(s) total. Version: ${version}`,
          ``,
          result.preview as string,
          ...(warnings.length > 0 ? ["", "Notes:", ...warnings.map((n) => `- ${n}`)] : []),
        ].join("\n");

        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return customTabToolError(error);
      }
    }
  );

  // --- clone_custom_tab ---
  server.tool(
    "clone_custom_tab",
    "Copy a custom tab's structure (columns, help text, description, icon) from one checklist to another. " +
      "Rows are left out unless include_rows is true, so a tab designed for one client can be reused as a starting point for the next without carrying their data across.",
    {
      from_slug: z.string().describe("Checklist slug to copy the tab from"),
      tab_id: z.string().describe("The custom tab ID on the source checklist"),
      to_slug: z.string().describe("Checklist slug to copy the tab into"),
      tab_name: z
        .string()
        .optional()
        .describe("New display name on the target. Defaults to the source tab's name."),
      include_rows: z
        .boolean()
        .optional()
        .default(false)
        .describe("Copy the source tab's row data too. Off by default — rows are usually client-specific."),
      filled_by: filledBySchema,
      place_after: placeAfterSchema,
    },
    async ({ from_slug, tab_id, to_slug, tab_name, include_rows, filled_by, place_after }) => {
      try {
        const source = await prisma.checklist.findUnique({
          where: { slug: from_slug },
          select: { customTabs: true },
        });
        if (!source) {
          throw new CustomTabError(`Source checklist "${from_slug}" not found.`);
        }

        const sourceTabs = (source.customTabs ?? []) as unknown as CustomTab[];
        const sourceTab = sourceTabs.find((t) => t.id === tab_id);
        if (!sourceTab) {
          throw new CustomTabError(
            `Custom tab with id "${tab_id}" not found on ${from_slug}. Use list_custom_tabs to see the ids.`
          );
        }
        const sourceColumns = assertTableTab(sourceTab);

        const label = (tab_name ?? sourceTab.label).trim();
        const tabSlug = generateSlug(label);
        if (!tabSlug) {
          throw new CustomTabError(
            `"${label}" doesn't produce a usable tab slug. Pass a different tab_name.`
          );
        }

        const clonedRows: CustomTabRow[] = include_rows
          ? (sourceTab.rows ?? []).map((row) => ({ ...row, id: uuid() }))
          : [];

        const { result, version } = await mutateCustomTabs(to_slug, (ctx) => {
          if (!isSlugAvailable(tabSlug, ctx.tabs)) {
            throw new CustomTabError(
              `Slug "${tabSlug}" is already in use on ${to_slug}. Pass a different tab_name.`
            );
          }

          const newTab: CustomTab = {
            id: `ct_${uuid()}`,
            slug: tabSlug,
            label,
            ...(sourceTab.description ? { description: sourceTab.description } : {}),
            icon: sourceTab.icon || "Table",
            fields: [],
            columns: sourceColumns.map((column) => ({ ...column })),
            rows: clonedRows,
            uploadedFile: null,
            sortOrder: ctx.tabs.length,
            createdAt: new Date().toISOString(),
          };

          const nextTabs = [...ctx.tabs, newTab];
          const urlSlug = `custom-${tabSlug}`;

          const outcome: CustomTabMutationOutcome = {
            tabs: nextTabs,
            result: {
              id: newTab.id,
              url_slug: urlSlug,
              label,
              columnCount: sourceColumns.length,
              rowCount: clonedRows.length,
            },
          };

          if (filled_by) {
            outcome.tabFilledBy = { ...(ctx.tabFilledBy ?? {}), [urlSlug]: filled_by };
          }
          if (place_after) {
            outcome.tabOrder = placeTabAfter(ctx.tabOrder, nextTabs, urlSlug, place_after);
          }

          return outcome;
        });

        const text = [
          `Cloned "${sourceTab.label}" from ${from_slug} to ${to_slug} as "${result.label}".`,
          `- id: ${result.id}`,
          `- tab URL: /client/${to_slug}/${result.url_slug}`,
          `- ${result.columnCount} column(s), ${result.rowCount} row(s) copied`,
          `- checklist version: ${version}`,
        ].join("\n");

        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return customTabToolError(error);
      }
    }
  );

  // =========================================================================
  // CONFIGURATOR CHECKLIST TOOLS
  // =========================================================================

  server.tool(
    "generate_configurator_checklist",
    "Generates the initial SE configurator checklist for a client checklist by slug. Idempotent — returns existing checklist if already generated.",
    {
      slug: z.string().describe("The checklist URL slug"),
    },
    async ({ slug }) => {
      try {
        const before = await getConfiguratorMeta(slug);
        const blob = await generateConfiguratorChecklist(slug);
        const after = await getConfiguratorMeta(slug);

        return mcpJson({
          slug,
          clientName: after.clientName,
          totalItems: blob.snapshotItemIds.length,
          generatedAt: blob.generatedAt,
          alreadyExisted: before.generated,
        });
      } catch (error) {
        return mcpError(error);
      }
    }
  );

  server.tool(
    "get_configurator_checklist",
    "Retrieves the full configurator checklist for a client with all items, statuses, and notes. Set includeArchived=true to include items that are no longer in scope but retain historical status.",
    {
      slug: z.string().describe("The checklist URL slug"),
      includeArchived: z.boolean().optional().default(false),
    },
    async ({ slug, includeArchived }) => {
      try {
        const blob = await getConfiguratorChecklist(slug, { includeArchived });
        const templateMap = new Map(CONFIGURATOR_TEMPLATE.map((item) => [item.id, item]));
        return mcpJson({
          ...blob,
          items: blob.items.map((item) => {
            const template = templateMap.get(item.itemId);
            return {
              itemId: item.itemId,
              section: template?.section ?? "Unknown",
              title: template?.title ?? item.itemId,
              status: item.status,
              notes: item.notes,
              updatedAt: item.updatedAt,
              updatedBy: item.updatedBy,
              archived: item.archived,
            };
          }),
        });
      } catch (error) {
        return mcpError(error);
      }
    }
  );

  server.tool(
    "get_configurator_progress",
    "Returns a lightweight progress summary (counts by status, per-section breakdown, staleness flag) for a client's configurator checklist. Use this instead of get_configurator_checklist when you only need status metrics.",
    {
      slug: z.string().describe("The checklist URL slug"),
    },
    async ({ slug }) => {
      try {
        return mcpJson(await getConfiguratorProgress(slug));
      } catch (error) {
        return mcpError(error);
      }
    }
  );

  server.tool(
    "update_configurator_item",
    "Updates the status and/or notes of a single configurator checklist item. Accepts any of the 4 statuses (completed, in_progress, in_progress_with_dependency, blocked) or null to clear.",
    {
      slug: z.string().describe("The checklist URL slug"),
      itemId: z.string().describe("Stable configurator template item ID"),
      status: z.enum(["completed", "in_progress", "in_progress_with_dependency", "blocked"]).nullable(),
      notes: z.string().nullable().optional(),
    },
    async ({ slug, itemId, status, notes }) => {
      try {
        return mcpJson(
          await updateConfiguratorItem(slug, {
            itemId,
            status,
            notes: notes ?? null,
            updatedBy: "mcp",
          })
        );
      } catch (error) {
        if (error instanceof ConfiguratorServiceError) return mcpError(error);
        return mcpError(error);
      }
    }
  );

  server.tool(
    "refresh_configurator_snapshot",
    "Re-syncs the configurator checklist snapshot against the current source checklist settings. Adds newly-applicable items, archives items no longer in scope. Preserves all existing statuses and notes. Use after the source checklist's enabled tabs, communication channels, or feature toggles have changed.",
    {
      slug: z.string().describe("The checklist URL slug"),
    },
    async ({ slug }) => {
      try {
        const before = await getConfiguratorChecklist(slug, { includeArchived: true });
        const after = await refreshConfiguratorSnapshot(slug);
        const beforeMap = new Map(before.items.map((item) => [item.itemId, item]));

        const newlyAdded = after.items
          .filter((item) => !beforeMap.has(item.itemId))
          .map((item) => item.itemId);
        const newlyArchived = after.items
          .filter((item) => beforeMap.get(item.itemId)?.archived === false && item.archived)
          .map((item) => item.itemId);
        const newlyUnarchived = after.items
          .filter((item) => beforeMap.get(item.itemId)?.archived === true && !item.archived)
          .map((item) => item.itemId);

        return mcpJson({
          before: {
            total: before.snapshotItemIds.length,
            archived: before.items.filter((item) => item.archived).length,
          },
          after: {
            total: after.snapshotItemIds.length,
            archived: after.items.filter((item) => item.archived).length,
          },
          newlyAdded,
          newlyArchived,
          newlyUnarchived,
        });
      } catch (error) {
        return mcpError(error);
      }
    }
  );

  // =========================================================================
  // SNAPSHOT TOOLS (admin-grade backup/restore)
  // =========================================================================

  server.tool(
    "create_snapshot",
    "Create a labeled backup snapshot of the entire current checklist state (all tabs, config, and configurator state). Use this BEFORE any destructive change (e.g. replacing the user list) so you can roll back if it goes wrong. Snapshots without a label are auto-pruned after the 20-most-recent cap; labeled snapshots are sticky.",
    {
      slug: z.string().describe("The checklist URL slug"),
      label: z.string().optional().describe("Short human-readable label, e.g. 'Pre user-list replace - Nov 24'. Strongly recommended."),
      description: z.string().optional().describe("Optional longer notes about why this snapshot was taken."),
    },
    async ({ slug, label, description }) => {
      try {
        const checklistId = await getChecklistIdBySlug(slug);
        const snapshot = await createSnapshot(checklistId, {
          label: label ?? null,
          description: description ?? null,
          createdBy: "mcp",
          createdByLabel: "MCP",
        });
        return mcpJson({
          snapshotId: snapshot.id,
          label: snapshot.label,
          createdAt: snapshot.createdAt,
          versionAtSnapshot: snapshot.versionAtSnapshot,
          summary: snapshot.summary,
        });
      } catch (error) {
        if (error instanceof SnapshotServiceError) return mcpError(error);
        return mcpError(error);
      }
    }
  );

  server.tool(
    "list_snapshots",
    "List backup snapshots for a checklist, newest first. Returns lightweight metadata (id, label, createdAt, createdBy, counts summary) without the full payload.",
    {
      slug: z.string().describe("The checklist URL slug"),
      includeArchived: z.boolean().optional().default(false).describe("Include soft-archived snapshots (default false)"),
    },
    async ({ slug, includeArchived }) => {
      try {
        const checklistId = await getChecklistIdBySlug(slug);
        const snapshots = await listSnapshots(checklistId, { includeArchived });
        return mcpJson({ count: snapshots.length, snapshots });
      } catch (error) {
        if (error instanceof SnapshotServiceError) return mcpError(error);
        return mcpError(error);
      }
    }
  );

  server.tool(
    "restore_snapshot",
    "DESTRUCTIVE: replace the entire current checklist state with the contents of a previous snapshot. A pre-restore snapshot is auto-created so you can undo the restore. Bumps the checklist version, which will cause any in-flight client edits to fail with a conflict and force a reload. REQUIRES confirmRestore=true to execute.",
    {
      slug: z.string().describe("The checklist URL slug"),
      snapshotId: z.string().describe("ID of the snapshot to restore (from list_snapshots)"),
      confirmRestore: z.boolean().describe("Must be set to true to execute. Acts as a safety check."),
    },
    async ({ slug, snapshotId, confirmRestore }) => {
      try {
        if (confirmRestore !== true) {
          return mcpError(new Error("Restore aborted: confirmRestore must be true to execute. Restoring a snapshot replaces the current checklist state."));
        }
        const checklistId = await getChecklistIdBySlug(slug);
        const result = await restoreSnapshot(snapshotId, {
          createdBy: "mcp",
          createdByLabel: "MCP",
        });
        if (result.checklistId !== checklistId) {
          return mcpError(new Error(`Snapshot ${snapshotId} does not belong to checklist "${slug}"`));
        }
        return mcpJson({
          restored: true,
          preRestoreSnapshotId: result.preRestoreSnapshotId,
          newVersion: result.newVersion,
        });
      } catch (error) {
        if (error instanceof SnapshotServiceError) return mcpError(error);
        return mcpError(error);
      }
    }
  );

  // =========================================================================
  // CHATGPT COMPATIBILITY TOOLS
  // ChatGPT's MCP Apps connector requires tools named exactly "search" and
  // "fetch". These wrap the existing read tools so ChatGPT can register
  // this server. Claude.ai ignores these and uses the richer named tools.
  // =========================================================================

  server.tool(
    "search",
    "Search CRM configuration checklists by client name or slug. Returns matching checklists with their slug, client name, and last updated date.",
    {
      query: z.string().describe("Search query — matched against client name and slug"),
    },
    async ({ query }) => {
      const term = query.trim().toLowerCase();
      const checklists = await prisma.checklist.findMany({
        select: { clientName: true, slug: true, createdAt: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 100,
      });

      const matches = term
        ? checklists.filter(
            (c) =>
              c.clientName.toLowerCase().includes(term) ||
              c.slug.toLowerCase().includes(term)
          )
        : checklists.slice(0, 20);

      return mcpJson({ query, count: matches.length, results: matches });
    }
  );

  server.tool(
    "fetch",
    "Fetch the full data for a specific CRM configuration checklist. Accepts a slug (e.g. 'acme-corp') or a path like '/checklists/acme-corp'.",
    {
      url: z.string().describe("Checklist slug or path such as '/checklists/acme-corp'"),
    },
    async ({ url }) => {
      // Extract slug from path forms like /checklists/acme or acme
      const slug = url.replace(/^\/+/, "").replace(/^checklists\//, "").split("?")[0].trim();

      const checklist = await prisma.checklist.findUnique({ where: { slug } });

      if (!checklist) {
        return {
          content: [{ type: "text" as const, text: `Checklist with slug "${slug}" not found` }],
          isError: true,
        };
      }

      return mcpJson(checklist);
    }
  );

  return server;
}
