"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  ConnectionMode,
  MarkerType,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import { toast } from "@/components/workflow/ui/toast";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import LoadingButton from "@/components/workflow/ui/LoadingButton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import StageNode from "../nodes/StageNode";
import DecisionNode from "../nodes/DecisionNode";
import IntegrationNode from "../nodes/IntegrationNode";
import CommunicationNode from "../nodes/CommunicationNode";
import ParallelNode from "../nodes/ParallelNode";
import WaitNode from "../nodes/WaitNode";
import ManualActionNode from "../nodes/ManualActionNode";
import SourceNode from "../nodes/SourceNode";
import TableNode from "../nodes/TableNode";
import CustomEdge from "../edges/CustomEdge";
import { getLayoutedElements } from "@/lib/workflow/layout";
import {
  DEFAULT_EDGE_DATA,
  type EdgeMarkerType,
  type WorkflowEdgeData,
} from "@/lib/workflow/types";

const previewNodeTypes: NodeTypes = {
  stage: StageNode,
  decision: DecisionNode,
  integration: IntegrationNode,
  communication: CommunicationNode,
  parallel: ParallelNode,
  wait: WaitNode,
  manual_action: ManualActionNode,
  source: SourceNode,
  table: TableNode,
};

const previewEdgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

function markerFromData(marker: EdgeMarkerType) {
  if (marker === "arrow") return MarkerType.Arrow;
  if (marker === "arrowclosed") return MarkerType.ArrowClosed;
  return undefined;
}

function normalizePreviewEdge(edge: Edge): Edge {
  const data = {
    ...DEFAULT_EDGE_DATA,
    ...((edge.data ?? {}) as Partial<WorkflowEdgeData>),
  };
  return {
    ...edge,
    type: "custom",
    markerStart: markerFromData(data.markerStart),
    markerEnd: markerFromData(data.markerEnd),
    animated: data.animated === true,
    data,
  };
}

interface Summary {
  confirmed: number;
  likely: number;
  needsReview: number;
  flags: string[];
}

interface GenerateResult {
  nodes: Node[];
  edges: Edge[];
  summary: Summary;
}

interface AIGenerateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (nodes: Node[], edges: Edge[]) => void;
}

// ─── Inner preview (needs ReactFlow context) ─────────────────────────────────

