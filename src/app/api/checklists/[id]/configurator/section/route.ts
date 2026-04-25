import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import {
  ConfiguratorServiceError,
  updateConfiguratorSectionStatus,
} from "@/lib/configurator-service";

const patchSchema = z.object({
  section: z.string().min(1),
  configured: z.boolean(),
  version: z.number().int().nonnegative(),
});

async function getSlugForId(id: string) {
  const checklist = await prisma.checklist.findUnique({
    where: { id },
    select: {
      slug: true,
      version: true,
      configuratorChecklist: true,
    },
  });

  if (!checklist) return null;
  return checklist;
}

function serviceErrorResponse(error: unknown) {
  if (error instanceof ConfiguratorServiceError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error("Configurator section route error:", error);
  return NextResponse.json({ error: "Failed to process configurator section status" }, { status: 500 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const row = await getSlugForId(id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (row.version !== parsed.data.version) {
      return NextResponse.json(
        {
          error: "Conflict: this checklist was modified by someone else.",
          configuratorChecklist: row.configuratorChecklist,
          version: row.version,
        },
        { status: 409 }
      );
    }

    const section = await updateConfiguratorSectionStatus(row.slug, {
      section: parsed.data.section,
      configured: parsed.data.configured,
      updatedBy: auth.userId,
    });

    const updated = await getSlugForId(id);
    return NextResponse.json({ section, version: updated?.version ?? row.version + 1 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
