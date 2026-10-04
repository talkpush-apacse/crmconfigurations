import { prisma } from "@/lib/db";
import { callV2Tool } from "@/lib/workflow/tool-handlers-v2";
import { recordAudit } from "@/lib/workflow/access/audit";
import { nanoid } from "@/lib/workflow/ids";
import type { Prisma } from "@/generated/prisma/client";
import { getLayoutedElements } from "@/lib/workflow/layout";
import { computeStepNumbers } from "@/lib/workflow/numbering";
import { computeNumbers, type NumberingScheme } from "@/lib/workflow/numbering-decimal";
import { validateWorkflow } from "@/lib/workflow/validation";
import { createVersionSnapshot } from "@/lib/workflow/versioning";
import { applyLayout, layoutDiagram, positionForNewNote } from "@/lib/workflow/process-map/diagram-layout";
import { lintLayout } from "@/lib/workflow/process-map/lint";
import { buildScene } from "@/lib/workflow/process-map/scene";
import { lintPagesForClient } from "@/lib/workflow/access/client-view";
import {
  createManyScopingArtifacts,
  createScopingArtifact,
  deleteScopingArtifact,
  generateCustomerSummaryText,
  isScopingArtifactKind,
  isScopingArtifactStatus,
  listScopingArtifacts,
  ScopingInputError,
  updateScopingArtifact,
} from "@/lib/workflow/scoping";
import {
  type FlowEdge,
  type FlowNode,
  createWorkflowEdge,
  createWorkflowNode,
  getCanvas,
  isActorType,
  isWorkflowNodeType,
  normalizeCustomColor,
  normalizeEdgeData,
  normalizeFeasibility,
  updateFirstPage,
  jsonClone,
  pageContext,
  processMapFields,
} from "@/lib/workflow/helpers";
import type {
  ScopingArtifactKind,
  ScopingArtifactStatus,
  WorkflowEdgeData,
  WorkflowNodeData,
  WorkflowSpecArtifactInput,
  WorkflowSpecEdgeInput,
  WorkflowSpecInput,
  WorkflowSpecNodeInput,
  WorkflowValidationFinding,
} from "@/lib/workflow/types";

type ToolContext = {
  origin: string;
  /** Who is calling, for the audit trail ("Claude for someone@example.com"). */
  actor?: string;
};

/** Tools that only look. Everything else changes a workflow and is recorded in its audit trail. */
const READ_ONLY_TOOLS = new Set([
  "list_workflows", "get_workflow", "list_templates", "get_template", "list_versions", "list_scoping_artifacts",
  "validate_workflow", "renumber_steps", "list_pages", "get_flow_table", "run_gap_check", "lint_layout", "render_preview",
  "diff_versions", "list_access", "list_suggestions", "list_comments",
]);

/** Changes that touch many steps at once. A snapshot is taken first, so nothing a person did by hand can be lost. */
const SNAPSHOT_FIRST_TOOLS = new Set(["auto_layout", "delete_node", "design_campaign_structure", "clear_campaign_structure", "create_workflow_from_flow_table", "set_diagram_style", "set_diagram_layout", "delete_page"]);

export class McpToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpToolInputError";
  }
}

export class McpToolNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpToolNotFoundError";
  }
}

type ToolArguments = Record<string, unknown>;

export async function callWorkflowTool(
  name: string,
  args: unknown,
  context: ToolContext
) {
  const input = asObject(args);
  const workflowId = typeof input.workflowId === "string" ? input.workflowId : undefined;
  const mutating = Boolean(workflowId) && !READ_ONLY_TOOLS.has(name);

  if (mutating && workflowId) {
    // Optional guard: refuse to change a workflow that moved on since the caller read it.
    if (typeof input.baseRevision === "number") {
      const current = await prisma.workflowProject.findUnique({ where: { id: workflowId }, select: { revision: true } });
      if (current && current.revision !== input.baseRevision) {
        throw new McpToolInputError(
          `This workflow changed since you read it (it is at revision ${current.revision}, you had ${input.baseRevision}). Read it again with get_workflow (it shows the current revision), then repeat the change.`
        );
      }
    }
    if (SNAPSHOT_FIRST_TOOLS.has(name)) {
      try {
        const hasContent = await prisma.workflowProject.findUnique({ where: { id: workflowId }, select: { pages: true } });
        if (hasContent && JSON.stringify(hasContent.pages).length > 20) {
          await createVersionSnapshot({ workflowId, triggeredBy: "manual", triggerDetail: `Before ${name} (Claude)`, createdByName: context.actor ?? "Claude (MCP)" });
        }
      } catch (err) {
        console.error("[workflow-mcp] snapshot before change failed (continuing):", err instanceof Error ? err.message : err);
      }
    }
  }

  const result = await pageContext.run({ page: cleanString(input.page) }, () => dispatchWorkflowTool(name, input, context));

  if (mutating && workflowId && name !== "delete_workflow") {
    await recordAudit({ workflowId, actorType: "mcp", actorName: context.actor ?? "Claude (MCP)", action: `mcp.${name}`, detail: { page: cleanString(input.page) ?? null } });
  }
  return withRevision(result, workflowId, mutating || name === "get_workflow");
}

/**
 * Callers need the workflow's current revision to use `baseRevision`. Say it on get_workflow and on every reply that
 * changed the workflow, so nobody has to provoke a refusal to find out. Never fails the tool.
 */
async function withRevision(result: unknown, workflowId: string | undefined, wanted: boolean) {
  if (!wanted || !workflowId || !result || typeof result !== "object" || Array.isArray(result) || "revision" in result) return result;
  try {
    const current = await prisma.workflowProject.findUnique({ where: { id: workflowId }, select: { revision: true } });
    return current ? { ...(result as Record<string, unknown>), revision: current.revision } : result;
  } catch {
    return result;
  }
}

