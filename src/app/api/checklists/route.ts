import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { getDefaultChecklistData } from "@/lib/template-data";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    // Public: fetch a single checklist by slug (for client-facing pages)
    if (slug) {
      const checklist = await prisma.checklist.findUnique({ where: { slug } });
      if (!checklist) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(checklist);
    }

    // Protected: list all checklists (all authenticated users see everything)
    const auth = requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = 50;
    const skip = (page - 1) * pageSize;

    const [items, total] = await prisma.$transaction([
      prisma.checklist.findMany({
        orderBy: { updatedAt: "desc" },
        select: { id: true, slug: true, editorToken: true, clientName: true, createdAt: true, updatedAt: true, enabledTabs: true, communicationChannels: true, featureToggles: true, version: true, isCustom: true, customSchema: true },
        take: pageSize,
        skip,
      }),
      prisma.checklist.count(),
    ]);

    return NextResponse.json({ items, total, page, pageSize });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("GET /api/checklists error:", message, err);
    return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { clientName, enabledTabs, communicationChannels, featureToggles, isCustom, customSchema } = body;

    if (!clientName) {
      return NextResponse.json({ error: "Client name is required" }, { status: 400 });
    }

    const slug = clientName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const existing = await prisma.checklist.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "A checklist with this name already exists" }, { status: 409 });
    }

    const defaults = getDefaultChecklistData();

    // Custom checklists: no standard tabs, store custom schema
    const createData: Record<string, unknown> = {
      slug,
      clientName,
      isCustom: !!isCustom,
    };

    if (isCustom) {
      createData.enabledTabs = JSON.parse(JSON.stringify([]));
      createData.customSchema = customSchema ? JSON.parse(JSON.stringify(customSchema)) : JSON.parse(JSON.stringify([]));
      createData.customData = JSON.parse(JSON.stringify({}));
    } else {
      createData.enabledTabs = enabledTabs ? JSON.parse(JSON.stringify(enabledTabs)) : null;
      createData.communicationChannels = communicationChannels ? JSON.parse(JSON.stringify(communicationChannels)) : null;
      createData.featureToggles = featureToggles ? JSON.parse(JSON.stringify(featureToggles)) : null;
      createData.companyInfo = JSON.parse(JSON.stringify(defaults.companyInfo));
      createData.users = JSON.parse(JSON.stringify(defaults.users));
      createData.campaigns = JSON.parse(JSON.stringify(defaults.campaigns));
      createData.sites = JSON.parse(JSON.stringify(defaults.sites));
      createData.prescreening = JSON.parse(JSON.stringify(defaults.prescreening));
      createData.messaging = JSON.parse(JSON.stringify(defaults.messaging));
      createData.sources = JSON.parse(JSON.stringify(defaults.sources));
      createData.folders = JSON.parse(JSON.stringify(defaults.folders));
      createData.documents = JSON.parse(JSON.stringify(defaults.documents));
      createData.fbWhatsapp = JSON.parse(JSON.stringify(defaults.fbWhatsapp));
      createData.instagram = JSON.parse(JSON.stringify(defaults.instagram));
      createData.aiCallFaqs = JSON.parse(JSON.stringify(defaults.aiCallFaqs));
      createData.agencyPortal = JSON.parse(JSON.stringify(defaults.agencyPortal));
      createData.adminSettings = JSON.parse(JSON.stringify(defaults.adminSettings));
    }

    const checklist = await prisma.checklist.create({
      data: createData as Parameters<typeof prisma.checklist.create>[0]["data"],
    });

    return NextResponse.json(checklist, { status: 201 });
  } catch (err) {
    console.error("POST /api/checklists error:", err);
    return NextResponse.json({ error: "Failed to create checklist. Check database connection." }, { status: 500 });
  }
}
