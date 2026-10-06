import { prisma } from "@/lib/db";
import { buildClientWorkflowDto, type ClientWorkflowDto } from "./client-view";
import type { ActingAs } from "./actor";
import { listComments, type CommentView } from "./comments-service";
import { listSuggestions, type SuggestionView } from "./suggestions-service";
import { can } from "./permissions";

/**
 * Everything the client page needs in one object, built on the server for ONE visitor.
 * Which copy of the diagram they get:
 *   - editors always work on the live canvas (they are changing it);
 *   - everyone else sees the published version if staff published one, otherwise the live canvas.
 */

export interface ClientPagePayload {
  workflow: ClientWorkflowDto;
  /** What is being shown: a frozen published version or the live canvas. */
  view: { kind: "live" | "published"; versionId: string | null; versionNumber: number | null; publishedAt: Date | null; publishedBy: string | null };
  /** The number an editor sends back with every change so a clash with someone else is noticed. */
  revision: number;
  you: {
    level: string;
    editMode: string;
    canEdit: boolean;
    canSuggest: boolean;
    canComment: boolean;
    canApprove: boolean;
    canAcceptSuggestions: boolean;
    displayName: string | null;
    needsName: boolean;
    verified: boolean;
  };
  comments: CommentView[];
  suggestions: SuggestionView[];
  /** The page's own latest decision (no names). */
  latestDecision: { action: string; versionNumber: number | null; createdAt: Date } | null;
}

export async function buildClientPagePayload(workflowId: string, who: ActingAs, opts: { needsName: boolean; pinnedVersionId?: string | null }): Promise<ClientPagePayload | null> {
  const workflow = await prisma.workflowProject.findUnique({
    where: { id: workflowId },
    include: { feedback: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!workflow) return null;

  const shownVersionId = opts.pinnedVersionId ?? workflow.publishedVersionId;
  const wantsPublished = who.principal.level !== "editor" && who.principal.level !== "admin" && shownVersionId;
  let source: { nodes: unknown; edges: unknown; viewport: unknown; pages: unknown } = workflow;
  let view: ClientPagePayload["view"] = { kind: "live", versionId: null, versionNumber: null, publishedAt: null, publishedBy: null };

  if (wantsPublished) {
    const version = await prisma.workflowVersion.findFirst({ where: { id: shownVersionId!, workflowId } });
    if (version) {
      const pages = Array.isArray(version.pages)
        ? version.pages
        : [{ id: "page_1", name: "Page 1", nodes: version.nodes, edges: version.edges, viewport: version.viewport ?? workflow.viewport }];
      source = { nodes: version.nodes, edges: version.edges, viewport: version.viewport ?? workflow.viewport, pages };
      view = { kind: "published", versionId: version.id, versionNumber: version.versionNumber, publishedAt: version.createdAt, publishedBy: version.createdByName };
    }
  }

  const latest = workflow.feedback[0];
  const latestVersion = latest?.versionId
    ? await prisma.workflowVersion.findUnique({ where: { id: latest.versionId }, select: { versionNumber: true } })
    : null;

  const dto = buildClientWorkflowDto(
    {
      id: workflow.id, clientName: workflow.clientName, workflowName: workflow.workflowName, description: workflow.description,
      status: workflow.status, updatedAt: workflow.updatedAt, nodes: source.nodes, edges: source.edges, viewport: source.viewport,
      pages: source.pages, showFeasibility: workflow.showFeasibility, diagramStyle: workflow.diagramStyle, look: workflow.look,
    },
    [],
    null
  );

  const p = who.principal;
  const [comments, suggestions] = await Promise.all([listComments(workflowId, who), listSuggestions(workflowId, who)]);
  return {
    workflow: dto,
    view,
    revision: workflow.revision,
    you: {
      level: p.level,
      editMode: p.editMode,
      canEdit: can(p, "canvas.edit"),
      canSuggest: can(p, "canvas.suggest"),
      canComment: can(p, "comment.create"),
      canApprove: can(p, "approve"),
      canAcceptSuggestions: can(p, "suggestion.accept"),
      displayName: who.identity.displayName,
      needsName: opts.needsName,
      verified: who.identity.verified,
    },
    comments,
    suggestions: p.level === "viewer" ? [] : suggestions,
    latestDecision: latest ? { action: latest.action, versionNumber: latestVersion?.versionNumber ?? null, createdAt: latest.createdAt } : null,
  };
}
