import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { CONFIGURATOR_TEMPLATE } from "@/lib/configurator-template";
import type { ConfiguratorChecklistBlob } from "@/lib/configurator-template";
import { generateConfiguratorExcel, configuratorExportFilename } from "@/lib/configurator-export";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const checklist = await prisma.checklist.findUnique({
      where: { id },
    });

    if (!checklist) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!checklist.configuratorChecklist) {
      return NextResponse.json({ error: "Configurator checklist has not been generated" }, { status: 404 });
    }

    const blob = checklist.configuratorChecklist as unknown as ConfiguratorChecklistBlob;
    const updatedByIds = Array.from(
      new Set(
        blob.items
          .map((item) => item.updatedBy)
          .filter((id): id is string => !!id && id !== "mcp")
      )
    );
    const users = updatedByIds.length > 0
      ? await prisma.adminUser.findMany({
          where: { id: { in: updatedByIds } },
          select: { id: true, email: true },
        })
      : [];
    const updatedByLabels = Object.fromEntries(users.map((user) => [user.id, user.email]));

    const buffer = await generateConfiguratorExcel({
      clientName: checklist.clientName,
      blob,
      templateItems: CONFIGURATOR_TEMPLATE,
      sourceData: checklist,
      updatedByLabels,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${configuratorExportFilename(checklist.clientName)}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/checklists/[id]/configurator/export error:", error);
    return NextResponse.json({ error: "Failed to export configurator checklist" }, { status: 500 });
  }
}
