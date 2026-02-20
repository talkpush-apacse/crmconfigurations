import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const checklist = await prisma.checklist.findUnique({ where: { id } });
    if (!checklist) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(checklist);
  } catch (err) {
    console.error("GET /api/checklists/[id] error:", err);
    return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();

    const {
      version,
      enabledTabs,
      communicationChannels,
      companyInfo,
      users,
      campaigns,
      sites,
      prescreening,
      messaging,
      sources,
      folders,
      documents,
      fbWhatsapp,
      instagram,
      aiCallFaqs,
      agencyPortal,
    } = body;

    // Optimistic locking: if version provided, check it matches
    if (version !== undefined) {
      const current = await prisma.checklist.findUnique({
        where: { id },
        select: { version: true },
      });
      if (!current) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (current.version !== version) {
        return NextResponse.json(
          { error: "Conflict: this checklist was modified by someone else. Please reload." },
          { status: 409 }
        );
      }
    }

    const checklist = await prisma.checklist.update({
      where: { id },
      data: {
        version: { increment: 1 },
        enabledTabs,
        communicationChannels,
        companyInfo,
        users,
        campaigns,
        sites,
        prescreening,
        messaging,
        sources,
        folders,
        documents,
        fbWhatsapp,
        instagram,
        aiCallFaqs,
        agencyPortal,
      },
    });

    // Return only the fields the client needs (version for optimistic locking)
    return NextResponse.json({ id: checklist.id, version: checklist.version, updatedAt: checklist.updatedAt });
  } catch (err) {
    console.error("PUT /api/checklists/[id] error:", err);
    return NextResponse.json({ error: "Failed to update checklist. Check database connection." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    await prisma.checklist.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/checklists/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete checklist. Check database connection." }, { status: 500 });
  }
}
