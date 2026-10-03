import { prisma } from "@/lib/db";
import type { VersionTrigger } from "./types";

interface CreateVersionSnapshotParams {
  workflowId: string;
  triggeredBy: VersionTrigger;
  triggerDetail?: string;
  createdByName?: string;
  createdByMemberId?: string;
  label?: string;
}

export async function createVersionSnapshot(params: CreateVersionSnapshotParams) {
  return prisma.$transaction(async (tx) => {
    const workflow = await tx.workflowProject.findUniqueOrThrow({
      where: { id: params.workflowId },
      select: {
        currentVersion: true,
        nodes: true,
        edges: true,
        viewport: true,
        pages: true,
        status: true,
        revision: true,
      },
    });

    const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
    const edges = Array.isArray(workflow.edges) ? workflow.edges : [];
    const viewport =
      workflow.viewport && typeof workflow.viewport === "object"
        ? workflow.viewport
        : { x: 0, y: 0, zoom: 1 };
    const pages = Array.isArray(workflow.pages) ? workflow.pages : [];

    // Aggregate node/edge counts across all pages so version cards reflect
    // the full multi-page workflow, not just the legacy mirrored fields.
    let nodeCount = nodes.length;
    let edgeCount = edges.length;
    if (pages.length > 0) {
      nodeCount = 0;
      edgeCount = 0;
      for (const page of pages as Array<{ nodes?: unknown[]; edges?: unknown[] }>) {
        if (Array.isArray(page?.nodes)) nodeCount += page.nodes.length;
        if (Array.isArray(page?.edges)) edgeCount += page.edges.length;
      }
    }

    const nextVersion = workflow.currentVersion + 1;

    const version = await tx.workflowVersion.create({
      data: {
        workflowId: params.workflowId,
        versionNumber: nextVersion,
        label: params.label ?? null,
        status: workflow.status,
        triggeredBy: params.triggeredBy,
        triggerDetail: params.triggerDetail ?? null,
        createdByName: params.createdByName ?? null,
        createdByMemberId: params.createdByMemberId ?? null,
        revision: workflow.revision,
        nodes,
        edges,
        viewport,
        pages: pages.length > 0 ? pages : undefined,
        nodeCount,
        edgeCount,
      },
    });

    await tx.workflowProject.update({
      where: { id: params.workflowId },
      data: { currentVersion: nextVersion },
    });

    return version;
  });
}
