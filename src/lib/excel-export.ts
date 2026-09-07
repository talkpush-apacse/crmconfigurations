import ExcelJS from "exceljs";
import path from "path";
import type { ChecklistData, AiCallData, TabUploadMetaMap, AutoflowRule, IntegrationRow, CustomTab, CustomData } from "./types";
import { TAB_CONFIG } from "./tab-config";
import {
  integrationToCsvRow,
} from "./integration-utils";

export async function generateExcel(data: ChecklistData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const templatePath = path.join(process.cwd(), "public", "template.xlsx");

  try {
    await workbook.xlsx.readFile(templatePath);
  } catch (error) {
    // The branded template IS the deliverable, so failing to read it is a real
    // problem — not a routine fallback. This was silent for months after the
    // template was re-saved by openpyxl; see scripts/repair-template.mjs.
    console.error(
      `[excel-export] Could not read ${templatePath}. Falling back to unbranded generation. ` +
        `If the template was re-exported from openpyxl or Google Sheets, run: node scripts/repair-template.mjs`,
      error
    );
    return generateFreshExcel(data);
  }

  // Populate Company Information (sheet 3)
  const companySheet = workbook.getWorksheet("Company Information");
  if (companySheet && data.companyInfo) {
    const info = data.companyInfo as unknown as Record<string, string>;
    setCellSafe(companySheet, "D8", info.allowDuplicates);
    setCellSafe(companySheet, "D9", info.coolingPeriod);
    setCellSafe(companySheet, "D10", info.rehiresAllowed);
  }

  for (const spec of TEMPLATE_TABLES) {
    populateTemplateTable(workbook, spec, selectRows(data, spec));
  }

  // The template has no sheet for these, so they are appended in the same style
  // as the other generated sheets.
  addStyledSheet(workbook, "Attributes", ATTRIBUTE_COLUMNS, data.attributes as Record<string, unknown>[] | null);
  addStyledSheet(workbook, "Agency Portal Users", AGENCY_USER_COLUMNS, data.agencyPortalUsers as Record<string, unknown>[] | null);

  addAutoflowsSheet(workbook, data.autoflows);
  addIntegrationsSheet(workbook, data.integrations);
  addCustomTabSheets(workbook, data.customTabs, data.customData as CustomData | null);
  addTabUploadsSheet(workbook, data.tabUploadMeta as TabUploadMetaMap | null);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Where each field goes in public/template.xlsx.
 *
 * Row and column positions are read off the template, not inferred — the
 * sheets are hand-designed, so a table's data does not start immediately below
 * its header and the columns are not contiguous (several sheets interleave
 * "For Talkpush only" columns). `guardCol`/`guardText` make a layout change
 * fail loudly instead of silently writing into the wrong cells.
 */
export interface TemplateTableSpec {
  /** Worksheet name. */
  sheet: string;
  /** Row holding the column headers. */
  headerRow: number;
  /** Header cell checked before writing, to catch template drift. */
  guardCol: string;
  guardText: string;
  /** First row written — below the header and the template's "Example" row. */
  firstDataRow: number;
  /**
   * Last row occupied by the template's own sample/default content. Cleared
   * (in the mapped columns only) before writing so the delivered file shows
   * the client's answers rather than a mix of answers and Talkpush samples.
   */
  clearThroughRow: number;
  /** Column holding the running row number, where the sheet has one. */
  numberCol?: string;
  /** Field name on the data row -> column letter. */
  columns: Record<string, string>;
}

export const TEMPLATE_TABLES: TemplateTableSpec[] = [
  {
    sheet: "User List", headerRow: 17, guardCol: "C", guardText: "Name",
    firstDataRow: 19, clearThroughRow: 19, numberCol: "B",
    columns: {
      name: "C", accessType: "D", email: "E", phone: "F",
      jobTitle: "G", site: "H", reportsTo: "I", comments: "J",
    },
  },
  {
    sheet: "Campaigns List", headerRow: 17, guardCol: "C", guardText: "Campaign Name (Internal)",
    firstDataRow: 19, clearThroughRow: 19, numberCol: "B",
    columns: {
      nameInternal: "C", jobTitleExternal: "D", site: "E", jobDescription: "F",
      googleMapsLink: "G", zoomLink: "H", comments: "I",
      // J/K/M are "For Talkpush only" and deliberately left untouched.
      campaignId: "L", assignedRecruiters: "N",
    },
  },
  {
    sheet: "Sites", headerRow: 11, guardCol: "C", guardText: "Site Name",
    firstDataRow: 13, clearThroughRow: 13, numberCol: "B",
    columns: {
      siteName: "C", internalName: "D", interviewHours: "E", interviewType: "F",
      fullAddress: "G", documentsToRing: "H", googleMapsLink: "I", comments: "K",
    },
  },
  {
    sheet: "Pre-screening & Follow-up Quest", headerRow: 17, guardCol: "C", guardText: "Question",
    firstDataRow: 19, clearThroughRow: 27, numberCol: "B",
    columns: {
      question: "C", questionType: "D", answerOptions: "E", applicableCampaigns: "F",
      autoReject: "G", rejectCondition: "H", rejectReason: "I", comments: "J",
      category: "M",
    },
  },
  {
    sheet: "Messaging Templates", headerRow: 12, guardCol: "C", guardText: "Template Name",
    firstDataRow: 13, clearThroughRow: 35, numberCol: "B",
    columns: {
      name: "C", purpose: "D", language: "E", folder: "F",
      // emailSubject is folded into the Email Template cell as a "Subject:"
      // line, matching how the template's own default templates are written.
      emailTemplate: "G", emailActive: "H",
      smsTemplate: "I", smsActive: "J",
      whatsappTemplate: "K", whatsappActive: "L",
      messengerTemplate: "M", messengerActive: "N",
      comments: "O",
    },
  },
  {
    sheet: "Sources", headerRow: 11, guardCol: "C", guardText: "Source Category",
    firstDataRow: 13, clearThroughRow: 18, numberCol: "B",
    columns: { category: "C", subcategory: "D", link: "E", comments: "F" },
  },
  {
    sheet: "Folders", headerRow: 11, guardCol: "C", guardText: "Folder Name",
    firstDataRow: 12, clearThroughRow: 28, numberCol: "B",
    columns: { folderName: "C", description: "D", movementType: "E", comments: "F" },
  },
  {
    sheet: "Document Collection", headerRow: 11, guardCol: "C", guardText: "Official Name of Document",
    firstDataRow: 13, clearThroughRow: 16, numberCol: "B",
    columns: {
      documentName: "C", applicableCandidates: "D", required: "E", blankTemplateLink: "F",
      applicableCampaigns: "G", accessPermissions: "H", folder: "I", comments: "J",
    },
  },
  {
    sheet: "AI Call FAQs", headerRow: 3, guardCol: "A", guardText: "FAQ",
    firstDataRow: 4, clearThroughRow: 38,
    columns: { faq: "A", example: "B", faqResponse: "C" },
  },
  {
    sheet: "Agency Portal", headerRow: 11, guardCol: "C", guardText: "Agency Name",
    firstDataRow: 12, clearThroughRow: 15, numberCol: "B",
    columns: {
      agencyName: "C", contactName: "D", email: "E", phone: "F",
      country: "G", comments: "J",
    },
  },
];

/** Pulls the rows for a spec out of the checklist, normalising shape per sheet. */
function selectRows(data: ChecklistData, spec: TemplateTableSpec): Record<string, unknown>[] | null {
  switch (spec.sheet) {
    case "User List":
      return data.users as unknown as Record<string, unknown>[] | null;
    case "Campaigns List":
      return (data.campaigns ?? null) && data.campaigns!.map((c) => ({
        ...c,
        assignedRecruiters: Array.isArray(c.assignedRecruiters)
          ? c.assignedRecruiters.join(", ")
          : c.assignedRecruiters ?? "",
      })) as unknown as Record<string, unknown>[];
    case "Sites":
      return data.sites as unknown as Record<string, unknown>[] | null;
    case "Pre-screening & Follow-up Quest":
      return data.prescreening as unknown as Record<string, unknown>[] | null;
    case "Messaging Templates":
      return (data.messaging ?? null) && data.messaging!.map((t) => ({
        ...t,
        emailTemplate: joinSubject(t.emailSubject, t.emailTemplate),
      })) as unknown as Record<string, unknown>[];
    case "Sources":
      return data.sources as unknown as Record<string, unknown>[] | null;
    case "Folders":
      return data.folders as unknown as Record<string, unknown>[] | null;
    case "Document Collection":
      return data.documents as unknown as Record<string, unknown>[] | null;
    case "AI Call FAQs": {
      // Older checklists stored a bare array; newer ones nest it under `faqs`.
      const faqs = Array.isArray(data.aiCallFaqs)
        ? data.aiCallFaqs
        : (data.aiCallFaqs as AiCallData | null)?.faqs ?? null;
      return faqs as unknown as Record<string, unknown>[] | null;
    }
    case "Agency Portal":
      return data.agencyPortal as unknown as Record<string, unknown>[] | null;
    default:
      return null;
  }
}

/** The template writes email templates with the subject as a leading line. */
function joinSubject(subject: string | undefined, body: string | undefined): string {
  const s = (subject ?? "").trim();
  const b = (body ?? "").trim();
  if (!s) return b;
  return b ? `Subject: ${s}\n\n${b}` : `Subject: ${s}`;
}

const colNum = (letter: string) => letter.charCodeAt(0) - 64;

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const rich = value as { richText?: { text: string }[]; text?: string };
    if (Array.isArray(rich.richText)) return rich.richText.map((t) => t.text).join("");
    if (typeof rich.text === "string") return rich.text;
    return "";
  }
  return String(value);
}

