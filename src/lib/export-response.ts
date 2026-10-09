import { NextResponse } from "next/server";
import { EmptyPageExportError, generateExcel } from "@/lib/excel-export";
import { fileNamePart, resolveExportTab, type ExportAudience } from "@/lib/export-scope";
import type { ChecklistData } from "@/lib/types";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * The download both export routes send, so "entire checklist" and "this page only"
 * go through one code path. `tabParam` is the raw `?tab=` value: absent means the
 * whole checklist, exactly as before.
 *
 * A tab the caller can't see is refused rather than ignored. Quietly falling back to
 * the full workbook would hand someone more than they asked for, and through an
 * editor link more than they are allowed.
 */
export async function buildExportResponse(
  checklist: { clientName: string },
  tabParam: string | null,
  audience: ExportAudience
): Promise<NextResponse> {
  // Same file name rule the full export has always used, so nobody's saved naming changes.
  const base = checklist.clientName.replace(/[^a-zA-Z0-9]/g, "_");

  if (tabParam === null) {
    const buffer = await generateExcel(checklist as unknown as ChecklistData);
    return download(buffer, `${base}_CRM_Config.xlsx`);
  }

  const tab = resolveExportTab(checklist as unknown as Parameters<typeof resolveExportTab>[0], tabParam, audience);
  if (!tab) {
    return NextResponse.json({ error: "That page can't be exported on its own. Use Entire checklist." }, { status: 404 });
  }
  try {
    const buffer = await generateExcel(checklist as unknown as ChecklistData, tab);
    return download(buffer, `${base}_CRM_Config_${fileNamePart(tab.label) || tab.slug}.xlsx`);
  } catch (err) {
    if (err instanceof EmptyPageExportError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

function download(buffer: Buffer, filename: string): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
