import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import {
  serializeRequirementsTemplate,
  summarizeTemplateRecord,
  type RequirementsTemplateRecord,
} from "@/lib/requirements-template-service";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get("includeArchived") === "true";

    const templates = await prisma.requirementsTemplate.findMany({
      where: includeArchived ? {} : { archived: false },
      orderBy: [{ archived: "asc" }, { updatedAt: "desc" }],
    });

    const serialized = templates.map((template) => {
      const record = template as RequirementsTemplateRecord;
      return {
        ...serializeRequirementsTemplate(record),
        summary: summarizeTemplateRecord(record),
      };
    });

    return NextResponse.json({
      count: serialized.length,
      templates: serialized,
    });
  } catch (err) {
    console.error("GET /api/requirements-templates error:", err);
    return NextResponse.json(
      { error: "Failed to load requirements templates." },
      { status: 500 },
    );
  }
}