function toCellValue(value: unknown): ExcelJS.CellValue {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value;
  return value as ExcelJS.CellValue;
}

function populateTemplateTable(
  workbook: ExcelJS.Workbook,
  spec: TemplateTableSpec,
  rows: Record<string, unknown>[] | null | undefined
) {
  // No client answers: leave the template's examples and defaults in place,
  // so an untouched tab still reads as guidance rather than a blank table.
  if (!rows || rows.length === 0) return;

  const sheet = workbook.getWorksheet(spec.sheet);
  if (!sheet) {
    console.error(`[excel-export] Template is missing the "${spec.sheet}" sheet; skipped ${rows.length} row(s).`);
    return;
  }

  const header = cellText(sheet.getCell(spec.headerRow, colNum(spec.guardCol)).value);
  if (!header.startsWith(spec.guardText)) {
    console.error(
      `[excel-export] "${spec.sheet}" layout changed: expected ${spec.guardCol}${spec.headerRow} to start with ` +
        `"${spec.guardText}" but found "${header.slice(0, 40)}". Skipping this sheet rather than writing ` +
        `${rows.length} row(s) into the wrong cells.`
    );
    return;
  }

  const owned = Object.values(spec.columns).map(colNum);
  if (spec.numberCol) owned.push(colNum(spec.numberCol));

  const lastRow = Math.max(spec.clearThroughRow, spec.firstDataRow + rows.length - 1);
  for (let r = spec.firstDataRow; r <= lastRow; r++) {
    for (const c of owned) sheet.getCell(r, c).value = null;
  }

  rows.forEach((row, i) => {
    const r = spec.firstDataRow + i;
    if (spec.numberCol) sheet.getCell(r, colNum(spec.numberCol)).value = i + 1;
    for (const [field, letter] of Object.entries(spec.columns)) {
      sheet.getCell(r, colNum(letter)).value = toCellValue(row[field]);
    }
  });
}

