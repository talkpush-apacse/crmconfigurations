import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { sanitizeText } from "@/lib/workflow/text";
import { applyLayout, layoutProcessMap } from "@/lib/workflow/process-map/layout";

type NodeCountRow = {
  id: string;
  nodeCount: number | bigint;
};

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (status && status !== "all") {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { clientName: { contains: search, mode: "insensitive" } },
        { workflowName: { contains: search, mode: "insensitive" } },
      ];
    }

    const workflows = await prisma.workflowProject.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        clientName: true,
        workflowName: true,
        description: true,
        status: true,
        currentVersion: true,
        createdAt: true,
        updatedAt: true,
        feedback: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            action: true,
            reviewerName: true,
            createdAt: true,
          },
        },
      },
    });

    const workflowIds = workflows.map((workflow) => workflow.id);
    const nodeCounts =
      workflowIds.length > 0
        ? await prisma.$queryRaw<NodeCountRow[]>(Prisma.sql`
            SELECT
              "id",
              jsonb_array_length(
                CASE
                  WHEN jsonb_typeof("nodes") = 'array' THEN "nodes"
                  ELSE '[]'::jsonb
                END
              ) AS "nodeCount"
            FROM "WorkflowProject"
            WHERE "id" IN (${Prisma.join(workflowIds)})
          `)
        : [];
    const nodeCountById = new Map(
      nodeCounts.map(({ id, nodeCount }) => [id, Number(nodeCount)])
    );
    // What needs a person's attention on each workflow: open comments, suggestions waiting, access requests.
    const [commentRows, suggestionRows, requestRows] =
      workflowIds.length > 0
        ? await Promise.all([
            prisma.workflowComment.groupBy({ by: ["workflowId"], where: { workflowId: { in: workflowIds }, status: "open", parentId: null }, _count: { _all: true } }),
            prisma.workflowSuggestion.groupBy({ by: ["workflowId"], where: { workflowId: { in: workflowIds }, status: "pending" }, _count: { _all: true } }),
            prisma.workflowAccessRequest.groupBy({ by: ["workflowId"], where: { workflowId: { in: workflowIds }, status: "open" }, _count: { _all: true } }),
          ])
        : [[], [], []];
    const countMap = (rows: { workflowId: string; _count: { _all: number } }[]) => new Map(rows.map((r) => [r.workflowId, r._count._all]));
    const comments = countMap(commentRows);
    const suggestions = countMap(suggestionRows);
    const requests = countMap(requestRows);
    const items = workflows.map((workflow) => ({
      ...workflow,
      nodeCount: nodeCountById.get(workflow.id) ?? 0,
      attention: {
        openComments: comments.get(workflow.id) ?? 0,
        pendingSuggestions: suggestions.get(workflow.id) ?? 0,
        openRequests: requests.get(workflow.id) ?? 0,
      },
    }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error("GET /api/workflows error:", err);
    return NextResponse.json(
      { error: "Failed to fetch workflows" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { clientName, workflowName, description, templateId } = body;
    // New workflows use the Process Map style unless the caller asks for the original look.
    const diagramStyle: "classic" | "process_map" = body.diagramStyle === "classic" ? "classic" : "process_map";
    const sanitizedClientName =
      typeof clientName === "string" ? sanitizeText(clientName) : "";
    const sanitizedWorkflowName =
      typeof workflowName === "string" ? sanitizeText(workflowName) : "";
    const sanitizedDescription =
      typeof description === "string" ? sanitizeText(description) : "";

    if (!sanitizedClientName || !sanitizedWorkflowName) {
      return NextResponse.json(
        { error: "Client name and workflow name are required" },
        { status: 400 }
      );
    }

    let nodes: unknown = [];
    let edges: unknown = [];

    if (templateId) {
      const template = await prisma.workflowTemplate.findUnique({
        where: { id: templateId },
        select: { nodes: true, edges: true },
      });
      if (template) {
        nodes = template.nodes;
        edges = template.edges;
        // Templates were drawn for the original look; arrange them for the Process Map so they open tidy.
        if (diagramStyle === "process_map" && Array.isArray(nodes) && Array.isArray(edges) && nodes.length > 0) {
          const laid = applyLayout(nodes as never[], edges as never[], layoutProcessMap(nodes as never[], edges as never[]));
          nodes = laid.nodes;
          edges = laid.edges;
        }
      }
    }

    // Always seed a default "Page 1" so the editor has a stable structure to
    // load. Editor manages add/rename/delete from there.
    const initialPage = {
      id: `page_${Math.random().toString(36).slice(2, 12)}`,
      name: "Page 1",
      nodes: structuredClone(nodes) as unknown as Prisma.InputJsonValue,
      edges: structuredClone(edges) as unknown as Prisma.InputJsonValue,
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const workflow = await prisma.workflowProject.create({
      data: {
        clientName: sanitizedClientName,
        workflowName: sanitizedWorkflowName,
        description: sanitizedDescription || null,
        templateId: templateId || null,
        diagramStyle,
        numberingScheme: diagramStyle === "process_map" ? "decimal" : "letters",
        nodes: structuredClone(nodes) as unknown as Prisma.InputJsonValue,
        edges: structuredClone(edges) as unknown as Prisma.InputJsonValue,
        pages: [initialPage],
      },
    });

    return NextResponse.json(
      { id: workflow.id, status: workflow.status },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/workflows error:", err);
    return NextResponse.json(
      { error: "Failed to create workflow" },
      { status: 500 }
    );
  }
}
