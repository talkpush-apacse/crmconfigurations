import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { WORKFLOW_AI_SYSTEM_PROMPT } from "@/lib/workflow/ai-prompt";
import {
  DEFAULT_EDGE_DATA,
  DEFAULT_TABLE_DATA,
  type EdgeLineType,
  type EdgeMarkerType,
  type PathSemantic,
} from "@/lib/workflow/types";

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();
}

const NODE_LABEL_MAX = 40;
const EDGE_LABEL_MAX = 12;

type TruncCounters = { nodes: number; edges: number };

// Belt-and-suspenders: the system prompt caps label length, but when Claude
// slips and produces a verbose label, we truncate here so the canvas doesn't
// break. The full original label is preserved in notes.
function enforceNodeLabelCap(
  node: unknown,
  counters: TruncCounters
): unknown {
  if (!node || typeof node !== "object") return node;
  const raw = node as Record<string, unknown>;
  const data =
    raw.data && typeof raw.data === "object"
      ? (raw.data as Record<string, unknown>)
      : undefined;
  if (!data) return node;

  const label = data.label;
  if (typeof label !== "string" || label.length <= NODE_LABEL_MAX) return node;

  const truncated = `${label.slice(0, NODE_LABEL_MAX - 3)}…`;
  const existingNotes =
    typeof data.notes === "string" ? data.notes : "";
  const fullLabelLine = `Full label: ${label}`;
  const notes = existingNotes.includes(fullLabelLine)
    ? existingNotes
    : existingNotes
      ? `${existingNotes}\n${fullLabelLine}`
      : fullLabelLine;

  counters.nodes += 1;
  return {
    ...raw,
    data: {
      ...data,
      label: truncated,
      notes,
    },
  };
}

function enforceEdgeLabelCap(
  edge: unknown,
  counters: TruncCounters
): unknown {
  if (!edge || typeof edge !== "object") return edge;
  const raw = edge as Record<string, unknown>;
  const data =
    raw.data && typeof raw.data === "object"
      ? (raw.data as Record<string, unknown>)
      : undefined;
  if (!data) return edge;

  const label = data.label;
  if (typeof label !== "string" || label.length <= EDGE_LABEL_MAX) return edge;

  const truncated = `${label.slice(0, EDGE_LABEL_MAX - 2)}…`;
  counters.edges += 1;
  // Mirror the truncation onto the legacy top-level label field so the
  // renderer doesn't read the original long string from there.
  const topLabel =
    typeof raw.label === "string" && raw.label === label ? truncated : raw.label;
  return {
    ...raw,
    label: topLabel,
    data: {
      ...data,
      label: truncated,
    },
  };
}

function cloneTableDefaults() {
  return structuredClone(DEFAULT_TABLE_DATA) as typeof DEFAULT_TABLE_DATA;
}

function normalizeLineType(value: unknown): EdgeLineType {
  return value === "straight" ||
    value === "step" ||
    value === "smoothstep" ||
    value === "bezier"
    ? value
    : DEFAULT_EDGE_DATA.lineType;
}

function normalizeMarker(value: unknown, fallback: EdgeMarkerType): EdgeMarkerType {
  return value === "none" || value === "arrow" || value === "arrowclosed"
    ? value
    : fallback;
}

function normalizeGeneratedNode(node: unknown) {
  if (!node || typeof node !== "object") return node;
  const raw = node as Record<string, unknown>;
  const data =
    raw.data && typeof raw.data === "object"
      ? (raw.data as Record<string, unknown>)
      : {};
  const type =
    typeof raw.type === "string"
      ? raw.type
      : typeof data.type === "string"
        ? data.type
        : "stage";

  if (type !== "table") {
    return {
      ...raw,
      type,
      data: {
        ...data,
        type,
      },
    };
  }

  const table = cloneTableDefaults();
  return {
    ...raw,
    type: "table",
    data: {
      ...data,
      ...table,
      label: typeof data.label === "string" ? data.label : table.label,
      type: "table",
      actor: undefined,
      actorLabel: "",
      notes: typeof data.notes === "string" ? data.notes : "",
      feasibility:
        data.feasibility === "likely" || data.feasibility === "needs_review"
          ? data.feasibility
          : "confirmed",
      feasibilityNote:
        typeof data.feasibilityNote === "string"
          ? data.feasibilityNote
          : undefined,
      data:
        data.data && typeof data.data === "object"
          ? data.data
          : {},
      columns:
        Array.isArray(data.columns) && data.columns.length > 0
          ? data.columns
          : table.columns,
      rows:
        Array.isArray(data.rows) && data.rows.length > 0
          ? data.rows
          : table.rows,
      headerColor:
        typeof data.headerColor === "string"
          ? data.headerColor
          : table.headerColor,
      compact:
        typeof data.compact === "boolean" ? data.compact : table.compact,
    },
  };
}

