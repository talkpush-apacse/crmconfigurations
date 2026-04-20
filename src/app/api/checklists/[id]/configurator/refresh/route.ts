import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import {
  ConfiguratorServiceError,
  getConfiguratorMeta,
  refreshConfiguratorSnapshot,
} from "@/lib/configurator-service";

function serviceErrorResponse(error: unknown) {
  if (error instanceof ConfiguratorServiceError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error("Configurator refresh route error:", error);
  return NextResponse.json({ error: "Failed to refresh configurator checklist" }, { status: 500 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const checklist = await prisma.checklist.findUnique({
      where: { id },
      select: { slug: true },
    });

    if (!checklist) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await refreshConfiguratorSnapshot(checklist.slug);
    const meta = await getConfiguratorMeta(checklist.slug);
    const sourceData = await prisma.checklist.findUnique({
      where: { id },
      select: {
        companyInfo: true,
        users: true,
        campaigns: true,
        sites: true,
        prescreening: true,
        messaging: true,
        sources: true,
        folders: true,
        documents: true,
        attributes: true,
        fbWhatsapp: true,
        instagram: true,
        aiCallFaqs: true,
        agencyPortal: true,
        agencyPortalUsers: true,
        autoflows: true,
        integrations: true,
      },
    });
    return NextResponse.json({ ...meta, sourceData });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
