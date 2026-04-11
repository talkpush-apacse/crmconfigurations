import ExcelJS from "exceljs";
import path from "path";
import type { ChecklistData, AiCallData, TabUploadMetaMap } from "./types";
import { TAB_CONFIG } from "./tab-config";

export async function generateExcel(data: ChecklistData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const templatePath = path.join(process.cwd(), "public", "template.xlsx");

  try {
    await workbook.xlsx.readFile(templatePath);
  } catch {
    // If template doesn't load, create a fresh workbook
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

  // Populate tabular sheets
  populateTableSheet(workbook, "User List", data.users as Record<string, unknown>[] | null, 19, ["name", "accessType", "email", "phone", "jobTitle", "site", "reportsTo", "comments"], "C");
  // Flatten assignedRecruiters arrays to comma-separated strings for export
  const campaignsForExport = data.campaigns?.map((c) => ({
    ...c,
    assignedRecruiters: Array.isArray(c.assignedRecruiters) ? c.assignedRecruiters.join(", ") : (c.assignedRecruiters ?? ""),
  })) ?? null;
  populateTableSheet(workbook, "Campaigns List", campaignsForExport as Record<string, unknown>[] | null, 12, ["campaignId", "nameInternal", "jobTitleExternal", "site", "jobDescription", "googleMapsLink", "zoomLink", "assignedRecruiters", "comments"], "C");
  populateTableSheet(workbook, "Sites", data.sites as Record<string, unknown>[] | null, 12, ["siteName", "internalName", "interviewHours", "interviewType", "fullAddress", "documentsToRring", "googleMapsLink", "comments"], "C");
  populateTableSheet(workbook, "Sources", data.sources as Record<string, unknown>[] | null, 12, ["category", "subcategory", "link", "comments"], "C");
  populateTableSheet(workbook, "Folders", data.folders as Record<string, unknown>[] | null, 12, ["folderName", "description", "movementType", "comments"], "C");
  populateTableSheet(workbook, "Document Collection", data.documents as Record<string, unknown>[] | null, 12, ["documentName", "applicableCandidates", "required", "blankTemplateLink", "applicableCampaigns", "accessPermissions", "folder", "comments"], "C");
  populateTableSheet(workbook, "Attributes", data.attributes as Record<string, unknown>[] | null, 12, ["attributeName", "key", "description", "dataType", "suggestedValues", "addToAllFutureCandidates", "showAcrossApplications", "markDataPrivate", "restrictToOwners", "hideAttributeCompliance", "useSuggestedValuesOnly", "readOnlyMode"], "C");
  // Handle both old array and new object format for AI Call
  const aiCallFaqRows = Array.isArray(data.aiCallFaqs)
    ? data.aiCallFaqs
    : (data.aiCallFaqs as AiCallData)?.faqs ?? null;
  populateTableSheet(workbook, "AI Call FAQs", aiCallFaqRows as unknown as Record<string, unknown>[] | null, 4, ["faq", "example", "faqResponse"], "A");
  populateTableSheet(workbook, "Agency Portal", data.agencyPortal as Record<string, unknown>[] | null, 12, ["agencyName", "contactName", "email", "phone", "country", "comments"], "C");
  populateTableSheet(workbook, "Agency Portal Users", data.agencyPortalUsers as Record<string, unknown>[] | null, 12, ["name", "email", "agency", "userAccess"], "C");

  addTabUploadsSheet(workbook, data.tabUploadMeta as TabUploadMetaMap | null);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function setCellSafe(sheet: ExcelJS.Worksheet, ref: string, value: unknown) {
  try {
    const cell = sheet.getCell(ref);
    cell.value = value as ExcelJS.CellValue;
  } catch {
    // Skip if cell reference is invalid
  }
}

function populateTableSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  rows: Record<string, unknown>[] | null,
  startRow: number,
  fields: string[],
  startCol: string
) {
  if (!rows || rows.length === 0) return;
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) return;

  const startColNum = startCol.charCodeAt(0) - 64; // A=1, B=2, C=3...

  rows.forEach((row, i) => {
    const rowNum = startRow + i;
    fields.forEach((field, j) => {
      const colNum = startColNum + j;
      try {
        const cell = sheet.getCell(rowNum, colNum);
        cell.value = (row[field] as ExcelJS.CellValue) ?? "";
      } catch {
        // Skip
      }
    });
  });
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
    { header: "Documents to Bring", key: "documentsToRring", width: 30 },
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

  addTabUploadsSheet(workbook, data.tabUploadMeta as TabUploadMetaMap | null);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
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
