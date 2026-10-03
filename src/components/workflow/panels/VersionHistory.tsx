"use client";

import { useState } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import { Eye, Loader2, Plus, RotateCcw, X } from "lucide-react";
import { format } from "@/lib/workflow/dates";
import { normalizeWorkflowEdgeData as normalizeEdgeData } from "@/lib/workflow/normalize";
import { toast } from "@/components/workflow/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LoadingButton from "@/components/workflow/ui/LoadingButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import StageNode from "../nodes/StageNode";
import DecisionNode from "../nodes/DecisionNode";
import IntegrationNode from "../nodes/IntegrationNode";
import CommunicationNode from "../nodes/CommunicationNode";
import ParallelNode from "../nodes/ParallelNode";
import WaitNode from "../nodes/WaitNode";
import ManualActionNode from "../nodes/ManualActionNode";
import SourceNode from "../nodes/SourceNode";
import TableNode from "../nodes/TableNode";
import SwimlaneNode from "../nodes/SwimlaneNode";
import FrameNode from "../nodes/FrameNode";
import CustomEdge from "../edges/CustomEdge";
import {
  DEFAULT_EDGE_DATA,
  type EdgeMarkerType,
  WORKFLOW_STATUS_CONFIG,
  type WorkflowEdgeData,
  type WorkflowNodeData,
  type WorkflowProject,
  type WorkflowStatus,
  type WorkflowVersion,
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
  swimlane: SwimlaneNode,
  frame: FrameNode,
};

const previewEdgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

function markerFromData(marker: EdgeMarkerType) {
  if (marker === "arrow") return MarkerType.Arrow;
  if (marker === "arrowclosed") return MarkerType.ArrowClosed;
  return undefined;
}

type FlowNode = Node<Record<string, unknown>>;

interface VersionListItem {
  id: string;
  versionNumber: number;
  label?: string | null;
  status: string;
  triggeredBy: string;
  triggerDetail?: string | null;
  createdByName?: string | null;
  nodeCount: number;
  edgeCount: number;
  createdAt: string;
}

interface VersionHistoryProps {
  workflowId: string;
  currentVersion: number;
  versions: VersionListItem[];
  loading: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void> | void;
  onRestore: (workflow: WorkflowProject) => Promise<void> | void;
}

