import { NextRequest, NextResponse } from "next/server";
import { findFullChecklistByEditorToken } from "@/lib/edit-history/resolve";
import { LINK_OFF_MESSAGE } from "@/lib/edit-history/types";
import { generateExcel } from "@/lib/excel-export";
import type { ChecklistData } from "@/lib/types";

/**
 * Public export endpoint — allows editor link holders to export without auth.
 * Uses editorToken for access control.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // No column list: the export reads eighteen different fields, and hand-listing
    // them meant anything added to the workbook was silently dropped here.
    // Custom tab sheets, Attributes, Autoflows, Integrations and Tab Uploads
    // were all missing from every export for exactly this reason.
    const found = await findFullChecklistByEditorToken(token);
    if (!found.ok) {
      return found.reason === "unknown"
        ? NextResponse.json({ error: "Not found" }, { status: 404 })
        : NextResponse.json({ error: LINK_OFF_MESSAGE, code: "link_off" }, { status: 410 });
    }
    const checklist = found.checklist;

    const buffer = await generateExcel(checklist as unknown as ChecklistData);

    const filename = `${checklist.clientName.replace(/[^a-zA-Z0-9]/g, "_")}_CRM_Config.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("GET /api/export/by-token/[token] error:", err);
    return NextResponse.json({ error: "Failed to export checklist. Check database connection." }, { status: 500 });
  }
}
