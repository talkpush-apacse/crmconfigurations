import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

const LIST_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

type NodeCountRow = {
  id: string;
  nodeCount: number | bigint;
};

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const industry = searchParams.get("industry");

    const where: Record<string, unknown> = {};
    if (industry && industry !== "all") {
      where.industry = industry;
    }

    const templates = await prisma.workflowTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        industry: true,
        createdAt: true,
      },
    });

    const templateIds = templates.map((template) => template.id);
    const nodeCounts =
      templateIds.length > 0
        ? await prisma.$queryRaw<NodeCountRow[]>(Prisma.sql`
            SELECT
              "id",
              jsonb_array_length(
                CASE
                  WHEN jsonb_typeof("nodes") = 'array' THEN "nodes"
                  ELSE '[]'::jsonb
                END
              ) AS "nodeCount"
            FROM "WorkflowTemplate"
            WHERE "id" IN (${Prisma.join(templateIds)})
          `)
        : [];
    const nodeCountById = new Map(
      nodeCounts.map(({ id, nodeCount }) => [id, Number(nodeCount)])
    );
    const items = templates.map((template) => ({
      ...template,
      nodeCount: nodeCountById.get(template.id) ?? 0,
    }));

    return NextResponse.json({ items }, { headers: LIST_CACHE_HEADERS });
  } catch (err) {
    console.error("GET /api/workflows/templates error:", err);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { name, description, industry, nodes, edges } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Template name is required" },
        { status: 400 }
      );
    }

    const template = await prisma.workflowTemplate.create({
      data: {
        name,
        description: description || null,
        industry: industry || "general",
        nodes: structuredClone(nodes || []) as unknown as Prisma.InputJsonValue,
        edges: structuredClone(edges || []) as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json(
      { id: template.id, name: template.name },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/workflows/templates error:", err);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