type StyledColumn = { header: string; key: string; width: number };

const ATTRIBUTE_COLUMNS: StyledColumn[] = [
  { header: "Attribute Name", key: "attributeName", width: 25 },
  { header: "Key", key: "key", width: 20 },
  { header: "Description", key: "description", width: 40 },
  { header: "Data Type", key: "dataType", width: 15 },
  { header: "Suggested Values", key: "suggestedValues", width: 30 },
  { header: "Add to All Future Candidates", key: "addToAllFutureCandidates", width: 26 },
  { header: "Show Across Applications", key: "showAcrossApplications", width: 24 },
  { header: "Mark Data Private", key: "markDataPrivate", width: 20 },
  { header: "Restrict to Owners", key: "restrictToOwners", width: 20 },
  { header: "Hide Attribute (Compliance)", key: "hideAttributeCompliance", width: 26 },
  { header: "Use Suggested Values Only", key: "useSuggestedValuesOnly", width: 24 },
  { header: "Read-only Mode", key: "readOnlyMode", width: 18 },
];

const AGENCY_USER_COLUMNS: StyledColumn[] = [
  { header: "Name", key: "name", width: 25 },
  { header: "Email", key: "email", width: 30 },
  { header: "Agency", key: "agency", width: 25 },
  { header: "User Access", key: "userAccess", width: 20 },
];

