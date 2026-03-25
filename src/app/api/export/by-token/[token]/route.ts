import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
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

    const checklist = await prisma.checklist.findUnique({
      where: { editorToken: token },
      select: {
        id: true,
        slug: true,
        clientName: true,
        companyInfo: true,
        users: true,
        campaigns: true,
        sites: true,
        prescreening: true,
        messaging: true,
        sources: true,
        folders: true,
        documents: true,
        fbWhatsapp: true,
        instagram: true,
        aiCallFaqs: true,
        agencyPortal: true,
        communicationChannels: true,
        featureToggles: true,
      },
    });
    if (!checklist) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

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
