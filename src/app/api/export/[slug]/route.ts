import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { generateExcel } from "@/lib/excel-export";
import type { ChecklistData } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { slug } = await params;

    // Note: this app uses a shared admin pool — all authenticated admins have access
    // to all checklists. If per-user ownership is added in future, scope this query
    // with: where: { slug, createdBy: auth.userId } after adding a createdBy column.
    const checklist = await prisma.checklist.findUnique({
      where: { slug },
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
    console.error("GET /api/export/[slug] error:", err);
    return NextResponse.json({ error: "Failed to export checklist. Check database connection." }, { status: 500 });
  }
}