/** Appends a sheet in the same style as the other generated sheets. */
function addStyledSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  cols: StyledColumn[],
  rows: Record<string, unknown>[] | null | undefined
) {
  if (workbook.getWorksheet(name)) return;
  const sheet = workbook.addWorksheet(name);
  sheet.columns = cols;
  if (rows) {
    rows.forEach((row) => {
      const out: Record<string, unknown> = {};
      cols.forEach((c) => { out[c.key] = toCellValue(row[c.key]); });
      sheet.addRow(out);
    });
  }
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF535FC1" } };
}

function setCellSafe(sheet: ExcelJS.Worksheet, ref: string, value: unknown) {
  try {
    const cell = sheet.getCell(ref);
    cell.value = value as ExcelJS.CellValue;
  } catch {
    // Skip if cell reference is invalid
  }
}

async function generateFreshExcel(data: ChecklistData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  // Company Information
  const companySheet = workbook.addWorksheet("Company Information");
  companySheet.columns = [
    { header: "Field", key: "field", width: 30 },
    { header: "Value", key: "value", width: 40 },
  ];
  if (data.companyInfo) {
    const info = data.companyInfo as unknown as Record<string, string>;
    companySheet.addRow({ field: "Allow Duplicate Candidates?", value: info.allowDuplicates });
    companySheet.addRow({ field: "Cooling Period", value: info.coolingPeriod });
    companySheet.addRow({ field: "Rehires Allowed?", value: info.rehiresAllowed });
  }

  // Helper to create table sheets
  const addTableSheet = (name: string, cols: { header: string; key: string; width: number }[], rows: Record<string, unknown>[] | null) => {
    const sheet = workbook.addWorksheet(name);
    sheet.columns = cols;
    if (rows) {
      rows.forEach((row) => {
        const rowData: Record<string, unknown> = {};
        cols.forEach((c) => { rowData[c.key] = row[c.key] ?? ""; });
        sheet.addRow(rowData);
      });
    }
    // Style header row
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF535FC1" } };
  };

  addTableSheet("User List", [
    { header: "Name", key: "name", width: 25 },
    { header: "Access Type", key: "accessType", width: 20 },
    { header: "Email", key: "email", width: 30 },
    { header: "Phone", key: "phone", width: 20 },
    { header: "Job Title", key: "jobTitle", width: 25 },
    { header: "Site", key: "site", width: 20 },
    { header: "Reports To", key: "reportsTo", width: 20 },
    { header: "Comments", key: "comments", width: 30 },
  ], data.users as Record<string, unknown>[] | null);

  // Flatten assignedRecruiters arrays for fresh export
  const freshCampaigns = data.campaigns?.map((c) => ({
    ...c,
    assignedRecruiters: Array.isArray(c.assignedRecruiters) ? c.assignedRecruiters.join(", ") : (c.assignedRecruiters ?? ""),
  })) ?? null;
  addTableSheet("Campaigns", [
    { header: "Campaign ID", key: "campaignId", width: 20 },
    { header: "Campaign Name (Internal)", key: "nameInternal", width: 30 },
    { header: "Job Title (External)", key: "jobTitleExternal", width: 30 },
    { header: "Site", key: "site", width: 20 },
    { header: "Job Description", key: "jobDescription", width: 40 },
    { header: "Google Maps Link", key: "googleMapsLink", width: 30 },
    { header: "Zoom Link", key: "zoomLink", width: 30 },
    { header: "Assigned Recruiters", key: "assignedRecruiters", width: 35 },
    { header: "Comments", key: "comments", width: 30 },
  ], freshCampaigns as Record<string, unknown>[] | null);

  addTableSheet("Sites", [
    { header: "Site Name", key: "siteName", width: 25 },
    { header: "Internal Name", key: "internalName", width: 20 },
    { header: "Interview Hours", key: "interviewHours", width: 20 },
    { header: "Interview Type", key: "interviewType", width: 15 },
    { header: "Full Address", key: "fullAddress", width: 40 },
    { header: "Documents to Bring", key: "documentsToRing", width: 30 },
    { header: "Google Maps Link", key: "googleMapsLink", width: 30 },
    { header: "Comments", key: "comments", width: 30 },
  ], data.sites as Record<string, unknown>[] | null);

  addTableSheet("Pre-screening Questions", [
    { header: "Category", key: "category", width: 15 },
    { header: "Question", key: "question", width: 40 },
    { header: "Question Type", key: "questionType", width: 20 },
    { header: "Answer Options", key: "answerOptions", width: 30 },
    { header: "Applicable Campaigns", key: "applicableCampaigns", width: 25 },
    { header: "Auto-Reject", key: "autoReject", width: 12 },
    { header: "Reject Condition", key: "rejectCondition", width: 25 },
    { header: "Reject Reason", key: "rejectReason", width: 25 },
    { header: "Comments", key: "comments", width: 25 },
  ], data.prescreening as Record<string, unknown>[] | null);

  addTableSheet("Messaging Templates", [
    { header: "Name", key: "name", width: 25 },
    { header: "Purpose", key: "purpose", width: 30 },
    { header: "Language", key: "language", width: 12 },
    { header: "Folder", key: "folder", width: 15 },
    { header: "Email Subject", key: "emailSubject", width: 35 },
    { header: "Email Template", key: "emailTemplate", width: 40 },
    { header: "Email Active", key: "emailActive", width: 12 },
    { header: "SMS Template", key: "smsTemplate", width: 40 },
    { header: "SMS Active", key: "smsActive", width: 12 },
    { header: "WhatsApp Template", key: "whatsappTemplate", width: 40 },
    { header: "WhatsApp Active", key: "whatsappActive", width: 12 },
    { header: "Messenger Template", key: "messengerTemplate", width: 40 },
    { header: "Messenger Active", key: "messengerActive", width: 12 },
    { header: "Comments", key: "comments", width: 30 },
  ], data.messaging as Record<string, unknown>[] | null);

  addTableSheet("Sources", [
    { header: "Category", key: "category", width: 25 },
    { header: "Subcategory", key: "subcategory", width: 25 },
    { header: "Link", key: "link", width: 40 },
    { header: "Comments", key: "comments", width: 30 },
  ], data.sources as Record<string, unknown>[] | null);

  addTableSheet("Folders", [
    { header: "Folder Name", key: "folderName", width: 25 },
    { header: "Description", key: "description", width: 40 },
    { header: "Movement Type", key: "movementType", width: 15 },
    { header: "Comments", key: "comments", width: 30 },
  ], data.folders as Record<string, unknown>[] | null);

  addTableSheet("Document Collection", [
    { header: "Document Name", key: "documentName", width: 25 },
    { header: "Applicable Candidates", key: "applicableCandidates", width: 25 },
    { header: "Required", key: "required", width: 10 },
    { header: "Template Link", key: "blankTemplateLink", width: 30 },
    { header: "Applicable Campaigns", key: "applicableCampaigns", width: 25 },
    { header: "Access Permissions", key: "accessPermissions", width: 25 },
    { header: "Folder", key: "folder", width: 15 },
    { header: "Comments", key: "comments", width: 30 },
  ], data.documents as Record<string, unknown>[] | null);

  addTableSheet("Attributes", [
    { header: "Attribute Name", key: "attributeName", width: 25 },
    { header: "Key", key: "key", width: 25 },
    { header: "Description", key: "description", width: 35 },
    { header: "Data Type", key: "dataType", width: 15 },
    { header: "Suggested Values", key: "suggestedValues", width: 30 },
    { header: "Add to Future Candidates", key: "addToAllFutureCandidates", width: 25 },
    { header: "Show Across Applications", key: "showAcrossApplications", width: 25 },
    { header: "Private", key: "markDataPrivate", width: 10 },
    { header: "Restrict to Owners", key: "restrictToOwners", width: 20 },
    { header: "Hide (Compliance)", key: "hideAttributeCompliance", width: 20 },
    { header: "Suggested Values Only", key: "useSuggestedValuesOnly", width: 22 },
    { header: "Read-Only", key: "readOnlyMode", width: 12 },
  ], data.attributes as Record<string, unknown>[] | null);

  // Handle both old array and new object format for AI Call
  const freshAiCallFaqRows = Array.isArray(data.aiCallFaqs)
    ? data.aiCallFaqs
    : (data.aiCallFaqs as AiCallData)?.faqs ?? null;
  addTableSheet("AI Call", [
    { header: "FAQ", key: "faq", width: 25 },
    { header: "Example", key: "example", width: 40 },
    { header: "FAQ Response", key: "faqResponse", width: 50 },
  ], freshAiCallFaqRows as unknown as Record<string, unknown>[] | null);

  addTableSheet("Agency Portal", [
    { header: "Agency Name", key: "agencyName", width: 25 },
    { header: "Contact Name", key: "contactName", width: 25 },
    { header: "Email", key: "email", width: 30 },
    { header: "Phone", key: "phone", width: 20 },
    { header: "Country", key: "country", width: 15 },
    { header: "Comments", key: "comments", width: 30 },
  ], data.agencyPortal as Record<string, unknown>[] | null);

  addTableSheet("Agency Portal Users", [
    { header: "Name", key: "name", width: 25 },
    { header: "Email", key: "email", width: 30 },
    { header: "Agency", key: "agency", width: 25 },
    { header: "User Access", key: "userAccess", width: 20 },
  ], data.agencyPortalUsers as Record<string, unknown>[] | null);

  addAutoflowsSheet(workbook, data.autoflows);
  addIntegrationsSheet(workbook, data.integrations);
  addCustomTabSheets(workbook, data.customTabs, data.customData as CustomData | null);
  addTabUploadsSheet(workbook, data.tabUploadMeta as TabUploadMetaMap | null);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function addAutoflowsSheet(workbook: ExcelJS.Workbook, autoflows: AutoflowRule[] | null | undefined) {
  if (workbook.getWorksheet("Autoflows")) return;
  const sheet = workbook.addWorksheet("Autoflows");
  sheet.columns = [
    { header: "Group", key: "group", width: 20 },
    { header: "Trigger Type", key: "triggerType", width: 18 },
    { header: "Trigger Folder / Attribute", key: "triggerSource", width: 25 },
    { header: "Condition", key: "condition", width: 20 },
    { header: "Action", key: "action", width: 25 },
    { header: "Target Folder", key: "targetFolder", width: 20 },
    { header: "Timing", key: "timing", width: 15 },
    { header: "Message Template", key: "messageTemplate", width: 25 },
    { header: "Rejection Reason", key: "rejectionReason", width: 20 },
    { header: "Notes", key: "notes", width: 30 },
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF535FC1" } };
  if (autoflows) {
    autoflows.forEach((rule) => sheet.addRow(rule as unknown as Record<string, unknown>));
  }
}

function addIntegrationsSheet(workbook: ExcelJS.Workbook, integrations: IntegrationRow[] | null | undefined) {
  const existing = workbook.getWorksheet("Integrations");
  const sheet = existing ?? workbook.addWorksheet("Integrations");
  if (sheet.rowCount > 0) {
    sheet.spliceRows(1, sheet.rowCount);
  }

  sheet.columns = [
    { header: "Vendor Name", key: "vendorName", width: 24 },
    { header: "Category", key: "vendorCategory", width: 20 },
    { header: "Action Type", key: "actionType", width: 30 },
    { header: "Trigger Folder", key: "triggerFolder", width: 24 },
    { header: "Status", key: "status", width: 18 },
    { header: "Endpoint URL", key: "endpointUrl", width: 40 },
    { header: "Auth Method", key: "authMethod", width: 24 },
    { header: "Auth Param / Header", key: "authParamName", width: 24 },
    { header: "Outbound Payload Mapping", key: "outboundPayloadMapping", width: 45 },
    { header: "Response Handling", key: "responseHandling", width: 45 },
    { header: "Inbound Attribute Mapping", key: "inboundAttributeMapping", width: 45 },
    { header: "Match Key", key: "matchKey", width: 18 },
    { header: "Document Tag", key: "documentTag", width: 24 },
    { header: "Target Folder", key: "targetFolder", width: 24 },
    { header: "Filter Criteria", key: "filterCriteria", width: 35 },
    { header: "Talkpush API Base URL", key: "talkpushApiBaseUrl", width: 35 },
    { header: "API Environment", key: "apiEnvironment", width: 18 },
    { header: "Inbound Auth Method", key: "inboundAuthMethod", width: 24 },
    { header: "Inbound Auth Param / Header", key: "inboundAuthParamName", width: 28 },
    { header: "Campaign Scope", key: "campaignScope", width: 22 },
    { header: "Campaign IDs", key: "campaignIds", width: 28 },
    { header: "Campaign Names", key: "campaignNames", width: 32 },
    { header: "Candidate ID Retrieval Method", key: "candidateIdSource", width: 32 },
    { header: "Candidate ID Field Name", key: "candidateIdFieldName", width: 26 },
    { header: "Lookup Query Params", key: "lookupQueryParams", width: 40 },
    { header: "Multi-match Behavior", key: "multiMatchBehavior", width: 24 },
    { header: "Sample Request", key: "sampleRequest", width: 45 },
    { header: "Sample Success Response", key: "sampleSuccessResponse", width: 40 },
    { header: "Sample Error Response", key: "sampleErrorResponse", width: 40 },
    { header: "Rate Limit Notes", key: "rateLimitNotes", width: 35 },
    { header: "Retry / Timeout Notes", key: "retryTimeoutNotes", width: 35 },
    { header: "Idempotency Notes", key: "idempotencyNotes", width: 35 },
    { header: "UAT Test Candidate", key: "uatTestCandidate", width: 30 },
    { header: "Expected Talkpush Result", key: "expectedTalkpushResult", width: 35 },
    { header: "Vendor Contact Name", key: "vendorContactName", width: 24 },
    { header: "Vendor Contact Email", key: "vendorContactEmail", width: 30 },
    { header: "Vendor Docs URL", key: "vendorDocsUrl", width: 40 },
    { header: "Notes", key: "notes", width: 40 },
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF535FC1" } };

  if (integrations) {
    integrations.forEach((integration) => {
      sheet.addRow(integrationToCsvRow(integration));
    });
  }

  sheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: "top", wrapText: true };
    });
  });
}

