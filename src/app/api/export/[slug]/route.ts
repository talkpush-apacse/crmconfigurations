import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateExcel } from "@/lib/excel-export";
import type { ChecklistData } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
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
}