async function dispatchWorkflowTool(
  name: string,
  input: ToolArguments,
  context: ToolContext
) {
  switch (name) {
    case "create_workflow":
      return createWorkflow(input, context);
    case "create_workflow_from_spec":
      return createWorkflowFromSpec(input, context);
    case "create_workflow_from_scoping_notes":
      return createWorkflowFromScopingNotes(input, context);
    case "list_workflows":
      return listWorkflows(input, context);
    case "duplicate_workflow":
      return duplicateWorkflow(input, context);
    case "list_templates":
      return listTemplates(input);
    case "get_template":
      return getTemplate(input);
    case "create_from_template":
      return createFromTemplate(input, context);
    case "validate_workflow":
      return validateWorkflowTool(input);
    case "add_scoping_artifact":
      return addScopingArtifact(input);
    case "list_scoping_artifacts":
      return listScopingArtifactsTool(input);
    case "update_scoping_artifact":
      return updateScopingArtifactTool(input);
    case "delete_scoping_artifact":
      return deleteScopingArtifactTool(input);
    case "add_call_note":
      return addCallNote(input);
    case "create_version_snapshot":
      return createVersionSnapshotTool(input);
    case "list_versions":
      return listVersions(input);
    case "restore_version":
      return restoreVersion(input);
    case "generate_customer_summary":
      return generateCustomerSummaryTool(input, context);
    case "share_workflow":
      return shareWorkflow(input, context);
    case "get_workflow":
      return getWorkflow(input);
    case "add_node":
      return addNode(input);
    case "update_node":
      return updateNode(input);
    case "delete_node":
      return deleteNode(input);
    case "add_edge":
      return addEdgeTool(input);
    case "add_recovery_edge":
      return addRecoveryEdge(input);
    case "auto_layout":
      return autoLayout(input);
    case "renumber_steps":
      return renumberSteps(input);
    case "design_campaign_structure":
      return designCampaignStructure(input, context);
    case "clear_campaign_structure":
      return clearCampaignStructure(input, context);
    default: {
      const v2 = await callV2Tool(name, input, context, { createFromSpec: (a, c) => createWorkflowFromSpec(a as ToolArguments, c), Input: McpToolInputError });
      if (v2 !== undefined) return v2;
      throw new McpToolNotFoundError(`Unknown tool: ${name}`);
    }
  }
}

function asObject(value: unknown): ToolArguments {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as ToolArguments;
}

function requiredString(args: ToolArguments, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new McpToolInputError(`${key} is required`);
  }
  return value.trim();
}

function optionalString(args: ToolArguments, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" ? value : undefined;
}

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalBoolean(args: ToolArguments, key: string): boolean | undefined {
  return typeof args[key] === "boolean" ? args[key] : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function positionFromValue(value: unknown): { x: number; y: number } | undefined {
  const raw = asRecord(value);
  return typeof raw.x === "number" && typeof raw.y === "number"
    ? { x: raw.x, y: raw.y }
    : undefined;
}

function nodeDataFromValue(value: unknown): WorkflowNodeData["data"] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as WorkflowNodeData["data"];
}

function edgeDataFromValue(value: unknown): Partial<WorkflowEdgeData> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Partial<WorkflowEdgeData>;
}

function workflowEditUrl(context: ToolContext, workflowId: string) {
  return `${context.origin}/admin/workflows/${workflowId}`;
}

function workflowShareUrl(context: ToolContext, token: string) {
  return `${context.origin}/w/${token}`;
}

function countFindings(findings: WorkflowValidationFinding[]) {
  return findings.reduce<Record<string, number>>((acc, finding) => {
    acc[finding.severity] = (acc[finding.severity] ?? 0) + 1;
    return acc;
  }, {});
}

/** The numbers a workflow shows follow its drawing style: Process Map = 1, 2, 5.1, 11.1.1; Classic = 1, 2, 2a. */
function schemeFor(diagramStyle: string | null | undefined): NumberingScheme {
  return diagramStyle === "process_map" ? "decimal" : "letters";
}

function serializeNumbering(nodes: FlowNode[], edges: FlowEdge[], scheme: NumberingScheme = "letters") {
  const { stepNumbers, warnings, recoveryEdges } = computeNumbers(nodes, edges, scheme);
  return {
    stepNumbers: Object.fromEntries(stepNumbers),
    warnings: Array.from(warnings),
    recoveryEdges: Object.fromEntries(recoveryEdges),
  };
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return jsonClone(value) as Prisma.InputJsonValue;
}

async function createWorkflow(args: ToolArguments, context: ToolContext) {
  const clientName = requiredString(args, "clientName");
  const workflowName = requiredString(args, "workflowName");
  const description = optionalString(args, "description")?.trim() || null;
  const initialPage = {
    id: "page_mcp_start",
    name: "Page 1",
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };

  const workflow = await prisma.workflowProject.create({
    data: {
      clientName,
      workflowName,
      description,
      nodes: [],
      edges: [],
      pages: [initialPage],
    },
    select: { id: true },
  });

  return {
    workflowId: workflow.id,
    editUrl: `${context.origin}/admin/workflows/${workflow.id}`,
  };
}

async function createWorkflowFromSpec(args: ToolArguments, context: ToolContext) {
  const spec = normalizeWorkflowSpecInput(args);
  return persistWorkflowSpec(spec, context);
}

async function createWorkflowFromScopingNotes(
  args: ToolArguments,
  context: ToolContext
) {
  const scopingNotes =
    cleanString(args.scopingNotes) ?? cleanString(args.transcript);
  if (!scopingNotes) {
    throw new McpToolInputError("scopingNotes is required");
  }

  const spec = normalizeWorkflowSpecInput(args);
  const callNote: WorkflowSpecArtifactInput = {
    kind: "call_note",
    title: cleanString(args.callNoteTitle) ?? "Scoping notes",
    detail: scopingNotes,
    status: "confirmed",
    severity: "info",
    source: "transcript",
    metadata: {
      capturedVia: "mcp",
      originalField: cleanString(args.scopingNotes) ? "scopingNotes" : "transcript",
    },
  };

  return persistWorkflowSpec(
    {
      ...spec,
      artifacts: [callNote, ...(spec.artifacts ?? [])],
    },
    context
  );
}

function normalizeWorkflowSpecInput(args: ToolArguments): WorkflowSpecInput {
  const clientName = requiredString(args, "clientName");
  const workflowName = requiredString(args, "workflowName");
  const rawNodes = asArray(args.nodes);
  if (rawNodes.length === 0) {
    throw new McpToolInputError("nodes must include at least one node");
  }

  return {
    clientName,
    workflowName,
    description: cleanString(args.description),
    nodes: rawNodes.map(normalizeSpecNode),
    edges: asArray(args.edges).map(normalizeSpecEdge),
    artifacts: asArray(args.artifacts).map((item) => item as WorkflowSpecArtifactInput),
    summary: cleanString(args.summary),
    autoLayout: optionalBoolean(args, "autoLayout") ?? true,
    layoutDirection:
      args.layoutDirection === "LR" ? "LR" : "TB",
    diagramStyle: args.diagramStyle === "classic" ? "classic" : "process_map",
  };
}