/**
 * Adds a "Tab File Uploads" sheet listing every tab the client uploaded
 * a spreadsheet for, plus whether they opted to skip manual entry. Skipped
 * tabs should be reviewed against the uploaded files instead of the in-app form.
 */
function addTabUploadsSheet(
  workbook: ExcelJS.Workbook,
  tabUploadMeta: TabUploadMetaMap | null
) {
  if (!tabUploadMeta) return;

  // Build rows in TAB_CONFIG order so the export matches the in-app tab order.
  const rows: Array<{
    tab: string;
    skipped: string;
    fileCount: number;
    files: string;
    urls: string;
  }> = [];

  for (const tab of TAB_CONFIG) {
    if (!tab.dataKey) continue;
    const meta = tabUploadMeta[tab.dataKey];
    if (!meta || meta.uploadedFiles.length === 0) continue;
    rows.push({
      tab: tab.label,
      skipped: meta.isSkipped ? "Yes" : "No",
      fileCount: meta.uploadedFiles.length,
      files: meta.uploadedFiles.map((f) => f.fileName).join("; "),
      urls: meta.uploadedFiles.map((f) => f.fileUrl).join("; "),
    });
  }

  if (rows.length === 0) return;

  // Avoid clobbering an existing sheet of the same name in the template.
  if (workbook.getWorksheet("Tab File Uploads")) return;

  const sheet = workbook.addWorksheet("Tab File Uploads");
  sheet.columns = [
    { header: "Tab", key: "tab", width: 28 },
    { header: "Manual Entry Skipped", key: "skipped", width: 22 },
    { header: "File Count", key: "fileCount", width: 12 },
    { header: "File Names", key: "files", width: 50 },
    { header: "File URLs", key: "urls", width: 60 },
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1A73E8" },
  };
  rows.forEach((r) => sheet.addRow(r));
}

