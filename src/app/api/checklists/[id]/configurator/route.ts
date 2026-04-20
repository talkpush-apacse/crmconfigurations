import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import {
  ConfiguratorServiceError,
  generateConfiguratorChecklist,
  getConfiguratorMeta,
  updateConfiguratorItem,
} from "@/lib/configurator-service";

const statusSchema = z.enum(["completed", "in_progress", "in_progress_with_dependency", "blocked"]).nullable();

const patchSchema = z.object({
  itemId: z.string().min(1),
  status: statusSchema,
  notes: z.string().nullable(),
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

async function getSourceData(id: string) {
  return prisma.checklist.findUnique({
    where: { id },
    select: {
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
      autoflows: true,
      integrations: true,
    },
  });
}

function serviceErrorResponse(error: unknown) {
  if (error instanceof ConfiguratorServiceError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error("Configurator route error:", error);
  return NextResponse.json({ error: "Failed to process configurator checklist" }, { status: 500 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const row = await getSlugForId(id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const meta = await getConfiguratorMeta(row.slug);
    return NextResponse.json({ ...meta, sourceData: await getSourceData(id) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const row = await getSlugForId(id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await generateConfiguratorChecklist(row.slug);
    const meta = await getConfiguratorMeta(row.slug);
    return NextResponse.json({ ...meta, sourceData: await getSourceData(id) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
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

    const item = await updateConfiguratorItem(row.slug, {
      itemId: parsed.data.itemId,
      status: parsed.data.status,
      notes: parsed.data.notes,
      updatedBy: auth.userId,
    });

    const updated = await getSlugForId(id);
    return NextResponse.json({ item, version: updated?.version ?? row.version + 1 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