function normalizeSpecNode(input: unknown): WorkflowSpecNodeInput {
  const raw = asRecord(input);
  const tempId = cleanString(raw.tempId) ?? cleanString(raw.id);
  const type = cleanString(raw.type);
  const label = cleanString(raw.label);

  if (!tempId) throw new McpToolInputError("Every spec node needs a tempId");
  if (!type || !isWorkflowNodeType(type)) {
    throw new McpToolInputError(`Invalid node type for ${tempId}`);
  }
  if (!label) throw new McpToolInputError(`Node ${tempId} needs a label`);

  return {
    tempId,
    type,
    label,
    actor: isActorType(raw.actor) ? raw.actor : undefined,
    actorLabel: cleanString(raw.actorLabel),
    notes: cleanString(raw.notes) ?? "",
    feasibility: normalizeFeasibility(raw.feasibility),
    feasibilityNote: cleanString(raw.feasibilityNote),
    position: positionFromValue(raw.position),
    customColor: normalizeCustomColor(raw.customColor),
    data: nodeDataFromValue(raw.data),
    extra: processMapFields(raw),
  };
}

function normalizeSpecEdge(input: unknown): WorkflowSpecEdgeInput {
  const raw = asRecord(input);
  const sourceTempId =
    cleanString(raw.sourceTempId) ??
    cleanString(raw.source) ??
    cleanString(raw.sourceNodeId);
  const targetTempId =
    cleanString(raw.targetTempId) ??
    cleanString(raw.target) ??
    cleanString(raw.targetNodeId);

  if (!sourceTempId || !targetTempId) {
    throw new McpToolInputError("Every spec edge needs sourceTempId and targetTempId");
  }

  return {
    tempId: cleanString(raw.tempId) ?? cleanString(raw.id),
    sourceTempId,
    targetTempId,
    label: cleanString(raw.label) ?? "",
    isHappyPath: raw.isHappyPath === true,
    isRecovery: raw.isRecovery === true,
    isPrimary: typeof raw.isPrimary === "boolean" ? raw.isPrimary : undefined,
    data: edgeDataFromValue(raw.data),
  };
}

async function persistWorkflowSpec(spec: WorkflowSpecInput, context: ToolContext) {
  const tempIds = new Set<string>();
  const nodeIdMap: Record<string, string> = {};
  const edgeIdMap: Record<string, string> = {};

  const nodes = spec.nodes.map((specNode, index) => {
    if (tempIds.has(specNode.tempId)) {
      throw new McpToolInputError(`Duplicate node tempId: ${specNode.tempId}`);
    }
    tempIds.add(specNode.tempId);

    const node = createWorkflowNode({
      type: specNode.type,
      label: specNode.label,
      actor: specNode.actor,
      actorLabel: specNode.actorLabel,
      notes: specNode.notes,
      feasibility: specNode.feasibility,
      feasibilityNote: specNode.feasibilityNote,
      customColor: specNode.customColor,
      data: specNode.data,
      position: specNode.position ?? { x: 0, y: index * 120 },
      extra: specNode.extra,
    });
    nodeIdMap[specNode.tempId] = node.id;
    return node;
  });
  // Jump markers and notes may point at another step by the temporary id used in this spec.
  for (const node of nodes) {
    const d = node.data as unknown as Record<string, unknown>;
    for (const key of ["jumpToNodeId", "attachTo"]) {
      const value = d[key];
      if (typeof value === "string" && nodeIdMap[value]) d[key] = nodeIdMap[value];
    }
  }

  let edges: FlowEdge[] = [];
  for (const specEdge of spec.edges) {
    const source = nodeIdMap[specEdge.sourceTempId];
    const target = nodeIdMap[specEdge.targetTempId];
    if (!source || !target) {
      throw new McpToolInputError(
        `Edge ${specEdge.tempId ?? `${specEdge.sourceTempId}->${specEdge.targetTempId}`} references an unknown node tempId`
      );
    }

    if (specEdge.isHappyPath) {
      edges = edges.map((edge) =>
        edge.source === source
          ? {
              ...edge,
              data: { ...normalizeEdgeData(edge.data), isHappyPath: false },
            }
          : edge
      );
    }

    const edge = createWorkflowEdge({
      source,
      target,
      label: specEdge.label,
      isHappyPath: specEdge.isHappyPath === true && specEdge.isRecovery !== true,
      isRecovery: specEdge.isRecovery,
      isPrimary: specEdge.isPrimary,
      pathSemantic: specEdge.pathSemantic,
      data: specEdge.data,
    });
    if (specEdge.tempId) edgeIdMap[specEdge.tempId] = edge.id;
    edges.push(edge);
  }

  const processMap = spec.diagramStyle !== "classic";
  const numbered = processMap ? { recoveryEdges: new Map<string, string>() } : computeStepNumbers(nodes, edges);
  edges = edges.map((edge) => {
    const data = normalizeEdgeData(edge.data);
    const recoveryLabel = numbered.recoveryEdges.get(edge.id) ?? data.recoveryLabel;
    const isRecovery = data.isRecovery || Boolean(recoveryLabel);
    return {
      ...edge,
      data: {
        ...data,
        isRecovery,
        isHappyPath: isRecovery ? false : data.isHappyPath,
        recoveryLabel,
      },
    };
  });

  let finalNodes = nodes;
  let finalEdges = edges;
  if (spec.autoLayout !== false && nodes.length > 0) {
    const layouted = (processMap
      ? applyLayout(nodes, edges, layoutDiagram(nodes, edges))
      : getLayoutedElements(nodes, edges, spec.layoutDirection ?? "TB")) as {
      nodes: FlowNode[];
      edges: FlowEdge[];
    };
    finalNodes = layouted.nodes;
    finalEdges = layouted.edges.map((edge) => ({
      ...edge,
      data: normalizeEdgeData(edge.data),
    }));
  }

  const initialPage = {
    id: `page_${nanoid(8)}`,
    name: "Page 1",
    nodes: finalNodes,
    edges: finalEdges,
    viewport: { x: 0, y: 0, zoom: 1 },
  };

  const workflow = await prisma.workflowProject.create({
    data: {
      clientName: spec.clientName,
      workflowName: spec.workflowName,
      description: spec.description ?? null,
      nodes: toJson(finalNodes),
      edges: toJson(finalEdges),
      pages: toJson([initialPage]),
      diagramStyle: processMap ? "process_map" : "classic",
      numberingScheme: processMap ? "decimal" : "letters",
    },
    select: {
      id: true,
      clientName: true,
      workflowName: true,
      status: true,
    },
  });

  const artifacts = await createManyScopingArtifacts(
    workflow.id,
    spec.artifacts ?? [],
    { source: "mcp" }
  );
  const findings = validateWorkflow(finalNodes, finalEdges, { diagramStyle: processMap ? "process_map" : "classic" });
  const editUrl = workflowEditUrl(context, workflow.id);
  const summary =
    spec.summary ??
    generateCustomerSummaryText({
      workflow,
      nodes: finalNodes,
      edges: finalEdges,
      findings,
      artifacts,
      editUrl,
    });

  const summaryArtifact = await createScopingArtifact(
    workflow.id,
    {
      kind: "customer_summary",
      title: "Customer handoff summary",
      detail: summary,
      status: "confirmed",
      severity: "info",
      source: "mcp",
      metadata: { generatedVia: "create_workflow_from_spec" },
    }
  );

  return {
    workflowId: workflow.id,
    editUrl,
    nodeIdMap,
    edgeIdMap,
    validation: {
      findings,
      counts: countFindings(findings),
    },
    numbering: serializeNumbering(finalNodes, finalEdges, processMap ? "decimal" : "letters"),
    artifactsCount: artifacts.length + 1,
    summaryArtifactId: summaryArtifact.id,
    summary,
  };
}