// =============================================================================
// Custom tabs
// =============================================================================

const HEADER_FILL_CUSTOM = "FF7C6BB5";

/**
 * Excel worksheet names are capped at 31 characters and cannot contain
 * : \ / ? * [ ] — so a client-authored tab label has to be sanitized before it
 * can be used. Returns a name that is both legal and unique within `workbook`.
 */
function toUniqueSheetName(workbook: ExcelJS.Workbook, label: string): string {
  const cleaned = label.replace(/[:\\/?*[\]]/g, " ").replace(/\s+/g, " ").trim();
  const base = (cleaned || "Custom Tab").slice(0, 31);

  if (!workbook.getWorksheet(base)) return base;

  // Suffix until unique, trimming the base so the result still fits in 31 chars.
  for (let n = 2; n < 100; n++) {
    const suffix = ` (${n})`;
    const candidate = base.slice(0, 31 - suffix.length) + suffix;
    if (!workbook.getWorksheet(candidate)) return candidate;
  }
  return base.slice(0, 27) + ` (${Date.now() % 100})`;
}

/** Booleans render as Yes/No so the sheet reads the way the in-app checkbox does. */
function customCellValue(value: unknown): ExcelJS.CellValue {
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return value as ExcelJS.CellValue;
}

/** Notes the attached reference spreadsheet, if the client uploaded one. */
function appendUploadedFileNote(sheet: ExcelJS.Worksheet, tab: CustomTab) {
  if (!tab.uploadedFile) return;
  sheet.addRow([]);
  const noteRow = sheet.addRow(["Reference spreadsheet:", tab.uploadedFile.name]);
  noteRow.getCell(1).font = { bold: true };
  sheet.addRow(["File URL:", tab.uploadedFile.url]);
}

