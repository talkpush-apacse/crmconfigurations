import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import type { CustomTab } from "@/lib/types";
import {
  buildCustomTabFromTemplate,
  serializeRequirementsTemplate,
  summarizeTemplateRecord,
  type RequirementsTemplateRecord,
} from "@/lib/requirements-template-service";

function toPrismaJson(value: unknown) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();
    const templateId = String(body.templateId ?? "").trim();

    if (!templateId) {
      return NextResponse.json({ error: "templateId is required" }, { status: 400 });
    }

    const template = await prisma.requirementsTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    if (template.archived) {
      return NextResponse.json(
        { error: "Archived templates cannot be applied. Unarchive it first." },
        { status: 400 },
      );
    }

    const templateRecord = template as RequirementsTemplateRecord;

    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{
        id: string;
        version: number;
        customTabs: unknown;
        tabFilledBy: unknown;
        fieldVersions: Record<string, number> | null;
      }>>`SELECT id, version, "customTabs", "tabFilledBy", "fieldVersions" FROM "Checklist" WHERE id = ${id} FOR UPDATE`;

      const current = rows[0];
      if (!current) return { status: 404 as const };

      const existingTabs = Array.isArray(current.customTabs)
        ? (current.customTabs as CustomTab[])
        : [];
      const applied = buildCustomTabFromTemplate(templateRecord, existingTabs, {
        tabNameOverride: typeof body.tabNameOverride === "string" ? body.tabNameOverride : undefined,
        descriptionOverride:
          typeof body.descriptionOverride === "string" ? body.descriptionOverride : undefined,
        tabIconOverride: typeof body.tabIconOverride === "string" ? body.tabIconOverride : undefined,
      });

      const newVersion = current.version + 1;
      const nextTabFilledBy = {
        ...((current.tabFilledBy as Record<string, "talkpush" | "client"> | null) ?? {}),
        [applied.urlSlug]: "client" as const,
      };
      const nextFieldVersions = {
        ...(current.fieldVersions ?? {}),
        customTabs: newVersion,
        tabFilledBy: newVersion,
      };

      await tx.checklist.update({
        where: { id },
        data: {
          version: newVersion,
          customTabs: toPrismaJson([...existingTabs, applied.customTab]),
          tabFilledBy: toPrismaJson(nextTabFilledBy),
          fieldVersions: toPrismaJson(nextFieldVersions),
        },
      });

      return {
        status: 200 as const,
        version: newVersion,
        applied,
      };
    });

    if (result.status === 404) {
      return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
    }

    return NextResponse.json({
      appliedTab: {
        id: result.applied.customTab.id,
        slug: result.applied.customTab.slug,
        urlSlug: result.applied.urlSlug,
        label: result.applied.customTab.label,
        templateSource: result.applied.customTab.templateSource,
        summary: result.applied.summary,
      },
      template: {
        ...serializeRequirementsTemplate(templateRecord),
        summary: summarizeTemplateRecord(templateRecord),
      },
      version: result.version,
    });
  } catch (err) {
    console.error("POST /api/checklists/[id]/requirements-templates/apply error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to apply requirements template." },
      { status: 500 },
    );
  }
}
