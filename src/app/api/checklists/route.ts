import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { getChecklistProgress } from "@/lib/section-status";
import type { ChecklistData } from "@/lib/types";
import { omitInternalConfigForSlug } from "@/lib/checklist-public";
import { createChecklist } from "@/lib/checklists/create-checklist";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    // Public: fetch a single checklist by slug (for client-facing pages).
    //
    // No `select` — the hand-typed allow-list this used to have was already
    // three fields behind the checklist's actual JSON columns (see
    // omitInternalConfigForSlug in @/lib/checklist-public). Fetching the full row and denying the
    // sensitive fields by name is the same pattern the sibling by-token
    // route already uses, and it can't silently drift out of sync again.
    if (slug) {
      const checklist = await prisma.checklist.findUnique({
        where: { slug },
      });
      if (!checklist) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(omitInternalConfigForSlug(checklist as unknown as Record<string, unknown>));
    }

    // Protected: list all checklists (all authenticated users see everything)
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = 50;
    const skip = (page - 1) * pageSize;
    // Archived checklists stay out of the list unless asked for (?includeArchived=true).
    const where = searchParams.get("includeArchived") === "true" ? {} : { archivedAt: null };

    const [items, total] = await prisma.$transaction([
      prisma.checklist.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          archivedAt: true,
          slug: true,
          editorToken: true,
          clientName: true,
          ownerEmail: true,
          accountId: true,
          createdAt: true,
          updatedAt: true,
          enabledTabs: true,
          tabOrder: true,
          tabFilledBy: true,
          communicationChannels: true,
          featureToggles: true,
          configuratorChecklist: true,
          version: true,
          isCustom: true,
          customSchema: true,
          customData: true,
          customTabs: true,
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
          rejectionReasons: true,
          labels: true,
          adminSettings: true,
          atsIntegrations: true,
          integrations: true,
          autoflows: true,
        },
        take: pageSize,
        skip,
      }),
      prisma.checklist.count({ where }),
    ]);

    const itemsWithProgress = items.map((item) => ({
      id: item.id,
      slug: item.slug,
      editorToken: item.editorToken,
      clientName: item.clientName,
      ownerEmail: item.ownerEmail,
      accountId: item.accountId,
      archivedAt: item.archivedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      enabledTabs: item.enabledTabs,
      communicationChannels: item.communicationChannels,
      featureToggles: item.featureToggles,
      configuratorChecklist: item.configuratorChecklist,
      version: item.version,
      isCustom: item.isCustom,
      customSchema: item.customSchema,
      customTabs: item.customTabs,
      completionSummary: getChecklistProgress(item as unknown as ChecklistData, {
        includeAdminTabs: true,
      }),
    }));

    return NextResponse.json({ items: itemsWithProgress, total, page, pageSize });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("GET /api/checklists error:", message, err);
    return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { clientName, enabledTabs, communicationChannels, featureToggles, isCustom, customSchema, customTabs, ownerEmail, accountId } = body;

    // The checks, the web address and the default content live in createChecklist (shared with Claude's create_checklist tool).
    const result = await createChecklist({ clientName, enabledTabs, communicationChannels, featureToggles, isCustom, customSchema, customTabs, ownerEmail, accountId });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json(result.checklist, { status: 201 });
  } catch (err) {
    console.error("POST /api/checklists error:", err);
    return NextResponse.json({ error: "Failed to create checklist. Check database connection." }, { status: 500 });
  }
}