/** Table-based custom tab → one worksheet, one column per defined column. */
function addCustomTableTabSheet(
  workbook: ExcelJS.Workbook,
  tab: CustomTab
) {
  const columns = tab.columns ?? [];
  if (columns.length === 0) return;

  const sheet = workbook.addWorksheet(toUniqueSheetName(workbook, tab.label));
  sheet.columns = columns.map((col) => ({
    header: col.label,
    key: col.key,
    width: col.type === "textarea" ? 45 : 25,
  }));

  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: HEADER_FILL_CUSTOM },
  };

  for (const row of tab.rows ?? []) {
    const rowData: Record<string, ExcelJS.CellValue> = {};
    for (const col of columns) {
      rowData[col.key] = customCellValue(row[col.key]);
    }
    sheet.addRow(rowData);
  }

  sheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: "top", wrapText: true };
    });
  });

  appendUploadedFileNote(sheet, tab);
}

/**
 * Form-based custom tab → a Field/Value worksheet. Values live in the shared
 * `customData` bag keyed by field id, not on the tab itself.
 */
function addCustomFieldTabSheet(
  workbook: ExcelJS.Workbook,
  tab: CustomTab,
  customData: CustomData | null
) {
  const fields = tab.fields ?? [];
  if (fields.length === 0) return;

  const sheet = workbook.addWorksheet(toUniqueSheetName(workbook, tab.label));
  sheet.columns = [
    { header: "Field", key: "field", width: 35 },
    { header: "Value", key: "value", width: 60 },
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: HEADER_FILL_CUSTOM },
  };

  for (const field of fields) {
    sheet.addRow({
      field: field.label,
      value: customCellValue(customData?.[field.id]),
    });
  }

  sheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: "top", wrapText: true };
    });
  });

  appendUploadedFileNote(sheet, tab);
}

/**
 * Adds one worksheet per custom tab. Without this, anything a client entered
 * into a custom tab is absent from the exported workbook.
 */
function addCustomTabSheets(
  workbook: ExcelJS.Workbook,
  customTabs: CustomTab[] | null | undefined,
  customData: CustomData | null
) {
  if (!customTabs || customTabs.length === 0) return;

  // Respect the in-app tab ordering.
  const ordered = [...customTabs].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );

  for (const tab of ordered) {
    if (tab.columns !== undefined) {
      addCustomTableTabSheet(workbook, tab);
    } else {
      addCustomFieldTabSheet(workbook, tab, customData);
    }
  }
}
