import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { CHECKLIST_JSON_FIELDS, type ChecklistJsonField } from "@/lib/types";

const JSON_FIELDS_SET = new Set<string>(CHECKLIST_JSON_FIELDS);

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

    // Payload size guard (5MB limit)
    const bodyStr = JSON.stringify(body);
    if (bodyStr.length > 5_000_000) {
      return NextResponse.json({ error: "Request payload too large" }, { status: 413 });
    }

    const { version, changedFields } = body as {
      version?: number;
      changedFields?: string[];
    };

    // Version is required for all updates
    if (version === undefined) {
      return NextResponse.json({ error: "Version is required for updates" }, { status: 400 });
    }

    // --- Field-level merge path (new) ---
    if (changedFields && Array.isArray(changedFields) && changedFields.length > 0) {
      const validFields = changedFields.filter((f) => JSON_FIELDS_SET.has(f)) as ChecklistJsonField[];
      if (validFields.length === 0) {
        return NextResponse.json({ error: "No valid fields in changedFields" }, { status: 400 });
      }

      // Transaction with row-level lock to prevent race conditions
      const result = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{
          id: string;
          version: number;
          fieldVersions: Record<string, number> | null;
        }>>`SELECT id, version, "fieldVersions" FROM "Checklist" WHERE id = ${id} FOR UPDATE`;

        const current = rows[0];
        if (!current) return { status: 404 as const };

        const currentFieldVersions = (current.fieldVersions ?? {}) as Record<string, number>;

        // Check for conflicts: fields modified after the client's version
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

        // No conflicts — partial update with only the changed fields
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

    // --- Legacy whole-document path (backward compatible) ---
    const {
      enabledTabs,
      tabOrder,
      tabFilledBy,
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
      tabUploadMeta,
      customSchema,
      customData,
      customTabs,
    } = body;

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

    // Update all fields + set all fieldVersions to the new version
    const allFieldVersions: Record<string, number> = {};
    for (const f of CHECKLIST_JSON_FIELDS) {
      allFieldVersions[f] = version + 1;
    }

    const checklist = await prisma.checklist.update({
      where: { id },
      data: {
        version: { increment: 1 },
        fieldVersions: allFieldVersions,
        enabledTabs,
        tabOrder,
        tabFilledBy,
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
        tabUploadMeta,
        customSchema,
        customData,
        customTabs,
      },
    });

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