function PreviewCanvas({
  nodes,
  edges,
}: {
  nodes: Node[];
  edges: Edge[];
}) {
  const previewEdges = edges.map(normalizePreviewEdge);

  return (
    <ReactFlow
      nodes={nodes}
      edges={previewEdges}
      nodeTypes={previewNodeTypes}
      edgeTypes={previewEdgeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      connectionMode={ConnectionMode.Loose}
      elementsSelectable={false}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      className="bg-gray-50"
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={16}
        size={1}
        color="#e5e7eb"
      />
    </ReactFlow>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function AIGenerateModal({
  open,
  onOpenChange,
  onApply,
}: AIGenerateModalProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [expandedFlags, setExpandedFlags] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setPrompt("");
        setError(null);
        setResult(null);
        setExpandedFlags(false);
        setLoading(false);
      }, 200);
    }
  }, [open]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/workflows/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Generation failed. Please try again.");
        return;
      }

      // Apply Dagre auto-layout to the returned nodes
      const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(
        data.nodes,
        data.edges
      );

      setResult({
        nodes: layouted as Node[],
        edges: layoutedEdges as Edge[],
        summary: data.summary,
      });
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [prompt]);

  function handleApply() {
    if (!result) return;
    onApply(result.nodes, result.edges);
    onOpenChange(false);
    toast.success(
      `Applied ${result.nodes.length} nodes to canvas`
    );
  }

  const hasResult = !!result;
  const { confirmed = 0, likely = 0, needsReview = 0, flags = [] } =
    result?.summary ?? {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`transition-all duration-300 ${
          hasResult ? "max-w-5xl" : "max-w-lg"
        } max-h-[90vh] overflow-hidden flex flex-col`}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-500" />
            AI Workflow Generator
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0 gap-4 overflow-auto">
          {/* ── Prompt area ── */}
          <div className="shrink-0">
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Describe the recruitment process
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`e.g. "BPO voice campaign. Candidates apply via Facebook or job board, get a screening chatbot, then an AI phone call. If they pass, a recruiter schedules an ops interview. Pass → offer. Fail → rejection SMS."`}
              rows={hasResult ? 3 : 5}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none resize-none"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-400">
                Be specific: include sourcing channels, screening steps, decision points, and integrations.
              </p>
              <div className="flex items-center gap-2 shrink-0">
                {hasResult && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerate}
                    disabled={loading || !prompt.trim()}
                    className="gap-1.5 text-xs"
                  >
                    {loading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    Regenerate
                  </Button>
                )}
                {!hasResult && (
                  <LoadingButton
                    onClick={handleGenerate}
                    variant="cta"
                    isLoading={loading}
                    disabled={!prompt.trim()}
                    className="gap-1.5 text-sm"
                  >
                    {!loading && <Sparkles className="w-4 h-4" />}
                    {loading ? "Generating…" : "Generate"}
                  </LoadingButton>
                )}
              </div>
            </div>
          </div>

          {/* ── Loading state ── */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
              <p className="text-sm font-medium text-gray-600">
                Mapping your workflow…
              </p>
              <p className="text-xs text-gray-400 text-center max-w-xs">
                Claude is analyzing the process and mapping each step to Talkpush capabilities.
              </p>
            </div>
          )}

          {/* ── Error state ── */}
          {error && !loading && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
              <X className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-700">
                  Generation failed
                </p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={!prompt.trim()}
                  className="mt-2 text-xs border-red-200 text-red-600 hover:bg-red-50"
                >
                  Try again
                </Button>
              </div>
            </div>
          )}

          {/* ── Result: preview + summary ── */}
          {hasResult && !loading && (
            <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
              {/* Canvas preview */}
              <div className="flex-1 min-h-0 rounded-lg border border-gray-200 overflow-hidden" style={{ minHeight: 320 }}>
                <ReactFlowProvider>
                  <PreviewCanvas
                    nodes={result!.nodes}
                    edges={result!.edges}
                  />
                </ReactFlowProvider>
              </div>

              {/* Summary panel */}
              <div className="lg:w-56 shrink-0 flex flex-col gap-3">
                <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Feasibility Summary
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-xs text-gray-700">Confirmed</span>
                    </div>
                    <span className="text-xs font-semibold text-green-600">
                      {confirmed}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-xs text-gray-700">Likely</span>
                    </div>
                    <span className="text-xs font-semibold text-blue-600">
                      {likely}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-xs text-gray-700">Needs Review</span>
                    </div>
                    <span className="text-xs font-semibold text-amber-600">
                      {needsReview}
                    </span>
                  </div>

                  <div className="border-t border-gray-100 pt-2">
                    <p className="text-xs text-gray-500">
                      {result!.nodes.length} nodes · {result!.edges.length} edges
                    </p>
                  </div>
                </div>

                {/* Flags */}
                {flags.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <button
                      onClick={() => setExpandedFlags((v) => !v)}
                      className="flex items-center justify-between w-full"
                    >
                      <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {flags.length} flag{flags.length !== 1 ? "s" : ""}
                      </p>
                      <span className="text-[10px] text-amber-600">
                        {expandedFlags ? "hide" : "show"}
                      </span>
                    </button>

                    {expandedFlags && (
                      <ul className="mt-2 space-y-1.5">
                        {flags.map((flag, i) => (
                          <li
                            key={i}
                            className="text-[11px] text-amber-700 leading-snug"
                          >
                            · {flag}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Hint about needs_review nodes */}
                {needsReview > 0 && (
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Nodes marked ⚠ need your review before sharing with the client.
                    Click them on the canvas to read the flag.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {hasResult && !loading && (
          <div className="flex items-center justify-between pt-3 border-t border-gray-200 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-gray-500"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              variant="cta"
              className="gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              Apply to Canvas
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
