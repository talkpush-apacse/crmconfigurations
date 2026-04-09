/**
 * MCP Server for CRM Config Checklist
 *
 * Exposes 14 tools (4 read + 10 write) for managing checklists via Claude AI.
 * All write tools are append-only — they add rows without touching existing data.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "./db";
import { getSectionState, type SectionState } from "./section-status";
import { CHECKLIST_JSON_FIELDS, FIELD_LABELS, type ChecklistJsonField } from "./types";
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
} from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uuid(): string {
  return crypto.randomUUID();
}

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
        [sectionField]: merged as unknown as Record<string, unknown>[],
        version: newVersion,
        fieldVersions,
      },
    });

    return { added: newRows, totalCount: merged.length, version: newVersion };
  });

  return result;
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
        [sectionField]: merged,
        version: newVersion,
        fieldVersions,
      },
    });

    return { added: newStrings, totalCount: merged.length, version: newVersion };
  });

  return result;
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

      const enabledTabs = (checklist.enabledTabs as string[] | null) ?? [];
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
            documentsToRring: z.string().optional().default("").describe("Documents candidates should bring"),
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
        documentsToRring: s.documentsToRring,
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

  return server;
}