async function getWorkflow(args: ToolArguments) {
  const workflowId = requiredString(args, "workflowId");
  const workflow = await prisma.workflowProject.findUnique({
    where: { id: workflowId },
  });
  if (!workflow) {
    throw new McpToolInputError("Workflow not found");
  }

  const { nodes, edges } = getCanvas(workflow);
  const { stepNumbers } = computeNumbers(nodes, edges, schemeFor(workflow.diagramStyle));
  return {
    id: workflow.id,
    clientName: workflow.clientName,
    workflowName: workflow.workflowName,
    status: workflow.status,
    nodes,
    edges,
    stepNumbers: Object.fromEntries(stepNumbers),
  };
}

async function listWorkflows(args: ToolArguments, context: ToolContext) {
  const search = cleanString(args.search);
  const status = cleanString(args.status);
  const rawLimit = typeof args.limit === "number" ? args.limit : 20;
  const limit = Math.min(50, Math.max(1, Math.floor(rawLimit)));

  const workflows = await prisma.workflowProject.findMany({
    where: {
      ...(status && status !== "all" ? { status } : {}),
      ...(search
        ? {
            OR: [
              { clientName: { contains: search, mode: "insensitive" as const } },
              { workflowName: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      clientName: true,
      workflowName: true,
      description: true,
      status: true,
      nodes: true,
      edges: true,
      viewport: true,
      pages: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  return {
    items: workflows.map((workflow) => {
      const { nodes, edges } = getCanvas(workflow);
      return {
        id: workflow.id,
        clientName: workflow.clientName,
        workflowName: workflow.workflowName,
        description: workflow.description,
        status: workflow.status,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        editUrl: workflowEditUrl(context, workflow.id),
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
      };
    }),
  };
}

async function duplicateWorkflow(args: ToolArguments, context: ToolContext) {
  const workflowId = requiredString(args, "workflowId");
  const source = await prisma.workflowProject.findUnique({
    where: { id: workflowId },
  });
  if (!source) throw new McpToolInputError("Workflow not found");

  const { nodes, edges } = getCanvas(source);
  const cloned = cloneGraphWithFreshIds(nodes, edges);
  const workflowName =
    cleanString(args.workflowName) ?? `${source.workflowName} Copy`;
  const clientName = cleanString(args.clientName) ?? source.clientName;
  const description =
    cleanString(args.description) ?? source.description ?? undefined;
  const initialPage = {
    id: `page_${nanoid(8)}`,
    name: "Page 1",
    nodes: cloned.nodes,
    edges: cloned.edges,
    viewport: { x: 0, y: 0, zoom: 1 },
  };

  const duplicate = await prisma.workflowProject.create({
    data: {
      clientName,
      workflowName,
      description: description ?? null,
      templateId: source.templateId,
      nodes: toJson(cloned.nodes),
      edges: toJson(cloned.edges),
      pages: toJson([initialPage]),
    },
    select: { id: true },
  });

  return {
    workflowId: duplicate.id,
    editUrl: workflowEditUrl(context, duplicate.id),
    nodeIdMap: cloned.nodeIdMap,
    edgeIdMap: cloned.edgeIdMap,
  };
}

async function listTemplates(args: ToolArguments) {
  const industry = cleanString(args.industry);
  const templates = await prisma.workflowTemplate.findMany({
    where: industry && industry !== "all" ? { industry } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      industry: true,
      nodes: true,
      edges: true,
      createdAt: true,
    },
  });

  return {
    items: templates.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      industry: template.industry,
      nodeCount: Array.isArray(template.nodes) ? template.nodes.length : 0,
      edgeCount: Array.isArray(template.edges) ? template.edges.length : 0,
      createdAt: template.createdAt,
    })),
  };
}

async function getTemplate(args: ToolArguments) {
  const templateId = requiredString(args, "templateId");
  const template = await prisma.workflowTemplate.findUnique({
    where: { id: templateId },
  });
  if (!template) throw new McpToolInputError("Template not found");
  return template;
}

async function createFromTemplate(args: ToolArguments, context: ToolContext) {
  const templateId = requiredString(args, "templateId");
  const clientName = requiredString(args, "clientName");
  const workflowName = requiredString(args, "workflowName");
  const template = await prisma.workflowTemplate.findUnique({
    where: { id: templateId },
  });
  if (!template) throw new McpToolInputError("Template not found");

  const cloned = cloneGraphWithFreshIds(
    Array.isArray(template.nodes) ? (template.nodes as unknown as FlowNode[]) : [],
    Array.isArray(template.edges) ? (template.edges as unknown as FlowEdge[]) : []
  );
  const layouted = getLayoutedElements(cloned.nodes, cloned.edges) as {
    nodes: FlowNode[];
    edges: FlowEdge[];
  };
  const initialPage = {
    id: `page_${nanoid(8)}`,
    name: "Page 1",
    nodes: layouted.nodes,
    edges: layouted.edges,
    viewport: { x: 0, y: 0, zoom: 1 },
  };
  const workflow = await prisma.workflowProject.create({
    data: {
      clientName,
      workflowName,
      description:
        cleanString(args.description) ?? template.description ?? null,
      templateId,
      nodes: toJson(layouted.nodes),
      edges: toJson(layouted.edges),
      pages: toJson([initialPage]),
    },
    select: { id: true },
  });
  const findings = validateWorkflow(layouted.nodes, layouted.edges);

  return {
    workflowId: workflow.id,
    editUrl: workflowEditUrl(context, workflow.id),
    nodeIdMap: cloned.nodeIdMap,
    edgeIdMap: cloned.edgeIdMap,
    validation: {
      findings,
      counts: countFindings(findings),
    },
    numbering: serializeNumbering(layouted.nodes, layouted.edges),
  };
}

async function validateWorkflowTool(args: ToolArguments) {
  const workflowId = requiredString(args, "workflowId");
  const workflow = await prisma.workflowProject.findUnique({
    where: { id: workflowId },
  });
  if (!workflow) throw new McpToolInputError("Workflow not found");

  const { nodes, edges } = getCanvas(workflow);
  const findings = validateWorkflow(nodes, edges, { diagramStyle: workflow.diagramStyle });
  const processMap = workflow.diagramStyle === "process_map";
  const scene = processMap ? buildScene(nodes, edges, { clientName: workflow.clientName, workflowName: workflow.workflowName }) : null;
  const layout = scene ? lintLayout(scene) : [];
  // Text a client should not see (ticket numbers, internal ids, tenant addresses): flagged for a person to look at, never removed.
  const sanitization = lintPagesForClient(
    [{ id: "page", name: "this page", nodes, edges }],
    { showFeasibility: workflow.showFeasibility }
  );
  return {
    findings,
    counts: countFindings(findings),
    numbering: serializeNumbering(nodes, edges, schemeFor(workflow.diagramStyle)),
    ...(processMap ? { layout, layoutCounts: countFindings(layout.map((f) => ({ severity: f.severity })) as never) } : {}),
    sanitization,
    note: processMap ? "Layout findings come from the same drawing a client sees. Fix high ones before sharing." : undefined,
  };
}

async function addScopingArtifact(args: ToolArguments) {
  const workflowId = requiredString(args, "workflowId");
  await ensureWorkflowExists(workflowId);
  const artifact = await createScopingArtifact(workflowId, args, {
    source: "mcp",
  });
  return { artifact };
}

async function listScopingArtifactsTool(args: ToolArguments) {
  const workflowId = requiredString(args, "workflowId");
  await ensureWorkflowExists(workflowId);
  const kind = isScopingArtifactKind(args.kind)
    ? (args.kind as ScopingArtifactKind)
    : undefined;
  const status = isScopingArtifactStatus(args.status)
    ? (args.status as ScopingArtifactStatus)
    : undefined;
  return {
    items: await listScopingArtifacts({ workflowId, kind, status }),
  };
}

async function updateScopingArtifactTool(args: ToolArguments) {
  const workflowId = requiredString(args, "workflowId");
  const artifactId = requiredString(args, "artifactId");
  await ensureWorkflowExists(workflowId);
  try {
    const artifact = await updateScopingArtifact({
      workflowId,
      artifactId,
      updates: args,
    });
    return { artifact };
  } catch (err) {
    if (err instanceof ScopingInputError) {
      throw new McpToolInputError(err.message);
    }
    throw err;
  }
}

async function deleteScopingArtifactTool(args: ToolArguments) {
  const workflowId = requiredString(args, "workflowId");
  const artifactId = requiredString(args, "artifactId");
  await ensureWorkflowExists(workflowId);
  try {
    return await deleteScopingArtifact({ workflowId, artifactId });
  } catch (err) {
    if (err instanceof ScopingInputError) {
      throw new McpToolInputError(err.message);
    }
    throw err;
  }
}

async function addCallNote(args: ToolArguments) {
  const workflowId = requiredString(args, "workflowId");
  const detail =
    cleanString(args.detail) ??
    cleanString(args.note) ??
    cleanString(args.transcript);
  if (!detail) throw new McpToolInputError("detail is required");
  await ensureWorkflowExists(workflowId);
  const artifact = await createScopingArtifact(
    workflowId,
    {
      kind: "call_note",
      title: cleanString(args.title) ?? "Call note",
      detail,
      status: "confirmed",
      severity: "info",
      owner: cleanString(args.owner),
      source: cleanString(args.transcript) ? "transcript" : "mcp",
      metadata: asRecord(args.metadata),
    },
    { source: "mcp" }
  );
  return { artifact };
}

async function createVersionSnapshotTool(args: ToolArguments) {
  const workflowId = requiredString(args, "workflowId");
  await ensureWorkflowExists(workflowId);
  const version = await createVersionSnapshot({
    workflowId,
    triggeredBy: "manual",
    label: cleanString(args.label),
    createdByName: cleanString(args.createdByName),
    triggerDetail: cleanString(args.triggerDetail) ?? "MCP snapshot",
  });
  // A summary, not the whole canvas: the full copy is stored and can be read with diff_versions / restore_version.
  const { id, versionNumber, label, status, triggeredBy, triggerDetail, createdByName, nodeCount, edgeCount, createdAt } = version;
  return { version: { id, versionNumber, label, status, triggeredBy, triggerDetail, createdByName, nodeCount, edgeCount, createdAt } };
}

async function listVersions(args: ToolArguments) {
  const workflowId = requiredString(args, "workflowId");
  await ensureWorkflowExists(workflowId);
  const versions = await prisma.workflowVersion.findMany({
    where: { workflowId },
    orderBy: { versionNumber: "desc" },
    select: {
      id: true,
      versionNumber: true,
      label: true,
      status: true,
      triggeredBy: true,
      triggerDetail: true,
      createdByName: true,
      nodeCount: true,
      edgeCount: true,
      createdAt: true,
    },
  });
  return { items: versions };
}

async function restoreVersion(args: ToolArguments) {
  const workflowId = requiredString(args, "workflowId");
  const versionId = requiredString(args, "versionId");
  const targetVersion = await prisma.workflowVersion.findFirst({
    where: { id: versionId, workflowId },
  });
  if (!targetVersion) throw new McpToolInputError("Version not found");

  await createVersionSnapshot({
    workflowId,
    triggeredBy: "restore",
    triggerDetail: `Auto-saved before restoring v${targetVersion.versionNumber}`,
  });

  const restoredPages = Array.isArray(targetVersion.pages)
    ? (targetVersion.pages as unknown[])
    : [
        {
          id: `page_${nanoid(8)}`,
          name: "Page 1",
          nodes: targetVersion.nodes ?? [],
          edges: targetVersion.edges ?? [],
          viewport: targetVersion.viewport ?? { x: 0, y: 0, zoom: 1 },
        },
      ];
  const firstPage = restoredPages[0] as
    | { nodes?: unknown; edges?: unknown; viewport?: unknown }
    | undefined;

  await prisma.workflowProject.update({
    where: { id: workflowId },
    data: {
      pages: toJson(restoredPages),
      nodes: toJson(firstPage?.nodes ?? targetVersion.nodes ?? []),
      edges: toJson(firstPage?.edges ?? targetVersion.edges ?? []),
      viewport: toJson(
        firstPage?.viewport ?? targetVersion.viewport ?? { x: 0, y: 0, zoom: 1 }
      ),
      revision: { increment: 1 },
    },
  });

  const version = await createVersionSnapshot({
    workflowId,
    triggeredBy: "restore",
    triggerDetail: `Restored from v${targetVersion.versionNumber}`,
    label: targetVersion.label ?? undefined,
  });

  return { success: true, version };
}

async function generateCustomerSummaryTool(
  args: ToolArguments,
  context: ToolContext
) {
  const workflowId = requiredString(args, "workflowId");
  const workflow = await prisma.workflowProject.findUnique({
    where: { id: workflowId },
    select: {
      id: true,
      clientName: true,
      workflowName: true,
      nodes: true,
      edges: true,
      pages: true,
      viewport: true,
    },
  });
  if (!workflow) throw new McpToolInputError("Workflow not found");

  const { nodes, edges } = getCanvas(workflow);
  const findings = validateWorkflow(nodes, edges);
  const artifacts = await listScopingArtifacts({ workflowId });
  const editUrl = workflowEditUrl(context, workflowId);
  const summary = generateCustomerSummaryText({
    workflow,
    nodes,
    edges,
    findings,
    artifacts,
    editUrl,
  });
  const artifact = await createScopingArtifact(workflowId, {
    kind: "customer_summary",
    title: cleanString(args.title) ?? "Customer handoff summary",
    detail: summary,
    status: "confirmed",
    severity: "info",
    source: "mcp",
    metadata: { generatedVia: "generate_customer_summary" },
  });

  return {
    summary,
    artifactId: artifact.id,
    editUrl,
    validation: {
      findings,
      counts: countFindings(findings),
    },
  };
}

async function shareWorkflow(args: ToolArguments, context: ToolContext) {
  const workflowId = requiredString(args, "workflowId");
  const existing = await prisma.workflowProject.findUnique({
    where: { id: workflowId },
    select: {
      id: true,
      shareToken: true,
      shareVersionId: true,
      status: true,
    },
  });
  if (!existing) throw new McpToolInputError("Workflow not found");

  const shareVersionId = cleanString(args.shareVersionId);
  if (shareVersionId) {
    const version = await prisma.workflowVersion.findFirst({
      where: { id: shareVersionId, workflowId },
      select: { id: true },
    });
    if (!version) {
      throw new McpToolInputError("Selected version does not belong to this workflow");
    }
  }

  if (existing.status !== "shared") {
    await createVersionSnapshot({
      workflowId,
      triggeredBy: "status_change",
      triggerDetail: `${existing.status} → shared`,
    });
  }

  const token = existing.shareToken ?? nanoid(12);
  const updated = await prisma.workflowProject.update({
    where: { id: workflowId },
    data: {
      shareToken: token,
      status: "shared",
      shareVersionId: shareVersionId ?? existing.shareVersionId,
    },
    select: { shareVersionId: true },
  });

  return {
    shareToken: token,
    shareUrl: workflowShareUrl(context, token),
    shareVersionId: updated.shareVersionId,
  };
}

async function addNode(args: ToolArguments) {
  const workflowId = requiredString(args, "workflowId");
  const type = requiredString(args, "type");
  const label = requiredString(args, "label");
  if (!isWorkflowNodeType(type)) {
    throw new McpToolInputError("type must be a valid workflow node type");
  }

  const workflow = await prisma.workflowProject.findUnique({
    where: { id: workflowId },
  });
  if (!workflow) {
    throw new McpToolInputError("Workflow not found");
  }

  const { nodes, edges } = getCanvas(workflow);
  const node = createWorkflowNode({
    type,
    label,
    actor: isActorType(args.actor) ? args.actor : undefined,
    actorLabel: cleanString(args.actorLabel),
    notes: optionalString(args, "notes") ?? "",
    feasibility: normalizeFeasibility(args.feasibility),
    feasibilityNote: cleanString(args.feasibilityNote),
    customColor: normalizeCustomColor(args.customColor),
    data: nodeDataFromValue(args.data),
    position: { x: 0, y: nodes.length * 120 },
    extra: processMapFields(args),
  });

  // A note attached to a step goes beside that step now, not at the bottom-left until someone runs auto_layout.
  if (workflow.diagramStyle === "process_map" && type === "note") {
    const spot = positionForNewNote(nodes, edges, node);
    if (spot) node.position = spot;
  }

  await prisma.workflowProject.update({
    where: { id: workflowId },
    data: updateFirstPage(workflow, [...nodes, node], edges),
  });

  return { nodeId: node.id };
}

async function updateNode(args: ToolArguments) {
  const workflowId = requiredString(args, "workflowId");
  const nodeId = requiredString(args, "nodeId");
  const workflow = await prisma.workflowProject.findUnique({
    where: { id: workflowId },
  });
  if (!workflow) {
    throw new McpToolInputError("Workflow not found");
  }

  const { nodes, edges } = getCanvas(workflow);
  let found = false;
  const customColor = normalizeCustomColor(args.customColor);
  const nextNodes = nodes.map((node) => {
    if (node.id !== nodeId) return node;
    found = true;
    const nextType = isWorkflowNodeType(args.type) ? args.type : node.data.type;
    const metadataUpdates = nodeDataFromValue(args.data);
    return {
      ...node,
      type: nextType,
      data: {
        ...node.data,
        type: nextType,
        label:
          typeof args.label === "string" && args.label.trim()
            ? args.label.trim()
            : node.data.label,
        actor: isActorType(args.actor) ? args.actor : node.data.actor,
        actorLabel:
          cleanString(args.actorLabel) ??
          (isActorType(args.actor) ? "" : node.data.actorLabel),
        notes: typeof args.notes === "string" ? args.notes : node.data.notes,
        feasibility:
          args.feasibility !== undefined
            ? normalizeFeasibility(args.feasibility)
            : node.data.feasibility,
        feasibilityNote:
          typeof args.feasibilityNote === "string"
            ? args.feasibilityNote
            : node.data.feasibilityNote,
        customColor:
          customColor !== undefined ? customColor : node.data.customColor,
        data: metadataUpdates
          ? { ...node.data.data, ...metadataUpdates }
          : node.data.data,
        ...processMapFields(args),
      },
    };
  });

  if (!found) {
    throw new McpToolInputError("Node not found");
  }

  await prisma.workflowProject.update({
    where: { id: workflowId },
    data: updateFirstPage(workflow, nextNodes, edges),
  });

  return { success: true };
}

async function deleteNode(args: ToolArguments) {
  const workflowId = requiredString(args, "workflowId");
  const nodeId = requiredString(args, "nodeId");
  const workflow = await prisma.workflowProject.findUnique({
    where: { id: workflowId },
  });
  if (!workflow) {
    throw new McpToolInputError("Workflow not found");
  }

  const { nodes, edges } = getCanvas(workflow);
  const nextNodes = nodes.filter((node) => node.id !== nodeId);
  if (nextNodes.length === nodes.length) {
    throw new McpToolInputError("Node not found");
  }
  const nextEdges = edges.filter(
    (edge) => edge.source !== nodeId && edge.target !== nodeId
  );

  await prisma.workflowProject.update({
    where: { id: workflowId },
    data: updateFirstPage(workflow, nextNodes, nextEdges),
  });

  return { success: true };
}

async function addEdgeTool(args: ToolArguments) {
  const workflowId = requiredString(args, "workflowId");
  const sourceNodeId = requiredString(args, "sourceNodeId");
  const targetNodeId = requiredString(args, "targetNodeId");
  const workflow = await prisma.workflowProject.findUnique({
    where: { id: workflowId },
  });
  if (!workflow) {
    throw new McpToolInputError("Workflow not found");
  }

  const { nodes, edges } = getCanvas(workflow);
  validateNodePair(nodes, sourceNodeId, targetNodeId);

  let nextEdges = edges.map((edge) => ({
    ...edge,
    data: normalizeEdgeData(edge.data),
  }));
  if (args.isHappyPath === true) {
    nextEdges = nextEdges.map((edge) =>
      edge.source === sourceNodeId
        ? {
            ...edge,
            data: { ...normalizeEdgeData(edge.data), isHappyPath: false },
          }
        : edge
    );
  }

  const edge = createWorkflowEdge({
    source: sourceNodeId,
    target: targetNodeId,
    isHappyPath: args.isHappyPath === true,
    isPrimary: typeof args.isPrimary === "boolean" ? args.isPrimary : undefined,
    label: optionalString(args, "label") ?? "",
    data: edgeDataFromValue(args.data),
  });

  // A connector to or from a note is drawn from the side the layout would use, not the default right-to-bottom.
  if (workflow.diagramStyle === "process_map" && [sourceNodeId, targetNodeId].some((id) => nodes.find((n) => n.id === id)?.data?.type === "note")) {
    try {
      const route = layoutDiagram(nodes, [...nextEdges, edge]).edges.get(edge.id);
      if (route) Object.assign(edge, { sourceHandle: route.sourceHandle, targetHandle: route.targetHandle });
    } catch {
      /* keep the default handles */
    }
  }

  await prisma.workflowProject.update({
    where: { id: workflowId },
    data: updateFirstPage(workflow, nodes, [...nextEdges, edge]),
  });

  return { edgeId: edge.id };
}

async function addRecoveryEdge(args: ToolArguments) {
  const workflowId = requiredString(args, "workflowId");
  const sourceNodeId = requiredString(args, "sourceNodeId");
  const targetNodeId = requiredString(args, "targetNodeId");
  const workflow = await prisma.workflowProject.findUnique({
    where: { id: workflowId },
  });
  if (!workflow) {
    throw new McpToolInputError("Workflow not found");
  }

  const { nodes, edges } = getCanvas(workflow);
  validateNodePair(nodes, sourceNodeId, targetNodeId);

  const edge = createWorkflowEdge({
    source: sourceNodeId,
    target: targetNodeId,
    isRecovery: true,
    isHappyPath: false,
    label: optionalString(args, "label") ?? "",
    data: edgeDataFromValue(args.data),
  });
  const addedEdges = [...edges, edge];
  const { recoveryEdges, stepNumbers } = computeNumbers(nodes, addedEdges, schemeFor(workflow.diagramStyle));
  const recoveryLabel =
    recoveryEdges.get(edge.id) ??
    (stepNumbers.has(targetNodeId)
      ? `↩ Returns to Step ${stepNumbers.get(targetNodeId)}`
      : "↩ Recovery path");

  const nextEdges = addedEdges.map((item) =>
    item.id === edge.id
      ? {
          ...item,
          data: {
            ...normalizeEdgeData(item.data),
            isRecovery: true,
            isHappyPath: false,
            recoveryLabel,
          },
        }
      : item
  );

  await prisma.workflowProject.update({
    where: { id: workflowId },
    data: updateFirstPage(workflow, nodes, nextEdges),
  });

  return { edgeId: edge.id, recoveryLabel };
}

async function autoLayout(args: ToolArguments) {
  const workflowId = requiredString(args, "workflowId");
  const direction: "TB" | "LR" = args.direction === "LR" ? "LR" : "TB";
  const workflow = await prisma.workflowProject.findUnique({
    where: { id: workflowId },
  });
  if (!workflow) {
    throw new McpToolInputError("Workflow not found");
  }

  const { nodes, edges } = getCanvas(workflow);
  // Process Map workflows use the spine layout (main path on one row, branches dropping below).
  const layouted =
    workflow.diagramStyle === "process_map"
      ? (applyLayout(nodes, edges, layoutDiagram(nodes, edges)) as { nodes: FlowNode[]; edges: FlowEdge[] })
      : (getLayoutedElements(nodes, edges, direction) as { nodes: FlowNode[]; edges: FlowEdge[] });

  await prisma.workflowProject.update({
    where: { id: workflowId },
    data: updateFirstPage(workflow, layouted.nodes, layouted.edges.map((e) => ({ ...e, data: normalizeEdgeData(e.data) }))),
  });

  // A summary, not every node: callers can read the result with get_workflow.
  const before = new Map(nodes.map((n) => [n.id, n.position]));
  const moved = layouted.nodes.filter((n) => { const p = before.get(n.id); return !p || p.x !== n.position.x || p.y !== n.position.y; }).length;
  return { style: workflow.diagramStyle, nodeCount: layouted.nodes.length, moved };
}

async function renumberSteps(args: ToolArguments) {
  const workflowId = requiredString(args, "workflowId");
  const workflow = await prisma.workflowProject.findUnique({
    where: { id: workflowId },
  });
  if (!workflow) {
    throw new McpToolInputError("Workflow not found");
  }

  const { nodes, edges } = getCanvas(workflow);
  const { stepNumbers, warnings } = computeNumbers(nodes, edges, schemeFor(workflow.diagramStyle));
  return {
    stepNumbers: Object.fromEntries(stepNumbers),
    warnings: Array.from(warnings),
  };
}

function validateNodePair(
  nodes: FlowNode[],
  sourceNodeId: string,
  targetNodeId: string
) {
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (!nodeIds.has(sourceNodeId) || !nodeIds.has(targetNodeId)) {
    throw new McpToolInputError("Source or target node not found");
  }
}

async function ensureWorkflowExists(workflowId: string) {
  const workflow = await prisma.workflowProject.findUnique({
    where: { id: workflowId },
    select: { id: true },
  });
  if (!workflow) throw new McpToolInputError("Workflow not found");
}

// ── Phase 4: Campaign structure annotation tools ────────────────────────────

function isAnnotationNode(node: FlowNode): boolean {
  return (node.data as { isAnnotation?: boolean })?.isAnnotation === true;
}

async function designCampaignStructure(
  args: ToolArguments,
  context: ToolContext
) {
  const workflowId = requiredString(args, "workflowId");
  const rawAnnotations = asArray(args.annotations);
  const mergeStrategy =
    args.mergeStrategy === "append" ? "append" : "replace_annotations";

  if (rawAnnotations.length === 0) {
    throw new McpToolInputError("annotations must be a non-empty array");
  }

  // Build annotation nodes from the input spec
  const incomingNodes: FlowNode[] = rawAnnotations.map((item) => {
    const a = asRecord(item);
    const id = typeof a.id === "string" && a.id.trim() ? a.id.trim() : `ann_${nanoid(8)}`;
    const shape = ["rect", "rounded-rect", "circle", "diamond", "text-label", "divider"].includes(a.shape as string)
      ? (a.shape as string)
      : "rect";
    const pos = positionFromValue(a.position) ?? { x: 0, y: 0 };
    return {
      id,
      type: "annotation",
      position: pos,
      width: typeof a.width === "number" ? a.width : 200,
      height: typeof a.height === "number" ? a.height : 80,
      data: {
        isAnnotation: true,
        shape,
        label: typeof a.label === "string" ? a.label : "",
        fillColor: typeof a.fillColor === "string" ? a.fillColor : "transparent",
        borderColor: typeof a.borderColor === "string" ? a.borderColor : "#00BFA5",
        borderStyle: a.borderStyle === "dashed" || a.borderStyle === "none" ? a.borderStyle : "solid",
        fontSize: typeof a.fontSize === "number" ? a.fontSize : 14,
        textAlign: a.textAlign === "left" || a.textAlign === "right" ? a.textAlign : "center",
        opacity: typeof a.opacity === "number" ? Math.min(1, Math.max(0.1, a.opacity)) : 0.8,
        bold: a.bold === true,
        italic: a.italic === false ? false : a.italic === true ? true : false,
        zIndex: typeof a.zIndex === "number" ? a.zIndex : -1,
      },
      selected: false,
    } as unknown as FlowNode;
  });

  const workflow = await prisma.workflowProject.findUnique({
    where: { id: workflowId },
    select: { id: true, nodes: true, edges: true, pages: true, viewport: true, workflowName: true, clientName: true },
  });
  if (!workflow) throw new McpToolInputError("Workflow not found");

  const { nodes: existingNodes, edges: existingEdges } = getCanvas(workflow as unknown as Parameters<typeof getCanvas>[0]);

  let baseNodes = existingNodes as FlowNode[];
  let baseEdges = existingEdges as FlowEdge[];

  if (mergeStrategy === "replace_annotations") {
    const annotationIds = new Set(baseNodes.filter(isAnnotationNode).map((n) => n.id));
    baseNodes = baseNodes.filter((n) => !annotationIds.has(n.id));
    baseEdges = baseEdges.filter(
      (e) => !annotationIds.has(e.source) && !annotationIds.has(e.target)
    );
  }

  // Prepend so annotations render behind workflow nodes
  const updatedNodes = [...incomingNodes, ...baseNodes];
  const updatedEdges = baseEdges;

  const update = updateFirstPage(
    workflow as unknown as Parameters<typeof updateFirstPage>[0],
    updatedNodes as FlowNode[],
    updatedEdges as FlowEdge[],
    undefined
  );

  await prisma.workflowProject.update({
    where: { id: workflowId },
    data: update,
  });

  return {
    success: true,
    workflowId,
    injected: incomingNodes.length,
    totalNodes: updatedNodes.length,
    editUrl: `${context.origin}/workflow/${workflowId}`,
    message: `Injected ${incomingNodes.length} annotation node(s) onto the canvas (strategy: ${mergeStrategy}).`,
  };
}

async function clearCampaignStructure(
  args: ToolArguments,
  context: ToolContext
) {
  const workflowId = requiredString(args, "workflowId");

  const workflow = await prisma.workflowProject.findUnique({
    where: { id: workflowId },
    select: { id: true, nodes: true, edges: true, pages: true, viewport: true, workflowName: true, clientName: true },
  });
  if (!workflow) throw new McpToolInputError("Workflow not found");

  const { nodes, edges } = getCanvas(workflow as unknown as Parameters<typeof getCanvas>[0]);

  const annotationIds = new Set(
    (nodes as FlowNode[]).filter(isAnnotationNode).map((n) => n.id)
  );
  const removed = annotationIds.size;

  const cleanNodes = (nodes as FlowNode[]).filter((n) => !annotationIds.has(n.id));
  const cleanEdges = (edges as FlowEdge[]).filter(
    (e) => !annotationIds.has(e.source) && !annotationIds.has(e.target)
  );

  const update = updateFirstPage(
    workflow as unknown as Parameters<typeof updateFirstPage>[0],
    cleanNodes,
    cleanEdges,
    undefined
  );
  await prisma.workflowProject.update({
    where: { id: workflowId },
    data: update,
  });

  return {
    success: true,
    workflowId,
    removed,
    remainingNodes: cleanNodes.length,
    editUrl: `${context.origin}/workflow/${workflowId}`,
    message: removed > 0
      ? `Removed ${removed} annotation node(s) from the canvas.`
      : "No annotation nodes found to remove.",
  };
}

function cloneGraphWithFreshIds(
  sourceNodes: FlowNode[],
  sourceEdges: FlowEdge[]
) {
  const idMap = new Map<string, string>();
  const edgeIdMap: Record<string, string> = {};

  const nodes = sourceNodes.map((node) => {
    const nextId = `node_${nanoid(8)}`;
    idMap.set(node.id, nextId);
    return {
      ...jsonClone(node),
      id: nextId,
      selected: false,
      data: jsonClone(node.data) as WorkflowNodeData,
    } satisfies FlowNode;
  });

  const edges = sourceEdges.flatMap((edge) => {
    const source = idMap.get(edge.source);
    const target = idMap.get(edge.target);
    if (!source || !target) return [];
    const nextId = `edge_${nanoid(8)}`;
    edgeIdMap[edge.id] = nextId;
    return [
      {
        ...jsonClone(edge),
        id: nextId,
        source,
        target,
        selected: false,
        type: "custom",
        data: normalizeEdgeData(edge.data),
      } satisfies FlowEdge,
    ];
  });

  return {
    nodes,
    edges,
    nodeIdMap: Object.fromEntries(idMap),
    edgeIdMap,
  };
}
