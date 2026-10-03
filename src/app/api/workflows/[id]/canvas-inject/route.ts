import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import type { Node, Edge } from "@xyflow/react";

type MergeStrategy = "append" | "replace_annotations";

function isAnnotationNode(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const n = node as { data?: { isAnnotation?: boolean }; type?: string };
  return n.data?.isAnnotation === true || n.type === "annotation";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    const { nodes: incomingNodes, edges: incomingEdges = [], mergeStrategy } = body as {
      nodes: Node[];
      edges?: Edge[];
      mergeStrategy: MergeStrategy;
    };

    // Validate: all injected nodes must be annotation nodes
    if (!Array.isArray(incomingNodes)) {
      return NextResponse.json(
        { error: "nodes must be an array" },
        { status: 400 }
      );
    }

    const nonAnnotation = incomingNodes.filter((n) => !isAnnotationNode(n));
    if (nonAnnotation.length > 0) {
      return NextResponse.json(
        {
          error: `canvas-inject only accepts annotation nodes. Found ${nonAnnotation.length} non-annotation node(s). Set data.isAnnotation = true on all injected nodes.`,
        },
        { status: 400 }
      );
    }

    if (mergeStrategy !== "append" && mergeStrategy !== "replace_annotations") {
      return NextResponse.json(
        { error: "mergeStrategy must be 'append' or 'replace_annotations'" },
        { status: 400 }
      );
    }

    // Fetch the current workflow
    const workflow = await prisma.workflowProject.findUnique({
      where: { id },
      select: { id: true, nodes: true, edges: true, pages: true },
    });

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Work on first-page canvas (multi-page aware)
    const pages = (workflow.pages as unknown as Array<{
      id: string;
      name: string;
      nodes: Node[];
      edges: Edge[];
      viewport: { x: number; y: number; zoom: number };
    }> | null) ?? [];

    let existingNodes = (workflow.nodes as unknown as Node[]) ?? [];
    let existingEdges = (workflow.edges as unknown as Edge[]) ?? [];

    if (mergeStrategy === "replace_annotations") {
      // Strip all existing annotation nodes and their connecting edges
      const annotationIds = new Set(
        existingNodes.filter(isAnnotationNode).map((n) => n.id)
      );
      existingNodes = existingNodes.filter((n) => !annotationIds.has(n.id));
      existingEdges = existingEdges.filter(
        (e) => !annotationIds.has(e.source) && !annotationIds.has(e.target)
      );
    }

    // Merge: prepend annotation nodes so they render behind workflow nodes
    const updatedNodes = [...incomingNodes, ...existingNodes];
    const updatedEdges = [...(incomingEdges as Edge[]), ...existingEdges];

    // Update the first page in the pages array if multi-page
    const updatedPages = pages.length > 0
      ? pages.map((page, index) =>
          index === 0
            ? { ...page, nodes: updatedNodes, edges: updatedEdges }
            : page
        )
      : [];

    // Persist
    await prisma.workflowProject.update({
      where: { id },
      data: {
        nodes: structuredClone(updatedNodes) as unknown as Prisma.InputJsonValue,
        edges: structuredClone(updatedEdges) as unknown as Prisma.InputJsonValue,
        ...(updatedPages.length > 0
          ? { pages: structuredClone(updatedPages) as unknown as Prisma.InputJsonValue }
          : {}),
        revision: { increment: 1 },
      },
    });

    return NextResponse.json({
      success: true,
      injected: incomingNodes.length,
      total: updatedNodes.length,
      nodes: updatedNodes,
      edges: updatedEdges,
    });
  } catch (err) {
    console.error("POST /api/workflows/[id]/canvas-inject error:", err);
    return NextResponse.json(
      { error: "Failed to inject canvas nodes" },
      { status: 500 }
    );
  }
}