function normalizeGeneratedEdge(edge: unknown) {
  if (!edge || typeof edge !== "object") return edge;
  const raw = edge as Record<string, unknown>;
  const data =
    raw.data && typeof raw.data === "object"
      ? (raw.data as Record<string, unknown>)
      : {};
  const legacyLabel =
    typeof raw.label === "string" && raw.label.trim()
      ? raw.label
      : undefined;
  const dataLabel =
    typeof data.label === "string" && data.label.trim()
      ? data.label
      : legacyLabel;
  const merged = {
    ...DEFAULT_EDGE_DATA,
    ...data,
    label: dataLabel ?? DEFAULT_EDGE_DATA.label,
    lineType: normalizeLineType(data.lineType),
    markerStart: normalizeMarker(data.markerStart, DEFAULT_EDGE_DATA.markerStart),
    markerEnd: normalizeMarker(data.markerEnd, DEFAULT_EDGE_DATA.markerEnd),
    strokeWidth:
      data.strokeWidth === 1 || data.strokeWidth === 2 || data.strokeWidth === 3
        ? data.strokeWidth
        : DEFAULT_EDGE_DATA.strokeWidth,
    animated:
      typeof data.animated === "boolean"
        ? data.animated
        : DEFAULT_EDGE_DATA.animated,
    isHappyPath: data.isHappyPath === true,
    isRecovery: data.isRecovery === true,
    pathSemantic: (
      data.pathSemantic === "happy" || data.pathSemantic === "failure" ||
      data.pathSemantic === "recovery" || data.pathSemantic === "neutral"
        ? data.pathSemantic
        : data.isRecovery === true ? "recovery"
        : data.isHappyPath === true ? "happy"
        : "neutral"
    ) as PathSemantic,
  };

  return {
    ...raw,
    type: "custom",
    label: legacyLabel ?? merged.label ?? "",
    data: merged,
  };
}

const DEFAULT_AI_MODEL = "claude-sonnet-5-5";

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "AI workflow generation is unavailable because ANTHROPIC_API_KEY is not configured.",
        },
        { status: 503 }
      );
    }

    // Plain HTTPS call to the Messages API: this app does not install the Anthropic SDK.
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.WORKFLOW_AI_MODEL || DEFAULT_AI_MODEL,
        max_tokens: 4096,
        system: WORKFLOW_AI_SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt.trim() }],
      }),
    });

    if (!aiResponse.ok) {
      const detail = await aiResponse.text().catch(() => "");
      console.error("AI generate — upstream error:", aiResponse.status, detail.slice(0, 500));
      return NextResponse.json(
        { error: "The AI service could not complete the request. Please try again." },
        { status: aiResponse.status === 429 ? 429 : 502 }
      );
    }

    const message = (await aiResponse.json()) as { content?: { type: string; text?: string }[] };
    const first = message.content?.[0];
    const rawText = first?.type === "text" ? (first.text ?? "") : "";

    const cleaned = stripMarkdownFences(rawText);

    let parsed: { nodes: unknown[]; edges: unknown[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("AI generate — JSON parse failed:", cleaned.slice(0, 500));
      return NextResponse.json(
        {
          error:
            "The AI returned an unexpected format. Please rephrase your prompt and try again.",
        },
        { status: 422 }
      );
    }

    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      return NextResponse.json(
        { error: "Invalid response structure from AI. Please try again." },
        { status: 422 }
      );
    }

    const truncCounters: TruncCounters = { nodes: 0, edges: 0 };
    const normalizedNodes = parsed.nodes
      .map(normalizeGeneratedNode)
      .map((node) => enforceNodeLabelCap(node, truncCounters));
    const normalizedEdges = parsed.edges
      .map(normalizeGeneratedEdge)
      .map((edge) => enforceEdgeLabelCap(edge, truncCounters));

    if (truncCounters.nodes > 0 || truncCounters.edges > 0) {
      console.warn(
        `AI generate — truncated ${truncCounters.nodes} node label(s) and ${truncCounters.edges} edge label(s) over caps.`
      );
    }

    // Build summary
    let confirmed = 0;
    let likely = 0;
    let needsReview = 0;
    const flags: string[] = [];

    for (const node of normalizedNodes) {
      const n = node as Record<string, unknown>;
      const data = n.data as Record<string, unknown> | undefined;
      const feasibility = data?.feasibility as string | undefined;

      if (feasibility === "confirmed") confirmed++;
      else if (feasibility === "likely") likely++;
      else if (feasibility === "needs_review") {
        needsReview++;
        const note = data?.feasibilityNote as string | undefined;
        const label = data?.label as string | undefined;
        if (note) flags.push(`${label ?? "Node"}: ${note}`);
      }
    }

    return NextResponse.json({
      nodes: normalizedNodes,
      edges: normalizedEdges,
      summary: { confirmed, likely, needsReview, flags },
    });
  } catch (err) {
    console.error("POST /api/workflows/generate error:", err);

    return NextResponse.json(
      { error: "Failed to generate workflow. Please try again." },
      { status: 500 }
    );
  }
}
