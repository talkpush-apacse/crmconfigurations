/**
 * Verifies that public/template.xlsx is usable by the branded Excel export.
 *
 * Guards the failure mode that went unnoticed for months: the template was
 * re-saved by openpyxl, exceljs could no longer read it, and generateExcel()
 * silently fell back to unbranded generation.
 *
 *   npm run verify:template
 */
import ExcelJS from "exceljs";
import path from "path";
import { TEMPLATE_TABLES } from "../src/lib/excel-export";

const TEMPLATE = path.join(process.cwd(), "public", "template.xlsx");

const cellText = (v: ExcelJS.CellValue): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const rich = v as { richText?: { text: string }[]; text?: string };
    if (Array.isArray(rich.richText)) return rich.richText.map((t) => t.text).join("");
    if (typeof rich.text === "string") return rich.text;
    return "";
  }
  return String(v);
};

async function main() {
  const failures: string[] = [];
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.readFile(TEMPLATE);
  } catch (error) {
    console.error(`FAIL  exceljs cannot read ${TEMPLATE}`);
    console.error(`      ${(error as Error).message}`);
    console.error(`\n      Fix: node scripts/repair-template.mjs`);
    process.exit(1);
  }
  console.log(`PASS  exceljs reads template.xlsx (${workbook.worksheets.length} sheets)`);

  const images = workbook.worksheets.filter((ws) => ws.getImages().length > 0);
  if (images.length === 0) failures.push("no branding images found in the template");
  else console.log(`PASS  branding images present on: ${images.map((w) => w.name).join(", ")}`);

  for (const spec of TEMPLATE_TABLES) {
    const ws = workbook.getWorksheet(spec.sheet);
    if (!ws) {
      failures.push(`missing sheet "${spec.sheet}"`);
      continue;
    }
    const header = cellText(ws.getCell(spec.headerRow, spec.guardCol.charCodeAt(0) - 64).value);
    if (!header.startsWith(spec.guardText)) {
      failures.push(
        `"${spec.sheet}" ${spec.guardCol}${spec.headerRow} should start with "${spec.guardText}" but is "${header.slice(0, 40)}"`
      );
      continue;
    }
    // Every mapped column must have a header, or data would land in a blank column.
    const missing = Object.entries(spec.columns)
      .filter(([, letter]) => !cellText(ws.getCell(spec.headerRow, letter.charCodeAt(0) - 64).value).trim())
      .map(([field, letter]) => `${field}->${letter}`);
    if (missing.length) {
      failures.push(`"${spec.sheet}" has no header for: ${missing.join(", ")}`);
      continue;
    }
    console.log(`PASS  ${spec.sheet} (${Object.keys(spec.columns).length} mapped columns)`);
  }

  if (failures.length) {
    console.error(`\n${failures.length} failure(s):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log("\nAll template checks passed.");
}

main();
