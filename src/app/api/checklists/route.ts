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

    // Protected: list all checklists (admin only)
    const auth = requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const checklists = await prisma.checklist.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, slug: true, clientName: true, createdAt: true, updatedAt: true, enabledTabs: true },
    });
    return NextResponse.json(checklists);
  } catch (err) {
    console.error("GET /api/checklists error:", err);
    return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { clientName, enabledTabs } = body;

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
    const checklist = await prisma.checklist.create({
      data: {
        slug,
        clientName,
        enabledTabs: enabledTabs ? JSON.parse(JSON.stringify(enabledTabs)) : null,
        companyInfo: JSON.parse(JSON.stringify(defaults.companyInfo)),
        users: JSON.parse(JSON.stringify(defaults.users)),
        campaigns: JSON.parse(JSON.stringify(defaults.campaigns)),
        sites: JSON.parse(JSON.stringify(defaults.sites)),
        prescreening: JSON.parse(JSON.stringify(defaults.prescreening)),
        messaging: JSON.parse(JSON.stringify(defaults.messaging)),
        sources: JSON.parse(JSON.stringify(defaults.sources)),
        folders: JSON.parse(JSON.stringify(defaults.folders)),
        documents: JSON.parse(JSON.stringify(defaults.documents)),
        fbWhatsapp: JSON.parse(JSON.stringify(defaults.fbWhatsapp)),
        instagram: JSON.parse(JSON.stringify(defaults.instagram)),
        aiCallFaqs: JSON.parse(JSON.stringify(defaults.aiCallFaqs)),
        agencyPortal: JSON.parse(JSON.stringify(defaults.agencyPortal)),
      },
    });

    return NextResponse.json(checklist, { status: 201 });
  } catch (err) {
    console.error("POST /api/checklists error:", err);
    return NextResponse.json({ error: "Failed to create checklist. Check database connection." }, { status: 500 });
  }
}
