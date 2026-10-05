import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import {
  serializeRequirementsTemplate,
  summarizeTemplateRecord,
  type RequirementsTemplateRecord,
} from "@/lib/requirements-template-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const template = await prisma.requirementsTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const record = template as RequirementsTemplateRecord;
    return NextResponse.json({
      ...serializeRequirementsTemplate(record),
      summary: summarizeTemplateRecord(record),
    });
  } catch (err) {
    console.error("GET /api/requirements-templates/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to load requirements template." },
      { status: 500 },
    );
  }
}