export default function VersionHistory({
  workflowId,
  currentVersion,
  versions,
  loading,
  onClose,
  onRefresh,
  onRestore,
}: VersionHistoryProps) {
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [label, setLabel] = useState("");
  const [savingVersion, setSavingVersion] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<WorkflowVersion | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<VersionListItem | null>(null);
  const [restoring, setRestoring] = useState(false);

  async function handleSaveCurrentVersion() {
    setSavingVersion(true);

    try {
      const res = await fetch(`/api/workflows/${workflowId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(label.trim() ? { label: label.trim() } : {}),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save version");
      }

      setShowSaveForm(false);
      setLabel("");
      toast.success("Version saved");
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save version");
    } finally {
      setSavingVersion(false);
    }
  }

  async function handlePreview(versionId: string) {
    setPreviewLoadingId(versionId);

    try {
      const res = await fetch(`/api/workflows/${workflowId}/versions/${versionId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load version preview");
      }

      setPreviewVersion(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load version preview");
    } finally {
      setPreviewLoadingId(null);
    }
  }

  async function confirmRestore() {
    if (!restoreTarget) return;

    setRestoring(true);

    try {
      const res = await fetch(
        `/api/workflows/${workflowId}/versions/${restoreTarget.id}/restore`,
        { method: "POST" }
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to restore version");
      }

      await onRestore(data);
      toast.success(`Restored to v${restoreTarget.versionNumber}`);
      setRestoreTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restore version");
    } finally {
      setRestoring(false);
    }
  }

  const previewNodes = (previewVersion?.nodes as unknown as FlowNode[]) ?? [];
  const previewEdges = ((previewVersion?.edges as unknown as Edge[]) ?? []).map(
    (edge) => {
      const data = normalizeEdgeData(edge.data);
      return {
        ...edge,
        type: "custom",
        data,
        markerStart: markerFromData(data.markerStart),
        markerEnd: markerFromData(data.markerEnd),
        animated: data.animated === true,
      };
    }
  );

  return (
    <>
      <div className="w-80 h-full bg-white border-l border-gray-200 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Version History</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Snapshots, restores, and pinned-share history
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="px-4 py-3 border-b border-gray-100 shrink-0 space-y-3">
          {showSaveForm ? (
            <div className="space-y-2">
              <Input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Optional version label"
                className="border border-gray-300 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={savingVersion}
                  onClick={() => {
                    setShowSaveForm(false);
                    setLabel("");
                  }}
                >
                  Cancel
                </Button>
                <LoadingButton
                  size="sm"
                  variant="cta"
                  isLoading={savingVersion}
                  onClick={handleSaveCurrentVersion}
                  className="gap-1.5"
                >
                  {!savingVersion && <Plus className="w-3.5 h-3.5" />}
                  {savingVersion ? "Saving…" : "Save version"}
                </LoadingButton>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSaveForm(true)}
              className="w-full gap-1.5 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Save Current as Version
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
            </div>
          ) : versions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center">
              <p className="text-sm font-medium text-gray-700">No versions yet</p>
              <p className="text-xs text-gray-400 mt-1">
                The first snapshot appears after a save or status transition.
              </p>
            </div>
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-[11px] top-0 bottom-0 border-l-2 border-gray-200" />
              <div className="space-y-4">
                {versions.map((version) => {
                  const statusConfig =
                    WORKFLOW_STATUS_CONFIG[version.status as WorkflowStatus];
                  const isCurrent = version.versionNumber === currentVersion;

                  return (
                    <div key={version.id} className="relative">
                      <span
                        className={`absolute -left-[3px] top-5 h-3 w-3 rounded-full border-2 border-white ring-2 ring-white ${
                          isCurrent ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />

                      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="bg-teal-50 text-teal-700 font-mono text-xs rounded-full px-2 py-0.5">
                                v{version.versionNumber}
                              </span>
                              <span
                                className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${
                                  statusConfig?.className ?? "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {statusConfig?.label ?? version.status}
                              </span>
                            </div>

                            <p className="text-xs text-gray-500 mt-2">
                              {format(new Date(version.createdAt), "MMM d, yyyy 'at' h:mm a")}
                            </p>

                            {version.triggerDetail && (
                              <p className="text-xs text-gray-500 mt-1">
                                {version.triggerDetail}
                              </p>
                            )}

                            {version.createdByName && (
                              <p className="text-xs text-gray-500 mt-1">
                                By {version.createdByName}
                              </p>
                            )}

                            <p className="text-xs text-gray-400 mt-1">
                              {version.nodeCount} nodes · {version.edgeCount} edges
                            </p>

                            {version.label && (
                              <p className="text-xs italic text-gray-500 mt-1">
                                “{version.label}”
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={previewLoadingId === version.id}
                              onClick={() => handlePreview(version.id)}
                              className="h-7 px-2 text-xs"
                            >
                              {previewLoadingId === version.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                              <span className="ml-1">Preview</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRestoreTarget(version)}
                              className="h-7 px-2 text-xs text-teal-700 hover:text-teal-800 hover:bg-teal-50"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span className="ml-1">Restore</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={Boolean(previewVersion)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewVersion(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl w-[95vw] h-[80vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-gray-200">
            <DialogTitle>
              {previewVersion
                ? `Preview v${previewVersion.versionNumber}${previewVersion.label ? ` — ${previewVersion.label}` : ""}`
                : "Version preview"}
            </DialogTitle>
            <DialogDescription>
              Read-only preview of the selected workflow snapshot.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 h-[calc(80vh-73px)] w-full">
            <ReactFlowProvider>
              <ReactFlow
                nodes={previewNodes}
                edges={previewEdges}
                nodeTypes={previewNodeTypes}
                edgeTypes={previewEdgeTypes}
                nodesDraggable={false}
                nodesConnectable={false}
                connectionMode={ConnectionMode.Loose}
                elementsSelectable={false}
                fitView
                fitViewOptions={{ padding: 0.15 }}
                className="bg-gray-50"
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={16}
                  size={1}
                  color="#e5e7eb"
                />
                <Controls showInteractive={false} position="bottom-left" />
              </ReactFlow>
            </ReactFlowProvider>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(restoreTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRestoreTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {restoreTarget ? `Restore v${restoreTarget.versionNumber}?` : "Restore version"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the workflow to the selected version. Your current
              state will be auto-saved first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRestore}
              disabled={restoring}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {restoring && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
