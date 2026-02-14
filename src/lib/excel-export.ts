import ExcelJS from "exceljs";
import path from "path";
import type { ChecklistData, AiCallData } from "./types";

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
  populateTableSheet(workbook, "User List", data.users as Record<string, unknown>[] | null, 19, ["name", "accessType", "jobTitle", "email", "phone", "site", "reportsTo", "comments"], "C");
  populateTableSheet(workbook, "Campaigns List", data.campaigns as Record<string, unknown>[] | null, 12, ["nameInternal", "jobTitleExternal", "site", "jobDescription", "googleMapsLink", "zoomLink", "comments"], "C");
  populateTableSheet(workbook, "Sites", data.sites as Record<string, unknown>[] | null, 12, ["siteName", "internalName", "interviewHours", "interviewType", "fullAddress", "documentsToRring", "googleMapsLink", "comments"], "C");
  populateTableSheet(workbook, "Sources", data.sources as Record<string, unknown>[] | null, 12, ["category", "subcategory", "link", "comments"], "C");
  populateTableSheet(workbook, "Folders", data.folders as Record<string, unknown>[] | null, 12, ["folderName", "description", "movementType", "comments"], "C");
  populateTableSheet(workbook, "Document Collection", data.documents as Record<string, unknown>[] | null, 12, ["documentName", "applicableCandidates", "required", "blankTemplateLink", "applicableCampaigns", "accessPermissions", "folder", "comments"], "C");
  // Handle both old array and new object format for AI Call
  const aiCallFaqRows = Array.isArray(data.aiCallFaqs)
    ? data.aiCallFaqs
    : (data.aiCallFaqs as AiCallData)?.faqs ?? null;
  populateTableSheet(workbook, "AI Call FAQs", aiCallFaqRows as unknown as Record<string, unknown>[] | null, 4, ["faq", "example", "faqResponse"], "A");
  populateTableSheet(workbook, "Agency Portal", data.agencyPortal as Record<string, unknown>[] | null, 12, ["agencyName", "contactName", "email", "phone", "country", "comments"], "C");

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
    { header: "Job Title", key: "jobTitle", width: 25 },
    { header: "Email", key: "email", width: 30 },
    { header: "Phone", key: "phone", width: 20 },
    { header: "Site", key: "site", width: 20 },
    { header: "Reports To", key: "reportsTo", width: 20 },
    { header: "Comments", key: "comments", width: 30 },
  ], data.users as Record<string, unknown>[] | null);

  addTableSheet("Campaigns", [
    { header: "Campaign Name (Internal)", key: "nameInternal", width: 30 },
    { header: "Job Title (External)", key: "jobTitleExternal", width: 30 },
    { header: "Site", key: "site", width: 20 },
    { header: "Job Description", key: "jobDescription", width: 40 },
    { header: "Google Maps Link", key: "googleMapsLink", width: 30 },
    { header: "Zoom Link", key: "zoomLink", width: 30 },
    { header: "Comments", key: "comments", width: 30 },
  ], data.campaigns as Record<string, unknown>[] | null);

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

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
