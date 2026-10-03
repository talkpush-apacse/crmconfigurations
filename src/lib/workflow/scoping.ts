import type { Edge, Node } from "@xyflow/react";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { validateWorkflow } from "@/lib/workflow/validation";
import type {
  ScopingArtifactKind,
  ScopingArtifactSeverity,
  ScopingArtifactSource,
  ScopingArtifactStatus,
  WorkflowScopingArtifact,
  WorkflowSpecArtifactInput,
  WorkflowValidationFinding,
} from "@/lib/workflow/types";

const ARTIFACT_KINDS: ScopingArtifactKind[] = [
  "assumption",
  "open_question",
  "risk",
  "decision",
  "call_note",
  "customer_summary",
];

const ARTIFACT_STATUSES: ScopingArtifactStatus[] = [
  "open",
  "confirmed",
  "resolved",
  "dismissed",
];

const ARTIFACT_SEVERITIES: ScopingArtifactSeverity[] = [
  "info",
  "low",
  "medium",
  "high",
  "critical",
];

const ARTIFACT_SOURCES: ScopingArtifactSource[] = [
  "mcp",
  "manual",
  "transcript",
  "validation",
];

export class ScopingInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScopingInputError";
  }
}

export function isScopingArtifactKind(
  value: unknown
): value is ScopingArtifactKind {
  return typeof value === "string" && ARTIFACT_KINDS.includes(value as ScopingArtifactKind);
}

export function isScopingArtifactStatus(
  value: unknown
): value is ScopingArtifactStatus {
  return typeof value === "string" && ARTIFACT_STATUSES.includes(value as ScopingArtifactStatus);
}

export function isScopingArtifactSeverity(
  value: unknown
): value is ScopingArtifactSeverity {
  return typeof value === "string" && ARTIFACT_SEVERITIES.includes(value as ScopingArtifactSeverity);
}

export function isScopingArtifactSource(
  value: unknown
): value is ScopingArtifactSource {
  return typeof value === "string" && ARTIFACT_SOURCES.includes(value as ScopingArtifactSource);
}

export function normalizeArtifactInput(
  input: unknown,
  defaults: Partial<WorkflowSpecArtifactInput> = {}
): WorkflowSpecArtifactInput {
  const raw =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const kind = isScopingArtifactKind(raw.kind)
    ? raw.kind
    : defaults.kind;
  const title =
    typeof raw.title === "string" && raw.title.trim()
      ? raw.title.trim()
      : defaults.title;
  const detail =
    typeof raw.detail === "string" && raw.detail.trim()
      ? raw.detail.trim()
      : defaults.detail;

  if (!kind) throw new ScopingInputError("Artifact kind is required");
  if (!title) throw new ScopingInputError("Artifact title is required");
  if (!detail) throw new ScopingInputError("Artifact detail is required");

  const metadata =
    raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
      ? (raw.metadata as Record<string, unknown>)
      : defaults.metadata ?? {};

  return {
    kind,
    title,
    detail,
    status: isScopingArtifactStatus(raw.status)
      ? raw.status
      : defaults.status ?? "open",
    severity: isScopingArtifactSeverity(raw.severity)
      ? raw.severity
      : defaults.severity ?? "info",
    owner:
      typeof raw.owner === "string" && raw.owner.trim()
        ? raw.owner.trim()
        : defaults.owner,
    source: isScopingArtifactSource(raw.source)
      ? raw.source
      : defaults.source ?? "manual",
    metadata,
  };
}

