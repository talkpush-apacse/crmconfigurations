import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { MessagingTemplateRow } from "@/lib/types";

function toPrismaJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; templateId: string }> }
) {
  try {
    const { slug, templateId } = await params;

    if (!templateId) {
      return NextResponse.json({ error: "templateId is required" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ id: string; version: number; fieldVersions: Record<string, number> | null }>
      >`SELECT id, version, "fieldVersions" FROM "Checklist" WHERE slug = ${slug} FOR UPDATE`;

      const current = locked[0];
      if (!current) return { status: 404 as const, reason: "slug" };

      const checklist = await tx.checklist.findUnique({
        where: { id: current.id },
        select: { messaging: true },
      });

      const existing = (checklist?.messaging as unknown as MessagingTemplateRow[]) ?? [];
      const index = existing.findIndex((t) => t.id === templateId);
      if (index === -1) return { status: 404 as const, reason: "template" };

      const next = [...existing.slice(0, index), ...existing.slice(index + 1)];
      const newVersion = current.version + 1;
      const fieldVersions = { ...(current.fieldVersions ?? {}), messaging: newVersion };

      await tx.checklist.update({
        where: { id: current.id },
        data: {
          messaging: toPrismaJson(next),
          version: newVersion,
          fieldVersions: toPrismaJson(fieldVersions),
        },
      });

      return { status: 200 as const, version: newVersion, totalCount: next.length };
    });

    if (result.status === 404) {
      const error = result.reason === "slug" ? "Checklist not found" : "Template not found";
      return NextResponse.json({ error }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      deleted: templateId,
      version: result.version,
      totalCount: result.totalCount,
    });
  } catch (err) {
    console.error("DELETE /api/checklists/by-slug/[slug]/messaging/[templateId] error:", err);
    return NextResponse.json(
      { error: "Failed to delete message template" },
      { status: 500 }
    );
  }
}
