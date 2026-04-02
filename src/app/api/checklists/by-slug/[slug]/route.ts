import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CHECKLIST_JSON_FIELDS, type ChecklistJsonField } from "@/lib/types";

const JSON_FIELDS_SET = new Set<string>(CHECKLIST_JSON_FIELDS);

/**
 * Public PUT endpoint — allows clients (no auth) to save checklist data by slug.
 * Mirrors the auth-protected PUT /api/checklists/[id] but uses slug for access control.
 * Only someone with the slug (i.e. the shared link) can save.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Look up checklist by slug
    const existing = await prisma.checklist.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const id = existing.id;
    const body = await request.json();

    const { version, changedFields } = body as {
      version?: number;
      changedFields?: string[];
    };

    // --- Field-level merge path ---
    if (changedFields && Array.isArray(changedFields) && changedFields.length > 0 && version !== undefined) {
      const validFields = changedFields.filter((f) => JSON_FIELDS_SET.has(f)) as ChecklistJsonField[];
      if (validFields.length === 0) {
        return NextResponse.json({ error: "No valid fields in changedFields" }, { status: 400 });
      }

      const result = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{
          id: string;
          version: number;
          fieldVersions: Record<string, number> | null;
        }>>`SELECT id, version, "fieldVersions" FROM "Checklist" WHERE id = ${id} FOR UPDATE`;

        const current = rows[0];
        if (!current) return { status: 404 as const };

        const currentFieldVersions = (current.fieldVersions ?? {}) as Record<string, number>;

        const conflictedFields: string[] = [];
        for (const field of validFields) {
          const fieldVer = currentFieldVersions[field] ?? 0;
          if (fieldVer > version) {
            conflictedFields.push(field);
          }
        }

        if (conflictedFields.length > 0) {
          return { status: 409 as const, conflictedFields, currentVersion: current.version };
        }

        const newVersion = current.version + 1;
        const updateData: Record<string, unknown> = { version: newVersion };
        const updatedFieldVersions = { ...currentFieldVersions };

        for (const field of validFields) {
          updateData[field] = body[field];
          updatedFieldVersions[field] = newVersion;
        }
        updateData.fieldVersions = updatedFieldVersions;

        const checklist = await tx.checklist.update({
          where: { id },
          data: updateData,
        });

        return { status: 200 as const, checklist };
      });

      if (result.status === 404) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (result.status === 409) {
        return NextResponse.json(
          {
            error: "Conflict on specific fields",
            conflictedFields: result.conflictedFields,
            currentVersion: result.currentVersion,
          },
          { status: 409 }
        );
      }

      return NextResponse.json({
        id: result.checklist.id,
        version: result.checklist.version,
        updatedAt: result.checklist.updatedAt,
      });
    }

    // --- Legacy whole-document path ---
    const {
      enabledTabs,
      tabOrder,
      communicationChannels,
      featureToggles,
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
      agencyPortalUsers,
      adminSettings,
    } = body;

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

    const allFieldVersions: Record<string, number> = {};
    for (const f of CHECKLIST_JSON_FIELDS) {
      allFieldVersions[f] = (version ?? 0) + 1;
    }

    const checklist = await prisma.checklist.update({
      where: { id },
      data: {
        version: { increment: 1 },
        fieldVersions: allFieldVersions,
        enabledTabs,
        tabOrder,
        communicationChannels,
        featureToggles,
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
        agencyPortalUsers,
        adminSettings,
      },
    });

    return NextResponse.json({ id: checklist.id, version: checklist.version, updatedAt: checklist.updatedAt });
  } catch (err) {
    console.error("PUT /api/checklists/by-slug/[slug] error:", err);
    return NextResponse.json({ error: "Failed to update checklist. Check database connection." }, { status: 500 });
  }
}