export async function listScopingArtifacts(input: {
  workflowId: string;
  kind?: ScopingArtifactKind;
  status?: ScopingArtifactStatus;
}) {
  return prisma.workflowScopingArtifact.findMany({
    where: {
      workflowId: input.workflowId,
      ...(input.kind ? { kind: input.kind } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
    orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
  });
}

export async function createScopingArtifact(
  workflowId: string,
  input: unknown,
  defaults: Partial<WorkflowSpecArtifactInput> = {}
) {
  const artifact = normalizeArtifactInput(input, defaults);
  return prisma.workflowScopingArtifact.create({
    data: {
      workflowId,
      kind: artifact.kind,
      title: artifact.title,
      detail: artifact.detail,
      status: artifact.status ?? "open",
      severity: artifact.severity ?? "info",
      owner: artifact.owner ?? null,
      source: artifact.source ?? "manual",
      metadata: (artifact.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function createManyScopingArtifacts(
  workflowId: string,
  inputs: unknown[],
  defaults: Partial<WorkflowSpecArtifactInput> = {}
) {
  const artifacts = inputs.map((input) => normalizeArtifactInput(input, defaults));
  if (artifacts.length === 0) return [];

  return prisma.$transaction(
    artifacts.map((artifact) =>
      prisma.workflowScopingArtifact.create({
        data: {
          workflowId,
          kind: artifact.kind,
          title: artifact.title,
          detail: artifact.detail,
          status: artifact.status ?? "open",
          severity: artifact.severity ?? "info",
          owner: artifact.owner ?? null,
          source: artifact.source ?? defaults.source ?? "manual",
          metadata: (artifact.metadata ?? {}) as Prisma.InputJsonValue,
        },
      })
    )
  );
}

export async function updateScopingArtifact(input: {
  workflowId: string;
  artifactId: string;
  updates: Record<string, unknown>;
}) {
  const data: Prisma.WorkflowScopingArtifactUpdateInput = {};
  if (isScopingArtifactKind(input.updates.kind)) data.kind = input.updates.kind;
  if (isScopingArtifactStatus(input.updates.status)) data.status = input.updates.status;
  if (isScopingArtifactSeverity(input.updates.severity)) data.severity = input.updates.severity;
  if (isScopingArtifactSource(input.updates.source)) data.source = input.updates.source;
  if (typeof input.updates.title === "string" && input.updates.title.trim()) {
    data.title = input.updates.title.trim();
  }
  if (typeof input.updates.detail === "string" && input.updates.detail.trim()) {
    data.detail = input.updates.detail.trim();
  }
  if (typeof input.updates.owner === "string") {
    data.owner = input.updates.owner.trim() || null;
  }
  if (
    input.updates.metadata &&
    typeof input.updates.metadata === "object" &&
    !Array.isArray(input.updates.metadata)
  ) {
    data.metadata = input.updates.metadata as Prisma.InputJsonValue;
  }

  if (Object.keys(data).length === 0) {
    throw new ScopingInputError("No valid artifact updates provided");
  }

  const result = await prisma.workflowScopingArtifact.updateMany({
    where: { id: input.artifactId, workflowId: input.workflowId },
    data,
  });
  if (result.count === 0) {
    throw new ScopingInputError("Scoping artifact not found");
  }

  return prisma.workflowScopingArtifact.findUniqueOrThrow({
    where: { id: input.artifactId },
  });
}

export async function deleteScopingArtifact(input: {
  workflowId: string;
  artifactId: string;
}) {
  const result = await prisma.workflowScopingArtifact.deleteMany({
    where: { id: input.artifactId, workflowId: input.workflowId },
  });
  if (result.count === 0) {
    throw new ScopingInputError("Scoping artifact not found");
  }
  return { success: true };
}

export function generateCustomerSummaryText(input: {
  workflow: { clientName: string; workflowName: string; id: string };
  nodes: Node[];
  edges: Edge[];
  findings?: WorkflowValidationFinding[];
  artifacts?: Array<{
    kind: string;
    title: string;
    detail: string;
    status: string;
    severity: string;
  }>;
  editUrl: string;
}) {
  const findings = input.findings ?? validateWorkflow(input.nodes, input.edges);
  const artifacts = input.artifacts ?? [];
  const assumptions = artifacts.filter((item) => item.kind === "assumption");
  const questions = artifacts.filter((item) => item.kind === "open_question");
  const risks = artifacts.filter((item) => item.kind === "risk");
  const highFindings = findings.filter(
    (finding) => finding.severity === "high" || finding.severity === "critical"
  );

  const lines = [
    `Workflow summary for ${input.workflow.clientName} - ${input.workflow.workflowName}`,
    "",
    `Draft workflow map: ${input.editUrl}`,
    "",
    `Scope captured: ${input.nodes.length} step${input.nodes.length === 1 ? "" : "s"} and ${input.edges.length} connector${input.edges.length === 1 ? "" : "s"}.`,
  ];

  if (highFindings.length > 0) {
    lines.push("", "Implementation checks:");
    highFindings.slice(0, 8).forEach((finding) => {
      lines.push(`- ${finding.message}${finding.recommendation ? ` Recommendation: ${finding.recommendation}` : ""}`);
    });
  }

  if (assumptions.length > 0) {
    lines.push("", "Assumptions:");
    assumptions.slice(0, 8).forEach((item) => lines.push(`- ${item.title}: ${item.detail}`));
  }

  if (questions.length > 0) {
    lines.push("", "Open questions:");
    questions.slice(0, 8).forEach((item) => lines.push(`- ${item.title}: ${item.detail}`));
  }

  if (risks.length > 0) {
    lines.push("", "Risks:");
    risks.slice(0, 8).forEach((item) => lines.push(`- ${item.title}: ${item.detail}`));
  }

  lines.push("", "Next step: review the map with the customer, resolve open questions, then share the approved workflow view.");

  return lines.join("\n");
}
