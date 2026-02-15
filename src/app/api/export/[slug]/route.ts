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

    const checklist = await prisma.checklist.findUnique({ where: { slug } });
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
