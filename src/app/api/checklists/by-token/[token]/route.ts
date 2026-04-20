import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CHECKLIST_JSON_FIELDS, type ChecklistJsonField } from "@/lib/types";

const PUBLIC_JSON_FIELDS = CHECKLIST_JSON_FIELDS.filter(
  (field) => field !== "atsIntegrations" && field !== "integrations"
);
const JSON_FIELDS_SET = new Set<string>(PUBLIC_JSON_FIELDS);

function toPrismaJson(value: unknown) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function omitInternalConfig<T extends Record<string, unknown>>(checklist: T) {
  const publicChecklist = { ...checklist };
  delete publicChecklist.atsIntegrations;
  delete publicChecklist.integrations;
  delete publicChecklist.configuratorChecklist;
  // editorToken is already known to the caller; don't echo it back
  delete publicChecklist.editorToken;
  return publicChecklist;
}

/**
 * Public GET endpoint — fetch a checklist by its unguessable editor token.
 * No auth required — the token itself is the access control.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const checklist = await prisma.checklist.findUnique({
      where: { editorToken: token },
    });
    if (!checklist) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(omitInternalConfig(checklist as unknown as Record<string, unknown>));
  } catch (err) {
    console.error("GET /api/checklists/by-token/[token] error:", err);
    return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
  }
}

/**
 * Public PUT endpoint — allows editor link holders (no auth) to save checklist data by token.
 * Mirrors the auth-protected PUT /api/checklists/[id] but uses editorToken for access control.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Look up checklist by editorToken
    const existing = await prisma.checklist.findUnique({
      where: { editorToken: token },
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
          updateData[field] = toPrismaJson(body[field]);
          updatedFieldVersions[field] = newVersion;
        }
        updateData.fieldVersions = toPrismaJson(updatedFieldVersions);

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
      attributes,
      fbWhatsapp,
      instagram,
      aiCallFaqs,
      agencyPortal,
      agencyPortalUsers,
      rejectionReasons,
      labels,
      adminSettings,
      tabUploadMeta,
      customSchema,
      customData,
      customTabs,
      autoflows,
    } = body;

    // Version is required for all writes — reject versionless saves to prevent silent overwrites
    if (version === undefined) {
      return NextResponse.json({ error: "Version is required for updates" }, { status: 400 });
    }

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

    const allFieldVersions: Record<string, number> = {};
    for (const f of PUBLIC_JSON_FIELDS) {
      allFieldVersions[f] = version + 1;
    }

    const checklist = await prisma.checklist.update({
      where: { id },
      data: {
        version: { increment: 1 },
        fieldVersions: toPrismaJson(allFieldVersions),
        enabledTabs: toPrismaJson(enabledTabs),
        tabOrder: toPrismaJson(tabOrder),
        tabFilledBy: toPrismaJson(tabFilledBy),
        communicationChannels: toPrismaJson(communicationChannels),
        featureToggles: toPrismaJson(featureToggles),
        companyInfo: toPrismaJson(companyInfo),
        users: toPrismaJson(users),
        campaigns: toPrismaJson(campaigns),
        sites: toPrismaJson(sites),
        prescreening: toPrismaJson(prescreening),
        messaging: toPrismaJson(messaging),
        sources: toPrismaJson(sources),
        folders: toPrismaJson(folders),
        documents: toPrismaJson(documents),
        attributes: toPrismaJson(attributes),
        fbWhatsapp: toPrismaJson(fbWhatsapp),
        instagram: toPrismaJson(instagram),
        aiCallFaqs: toPrismaJson(aiCallFaqs),
        agencyPortal: toPrismaJson(agencyPortal),
        agencyPortalUsers: toPrismaJson(agencyPortalUsers),
        rejectionReasons: toPrismaJson(rejectionReasons),
        labels: toPrismaJson(labels),
        adminSettings: toPrismaJson(adminSettings),
        tabUploadMeta: toPrismaJson(tabUploadMeta),
        customSchema: toPrismaJson(customSchema),
        customData: toPrismaJson(customData),
        customTabs: toPrismaJson(customTabs),
        autoflows: toPrismaJson(autoflows),
      },
    });

    return NextResponse.json({ id: checklist.id, version: checklist.version, updatedAt: checklist.updatedAt });
  } catch (err) {
    console.error("PUT /api/checklists/by-token/[token] error:", err);
    return NextResponse.json({ error: "Failed to update checklist. Check database connection." }, { status: 500 });
  }
}
