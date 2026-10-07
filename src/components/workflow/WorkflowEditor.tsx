"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useRouter } from "next/navigation";
import { normalizeEdgeMarker, normalizeWorkflowEdgeData } from "@/lib/workflow/normalize";
import { exportWorkflowToPdf } from "@/lib/workflow/pdf-export";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  addEdge,
  applyNodeChanges,
  ConnectionMode,
  reconnectEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  SelectionMode,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  MarkerType,
  type EdgeTypes,
  type NodeTypes,
  type OnConnect,
  type OnConnectEnd,
  type Viewport,
} from "@xyflow/react";
import { toast } from "@/components/workflow/ui/toast";
import { nanoid } from "@/lib/workflow/ids";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LayoutTemplate,
  Link2,
  Link2Off,
  Loader2,
  Lock,
  Map as MapIcon,
  Maximize2,
  Minus,
  Plus,
  Trash2,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import LoadingButton from "@/components/workflow/ui/LoadingButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/workflow/ui/command";

import StageNode from "./nodes/StageNode";
import DecisionNode from "./nodes/DecisionNode";
import IntegrationNode from "./nodes/IntegrationNode";
import CommunicationNode from "./nodes/CommunicationNode";
import ParallelNode from "./nodes/ParallelNode";
import WaitNode from "./nodes/WaitNode";
import ManualActionNode from "./nodes/ManualActionNode";
import SourceNode from "./nodes/SourceNode";
import TableNode from "./nodes/TableNode";
import SwimlaneNode from "./nodes/SwimlaneNode";
import FrameNode from "./nodes/FrameNode";
import AnnotationNode from "./nodes/AnnotationNode";
import DanglingEndpointNode from "./nodes/DanglingEndpointNode";
import CustomEdge from "./edges/CustomEdge";
import EdgeContextMenu from "./EdgeContextMenu";
import EdgeTypeModal from "./EdgeTypeModal";
import NodeSuggestionPopup from "./NodeSuggestionPopup";
import NodePalette from "./panels/NodePalette";
import NodeProperties from "./panels/NodeProperties";
import EdgeProperties from "./panels/EdgeProperties";
import QuickAddBar from "./panels/QuickAddBar";
import SEBriefPanel from "./panels/SEBriefPanel";
import ShareDialog from "./share/ShareDialog";
import ReviewPanel from "./share/ReviewPanel";
import VersionHistory from "./panels/VersionHistory";
import PageTabs, { type PageTabsItem } from "./panels/PageTabs";
import EditorToolbar, { CanvasTools } from "./EditorToolbar";
import { toMermaid } from "@/lib/workflow/mermaid";
import { getLayoutedElements } from "@/lib/workflow/layout";
import { computeStepNumbers } from "@/lib/workflow/numbering";
import { computeDecimalNumbers } from "@/lib/workflow/numbering-decimal";
import { buildOutline } from "@/lib/workflow/outline";
import { applyLayout, layoutDiagram, usesLanes } from "@/lib/workflow/process-map/diagram-layout";
import { assignLanes, laneSummaries, moveLane, renameLane, setLaneExternal, setStepLane, stripLanes } from "@/lib/workflow/process-map/lane-edit";
import { lintLayout, type LayoutFinding } from "@/lib/workflow/process-map/lint";
import { buildScene } from "@/lib/workflow/process-map/scene";
import { ProcessMapContext } from "./process-map/context";
import { ProcessMapDefs, derivedProcessMapNodes } from "./process-map/nodes";
import { edgeTypesFor, nodeTypesFor } from "./registry";
import { StepNumberContext } from "@/components/workflow/StepNumberContext";
import { cn } from "@/lib/utils";
import { useCopyToClipboard } from "@/components/workflow/ui/useCopyToClipboard";
import {
  ACTOR_CONFIG,
  DEFAULT_EDGE_DATA,
  DEFAULT_TABLE_DATA,
  NODE_TYPE_CONFIG,
  type ActorType,
  type AnnotationNodeData,
  type AnnotationShapeType,
  type EdgeMarkerType,
  type FeasibilityLevel,
  type NodeSuggestionOpenRequest,
  type NodeSuggestionState,
  type NodeType,
  type PathSemantic,
  type WorkflowEdgeData,
  type WorkflowNodeData,
  type WorkflowNodeType,
  type WorkflowPage,
  type WorkflowProject,
} from "@/lib/workflow/types";

// ─── Node types registration ─────────────────────────────────────────────────

const nodeTypes: NodeTypes = {
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
  annotation: AnnotationNode,
  dangling_endpoint: DanglingEndpointNode,
};

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

// Container node types that act as visual groups
const CONTAINER_TYPES = new Set(["swimlane", "frame"]);

const DEFAULT_ACTOR_BY_NODE_TYPE: Partial<Record<NodeType, ActorType>> = {
  decision: "automated",
  integration: "integration",
  communication: "automated",
  wait: "automated",
  manual_action: "manual",
  source: "source",
};

const DEFAULT_LABEL_BY_NODE_TYPE: Record<WorkflowNodeType, string> = {
  source: "Start",
  stage: "New Stage",
  decision: "Decision Point",
  communication: "Send Notification",
  integration: "System Sync",
  parallel: "Parallel Process",
  wait: "Wait",
  manual_action: "Manual Review",
  table: "Data Table",
  terminator: "End",
  jump: "Go to step",
  note: "Note",
};

// ─── Data migration ───────────────────────────────────────────────────────────

const ACTOR_LABEL_MIGRATION: Record<string, string> = {
  "Manual": "Talkpush User",
  "Automated": "Talkpush Automation",
};

function migrateNodes(rawNodes: unknown): FlowNode[] {
  const arr = (rawNodes as FlowNode[]) ?? [];
  return arr.map((node) => {
    const data = node.data as WorkflowNodeData;
    const actorLabel = data?.actorLabel ?? "";
    const migratedLabel =
      ACTOR_LABEL_MIGRATION[actorLabel] ?? actorLabel;
    return { ...node, data: { ...data, actorLabel: migratedLabel } };
  });
}

function markerFromData(marker: EdgeMarkerType) {
  if (marker === "arrow") return MarkerType.Arrow;
  if (marker === "arrowclosed") return MarkerType.ArrowClosed;
  return undefined;
}

function applyEdgeRendering(edge: Edge, data: WorkflowEdgeData): Edge {
  return {
    ...edge,
    type: "custom",
    markerStart: markerFromData(data.markerStart),
    markerEnd: markerFromData(data.markerEnd),
    animated: data.animated === true,
  };
}

function migrateEdges(rawEdges: unknown): Edge[] {
  const arr = (rawEdges as Edge[]) ?? [];
  return arr.map((edge) => {
    const data = normalizeWorkflowEdgeData(edge.data);
    return applyEdgeRendering(
      {
        ...edge,
        sourceHandle: edge.sourceHandle ?? "bottom",
        targetHandle: edge.targetHandle ?? "top",
        data,
      },
      data
    );
  });
}

function migrateWorkflowData(workflow: WorkflowProject): WorkflowProject {
  // Update stale actorLabel values + ensure edge handles are named
  const migratedNodes = migrateNodes(workflow.nodes);
  const migratedEdges = migrateEdges(workflow.edges);

  // Apply same migrations across every page
  const pages = (workflow.pages ?? []).map((page) => ({
    ...page,
    nodes: migrateNodes(page.nodes) as unknown as WorkflowPage["nodes"],
    edges: migrateEdges(page.edges) as unknown as WorkflowPage["edges"],
  }));

  return {
    ...workflow,
    nodes: migratedNodes as unknown as typeof workflow.nodes,
    edges: migratedEdges as unknown as typeof workflow.edges,
    pages,
  };
}

// Build the initial pages array for the editor: prefer the multi-page
// snapshot when present, otherwise wrap the legacy nodes/edges/viewport in a
// synthetic "Page 1" so single-canvas workflows keep working unchanged.
function initialPagesFromWorkflow(workflow: WorkflowProject): WorkflowPage[] {
  const wfPages = (workflow.pages ?? []) as WorkflowPage[];
  if (wfPages.length > 0) return wfPages;
  return [
    {
      id: `page_${nanoid(8)}`,
      name: "Page 1",
      nodes: (workflow.nodes ?? []) as WorkflowPage["nodes"],
      edges: (workflow.edges ?? []) as WorkflowPage["edges"],
      viewport: workflow.viewport ?? { x: 0, y: 0, zoom: 1 },
    },
  ];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FlowNode = Node<any>;

type PendingSave = {
  nodes: FlowNode[];
  edges: Edge[];
  activePageId: string;
};

function createNode(
  type: Exclude<NodeType, "annotation" | "dangling_endpoint">,
  position: { x: number; y: number },
  label?: string,
  actor?: ActorType
): FlowNode {
  const typeConfig = NODE_TYPE_CONFIG[type];
  const defaultActor = type === "table" ? undefined : actor ?? DEFAULT_ACTOR_BY_NODE_TYPE[type];
  const actorConfig = defaultActor ? ACTOR_CONFIG[defaultActor] : null;
  const tableData =
    type === "table"
      ? (JSON.parse(JSON.stringify(DEFAULT_TABLE_DATA)) as typeof DEFAULT_TABLE_DATA)
      : null;
  const nodeLabel = label ?? tableData?.label ?? typeConfig.label;
  const node: FlowNode = {
    id: `node_${nanoid(8)}`,
    type,
    position,
    data: {
      ...(tableData ?? {}),
      label: nodeLabel,
      type,
      actor: defaultActor,
      actorLabel: actorConfig?.label ?? "",
      notes: "",
      feasibility: "confirmed" as FeasibilityLevel,
      data: {},
    } satisfies WorkflowNodeData,
  };
  if (type === "decision") {
    node.style = { width: 120, height: 120 };
  }
  // Process Map only steps start with sensible settings.
  if (type === "terminator") (node.data as Record<string, unknown>).endKind = "neutral";
  if (type === "jump") (node.data as Record<string, unknown>).jumpToNodeId = "";
  if (type === "note") (node.data as Record<string, unknown>).noteKind = "info";
  return node;
}

// ─── History helpers ──────────────────────────────────────────────────────────

interface HistorySnapshot {
  nodes: FlowNode[];
  edges: Edge[];
}

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

const MAX_HISTORY = 50;

// ─── Inner editor (inside ReactFlow context) ─────────────────────────────────

interface EditorInnerProps {
  workflow: WorkflowProject;
  onWorkflowNameChange: (name: string) => void;
  saveStatus: "saved" | "saving" | "unsaved";
  onSave: (
    nodes: FlowNode[],
    edges: Edge[],
    viewport: Viewport,
    pages: WorkflowPage[]
  ) => Promise<void>;
  /** Tell the save logic the server's revision changed behind the editor's back (restore, accepted suggestion). */
  onServerRevision: (revision: number) => void;
}

function EditorInner({
  workflow,
  onWorkflowNameChange,
  saveStatus,
  onSave,
  onServerRevision,
}: EditorInnerProps) {
  const router = useRouter();
  const {
    screenToFlowPosition,
    getViewport,
    getNodes,
    getEdges,
    setViewport,
    fitView,
    zoomIn,
    zoomOut,
  } = useReactFlow();

  // ── Pages state ─────────────────────────────────────────────────────────────
  // Pages are the source of truth for the workflow's canvases. nodes/edges
  // below mirror the *active* page; on every save we serialize the active
  // page back into the pages array and persist all of them.
  const initialPages = useMemo(() => initialPagesFromWorkflow(workflow), [workflow]);
  const [pages, setPages] = useState<WorkflowPage[]>(() => initialPages);
  const [activePageId, setActivePageId] = useState<string>(
    () => initialPages[0].id
  );

  // Refs so async/save closures always see the latest pages + active id
  const pagesRef = useRef<WorkflowPage[]>(pages);
  const activePageIdRef = useRef<string>(activePageId);
  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);
  useEffect(() => {
    activePageIdRef.current = activePageId;
  }, [activePageId]);

  // ── React Flow state ────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [nodes, setNodes] = useNodesState<any>(
    (pages[0].nodes as unknown as FlowNode[]) ?? []
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    (pages[0].edges as unknown as Edge[]) ?? []
  );

  // ── UI state ────────────────────────────────────────────────────────────────
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<{ nodes: FlowNode[]; edges: Edge[] } | null>(null);
  const [renumberVersion, setRenumberVersion] = useState(0);
  // Open beside the canvas on desktop; on a phone it starts closed so the canvas keeps the screen.
  const [sidebarOpen, setSidebarOpen] = useState(() => (typeof window === "undefined" ? true : window.innerWidth >= 768));
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(workflow.workflowName);
  const [lassoMode, setLassoMode] = useState(true);
  // The minimap would cover most of a phone-width canvas, so it starts hidden there.
  const [showMinimap, setShowMinimap] = useState(() => typeof window === "undefined" || window.innerWidth >= 768);
  const [commandOpen, setCommandOpen] = useState(false);
  const [versionPanelOpen, setVersionPanelOpen] = useState(false);
  const [seBriefOpen, setSeBriefOpen] = useState(false);
  const [versions, setVersions] = useState<VersionListItem[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  // How the diagram is drawn: the original look, or the Lucid-style Process Map (decimal numbering, spine layout).
  const [diagramStyle, setDiagramStyle] = useState<"classic" | "process_map">(workflow.diagramStyle === "process_map" ? "process_map" : "classic");
  // How a Process Map is drawn: "original" (every map before the readability pass) or "readable" (new maps).
  const [look, setLook] = useState<"original" | "readable">(workflow.look === "readable" ? "readable" : "original");
  const isProcessMap = diagramStyle === "process_map";
  const isProcessMapRef = useRef(isProcessMap);
  useEffect(() => {
    isProcessMapRef.current = isProcessMap;
  }, [isProcessMap]);
  const [layoutPreview, setLayoutPreview] = useState<{ moved: number; apply: () => void; message?: string } | null>(null);
  const [layoutCheckOpen, setLayoutCheckOpen] = useState(false);

  const { stepNumbers, recoveryEdges, warnings, overflowNodes, mergeNodes } = useMemo(
    () => (isProcessMap ? computeDecimalNumbers(nodes, edges) : computeStepNumbers(nodes as FlowNode[], edges)),
    [nodes, edges, renumberVersion, isProcessMap]
  );

  // ── Edge label editing ──────────────────────────────────────────────────────
  const [editingEdge, setEditingEdge] = useState<{
    id: string;
    label: string;
    x: number;
    y: number;
  } | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{
    edgeId: string;
    position: { x: number; y: number };
  } | null>(null);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [pendingReconnect, setPendingReconnect] = useState<{
    oldEdge: Edge;
    connection: Connection;
  } | null>(null);
  const [edgeTypeModalOpen, setEdgeTypeModalOpen] = useState(false);
  const reconnectingRef = useRef(false);
  const [nodeSuggestionState, setNodeSuggestionState] = useState<NodeSuggestionState>({
    open: false,
    position: { x: 0, y: 0 },
    popupPosition: { x: 0, y: 0 },
    sourceNodeId: null,
    sourceNodeType: null,
    sourceHandle: null,
  });


  // ── Measure-before-layout ───────────────────────────────────────────────────
  // React Flow reports real rendered dimensions after nodes mount. We cache
  // them here and, when a "net-new nodes arrived" pass is pending (nothing sets the flag
  // right now), re-run Dagre with actual sizes so long labels
  // don't overlap.
  const nodeDimensionsRef = useRef<Map<string, { width: number; height: number }>>(
    new Map()
  );
  const measurementPendingRef = useRef<boolean>(false);
  const measurementDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Layer visibility toggles ─────────────────────────────────────────────────
  const [showWorkflowNodes, setShowWorkflowNodes] = useState(true);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showStepNumbers, setShowStepNumbers] = useState(true);

  // Process Map: exact shapes and connectors. The same scene feeds the canvas, the layout check and the exports.
  const scene = useMemo(
    () =>
      isProcessMap
        ? buildScene(nodes, edges, {
            clientName: workflow.clientName,
            workflowName: workflow.workflowName,
            versionLabel: workflow.currentVersion ? `v${workflow.currentVersion}` : "Draft",
            date: new Date().toISOString().slice(0, 10),
            author: "Talkpush",
            hideNumbers: !showStepNumbers,
            look,
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isProcessMap, nodes, edges, workflow.clientName, workflow.workflowName, workflow.currentVersion, showStepNumbers, look]
  );
  const layoutFindings = useMemo<LayoutFinding[]>(() => (scene ? lintLayout(scene) : []), [scene]);
  // Lanes: the diagram is drawn as lanes when its steps carry lanes. The sidebar and the step panel edit them.
  const lanesMode = useMemo(() => isProcessMap && usesLanes(nodes), [isProcessMap, nodes]);
  const laneList = useMemo(() => (isProcessMap ? laneSummaries(nodes, edges) : []), [isProcessMap, nodes, edges]);
  const outlineItems = useMemo(() => buildOutline(nodes, stepNumbers), [nodes, stepNumbers]);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [isCanvasLocked, setIsCanvasLocked] = useState(false);

  // ── Export, Share & Template ────────────────────────────────────────────────
  const canvasRef = useRef<HTMLDivElement>(null);
  const [shareToken, setShareToken] = useState<string | null>(workflow.shareToken ?? null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateIndustry, setTemplateIndustry] = useState("general");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const { copy: copyMermaid } = useCopyToClipboard({
    successMessage: "Mermaid diagram copied to clipboard",
    errorMessage: "Failed to copy to clipboard",
  });

  const fetchVersions = useCallback(async () => {
    setVersionsLoading(true);
    try {
      const res = await fetch(`/api/workflows/${workflow.id}/versions`);
      if (!res.ok) {
        throw new Error();
      }
      const data = await res.json();
      setVersions(data.items ?? []);
    } catch (err) {
      console.error("Failed to fetch versions:", err);
    } finally {
      setVersionsLoading(false);
    }
  }, [workflow.id]);

  // ── Auto-save ───────────────────────────────────────────────────────────────
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = useRef<PendingSave | null>(null);

  // Build a fresh pages array where the active page reflects the current
  // canvas state. Used by triggerSave + every page-management operation so
  // we never persist a stale snapshot of the active canvas.
  const buildUpdatedPages = useCallback(
    (
      newNodes: FlowNode[],
      newEdges: Edge[],
      vp: Viewport,
      currentActivePageId: string
    ): WorkflowPage[] => {
      const currentPages = pagesRef.current;
      return currentPages.map((p) =>
        p.id === currentActivePageId
          ? {
              ...p,
              nodes: newNodes as unknown as WorkflowPage["nodes"],
              edges: newEdges as unknown as WorkflowPage["edges"],
              viewport: vp,
            }
          : p
      );
    },
    []
  );

  const clearPendingSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    pendingSaveRef.current = null;
  }, []);

  const flushPendingSave = useCallback(
    (updateState: boolean) => {
      const pending = pendingSaveRef.current;
      if (!pending) return;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      pendingSaveRef.current = null;

      const vp = getViewport();
      const updatedPages = buildUpdatedPages(
        pending.nodes,
        pending.edges,
        vp,
        pending.activePageId
      );
      if (updateState) setPages(updatedPages);
      pagesRef.current = updatedPages;
      void onSave(pending.nodes, pending.edges, vp, updatedPages);
    },
    [buildUpdatedPages, getViewport, onSave]
  );

  const triggerSave = useCallback(
    (newNodes: FlowNode[], newEdges: Edge[], currentActivePageId: string) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      pendingSaveRef.current = {
        nodes: newNodes,
        edges: newEdges,
        activePageId: currentActivePageId,
      };
      saveTimerRef.current = setTimeout(() => {
        flushPendingSave(true);
      }, 2000);
    },
    [flushPendingSave]
  );

  useEffect(() => {
    return () => {
      // Flush a pending debounce so edits made just before navigation are persisted.
      flushPendingSave(false);
    };
  }, [flushPendingSave]);

  /** Save the canvas as it is now (used by the "Retry" button after a failed save). */
  function retrySave() {
    const vp = getViewport();
    const updatedPages = buildUpdatedPages(nodes, edges, vp, activePageIdRef.current);
    pagesRef.current = updatedPages;
    void onSave(nodes, edges, vp, updatedPages);
  }

  // Closing the tab inside the 2 second wait must not lose work: send it now (the request is allowed to outlive the
  // page), and warn if something is still unsaved.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const hadPending = Boolean(pendingSaveRef.current);
      flushPendingSave(false);
      if (hadPending || saveStatusRef.current !== "saved") e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [flushPendingSave]);
  const saveStatusRef = useRef(saveStatus);
  useEffect(() => {
    saveStatusRef.current = saveStatus;
  }, [saveStatus]);

  // One-key shortcuts (only when you are not typing): ? shows them, F fits the diagram to the screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        fitView({ padding: 0.1, duration: 300 });
      } else if ((e.key === "l" || e.key === "L") && isProcessMapRef.current) {
        e.preventDefault();
        setLayoutCheckOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fitView]);

  // ── History / undo-redo ─────────────────────────────────────────────────────
  const historyRef = useRef<HistorySnapshot[]>([
    { nodes: (workflow.nodes as unknown as FlowNode[]) ?? [], edges: (workflow.edges as unknown as Edge[]) ?? [] },
  ]);
  const historyIndexRef = useRef(0);

  // Rapid edits to the same thing (typing in a field) share a coalesceKey, so one undo
  // reverts the whole burst instead of one keystroke.
  const lastHistoryEditRef = useRef<{ key: string; at: number } | null>(null);

  function pushHistory(newNodes: FlowNode[], newEdges: Edge[], coalesceKey?: string) {
    const now = Date.now();
    const last = lastHistoryEditRef.current;
    const atTip = historyIndexRef.current === historyRef.current.length - 1;
    lastHistoryEditRef.current = coalesceKey ? { key: coalesceKey, at: now } : null;
    if (coalesceKey && last && last.key === coalesceKey && now - last.at < 1500 && atTip && historyIndexRef.current > 0) {
      historyRef.current[historyIndexRef.current] = { nodes: newNodes, edges: newEdges };
      return;
    }
    // Drop any future states beyond current cursor
    historyRef.current = historyRef.current.slice(
      0,
      historyIndexRef.current + 1
    );
    historyRef.current.push({ nodes: newNodes, edges: newEdges });
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    }
    historyIndexRef.current = historyRef.current.length - 1;
  }

  function undo() {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    lastHistoryEditRef.current = null;
    const snap = historyRef.current[historyIndexRef.current];
    setNodes(snap.nodes);
    setEdges(snap.edges);
    triggerSave(snap.nodes, snap.edges, activePageIdRef.current);
  }

  function redo() {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    lastHistoryEditRef.current = null;
    const snap = historyRef.current[historyIndexRef.current];
    setNodes(snap.nodes);
    setEdges(snap.edges);
    triggerSave(snap.nodes, snap.edges, activePageIdRef.current);
  }

  // ── Page management ─────────────────────────────────────────────────────────

  // Persist current canvas into the active page slot, swap to the target
  // page, then load its nodes/edges/viewport. History is reset per page so
  // undo/redo can't accidentally cross page boundaries.
  function switchPage(targetId: string) {
    if (targetId === activePageIdRef.current) return;
    const currentVp = getViewport();
    const updatedPages = buildUpdatedPages(
      nodes,
      edges,
      currentVp,
      activePageIdRef.current
    );
    const targetPage = updatedPages.find((p) => p.id === targetId);
    if (!targetPage) return;

    setPages(updatedPages);
    pagesRef.current = updatedPages;
    setActivePageId(targetId);
    activePageIdRef.current = targetId;

    const targetNodes = (targetPage.nodes as unknown as FlowNode[]) ?? [];
    const targetEdges = migrateEdges(targetPage.edges);
    setNodes(targetNodes);
    setEdges(targetEdges);

    setTimeout(() => {
      const vp = targetPage.viewport ?? { x: 0, y: 0, zoom: 1 };
      if (vp.zoom !== 1 || vp.x !== 0 || vp.y !== 0) {
        setViewport(vp);
      } else if (targetNodes.length > 0) {
        fitView({ padding: 0.15, duration: 300 });
      }
    }, 100);

    historyRef.current = [{ nodes: targetNodes, edges: targetEdges }];
    historyIndexRef.current = 0;
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setEditingEdge(null);

    clearPendingSave();
    void onSave(nodes, edges, currentVp, updatedPages);
  }

  function addPage() {
    const currentVp = getViewport();
    const snapshot = buildUpdatedPages(
      nodes,
      edges,
      currentVp,
      activePageIdRef.current
    );
    const existingNumbers = snapshot.map((p) => {
      const m = p.name.match(/^Page (\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    });
    const nextNumber = Math.max(0, ...existingNumbers) + 1;
    const newPage: WorkflowPage = {
      id: `page_${nanoid(8)}`,
      name: `Page ${nextNumber}`,
      nodes: [] as unknown as WorkflowPage["nodes"],
      edges: [] as unknown as WorkflowPage["edges"],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const updatedPages = [...snapshot, newPage];

    setPages(updatedPages);
    pagesRef.current = updatedPages;
    setActivePageId(newPage.id);
    activePageIdRef.current = newPage.id;
    setNodes([]);
    setEdges([]);
    setTimeout(() => setViewport({ x: 0, y: 0, zoom: 1 }), 0);

    historyRef.current = [{ nodes: [], edges: [] }];
    historyIndexRef.current = 0;
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setEditingEdge(null);

    clearPendingSave();
    void onSave([], [], { x: 0, y: 0, zoom: 1 }, updatedPages);
    toast.success(`Added "${newPage.name}"`);
  }

  function renamePage(pageId: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const currentVp = getViewport();
    const snapshot = buildUpdatedPages(
      nodes,
      edges,
      currentVp,
      activePageIdRef.current
    );
    const updatedPages = snapshot.map((p) =>
      p.id === pageId ? { ...p, name: trimmed } : p
    );
    setPages(updatedPages);
    pagesRef.current = updatedPages;
    clearPendingSave();
    void onSave(nodes, edges, currentVp, updatedPages);
    toast.success("Page renamed");
  }

  function deletePage(pageId: string) {
    const currentPages = pagesRef.current;
    if (currentPages.length <= 1) return;
    const idx = currentPages.findIndex((p) => p.id === pageId);
    if (idx < 0) return;

    const wasActive = pageId === activePageIdRef.current;
    const currentVp = getViewport();
    // Snapshot the active page first so unsaved edits aren't lost when
    // deleting a *different* page than the active one.
    const snapshot = buildUpdatedPages(
      nodes,
      edges,
      currentVp,
      activePageIdRef.current
    );
    const updatedPages = snapshot.filter((p) => p.id !== pageId);

    setPages(updatedPages);
    pagesRef.current = updatedPages;

    if (wasActive) {
      const newActiveIdx = Math.max(0, idx - 1);
      const newActive = updatedPages[newActiveIdx];
      setActivePageId(newActive.id);
      activePageIdRef.current = newActive.id;
      const newNodes = (newActive.nodes as unknown as FlowNode[]) ?? [];
      const newEdges = migrateEdges(newActive.edges);
      setNodes(newNodes);
      setEdges(newEdges);
      setTimeout(() => {
        const vp = newActive.viewport ?? { x: 0, y: 0, zoom: 1 };
        setViewport(vp);
      }, 0);
      historyRef.current = [{ nodes: newNodes, edges: newEdges }];
      historyIndexRef.current = 0;
      setSelectedNodeId(null);
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      setEditingEdge(null);

      clearPendingSave();
      void onSave(newNodes, newEdges, newActive.viewport, updatedPages);
    } else {
      clearPendingSave();
      void onSave(nodes, edges, currentVp, updatedPages);
    }

    toast.success("Page deleted");
  }

  // ── Restore viewport on mount ───────────────────────────────────────────────
  useEffect(() => {
    const savedViewport = workflow.viewport as Viewport | undefined;
    if (
      savedViewport &&
      (nodes.length > 0) &&
      (savedViewport.zoom !== 1 || savedViewport.x !== 0 || savedViewport.y !== 0)
    ) {
      setViewport(savedViewport);
    } else if (nodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.15 }), 150);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchVersions();
  }, [fetchVersions, workflow.currentVersion]);

  // ── Waypoint drag commit (fired by CustomEdge on pointerup) ─────────────────
  useEffect(() => {
    function handleWaypointsCommitted(e: Event) {
      const { edgeId, waypoints } = (e as CustomEvent<{ edgeId: string; waypoints: Array<{ x: number; y: number }> }>).detail;
      setEdges((eds) => {
        const next = eds.map((edge) => {
          if (edge.id !== edgeId) return edge;
          const data = { ...normalizeWorkflowEdgeData(edge.data), waypoints };
          return applyEdgeRendering({ ...edge, data }, data);
        });
        setNodes((ns) => {
          pushHistory(ns, next);
          triggerSave(ns, next, activePageIdRef.current);
          return ns;
        });
        return next;
      });
    }
    window.addEventListener("rflow:waypoints-committed", handleWaypointsCommitted);
    return () => window.removeEventListener("rflow:waypoints-committed", handleWaypointsCommitted);
  }, [setEdges, setNodes, triggerSave]);

  // ── Connections ─────────────────────────────────────────────────────────────
  function createEdge(
    connection: Connection,
    dataUpdates: Partial<WorkflowEdgeData> = {}
  ) {
    if (!connection.source || !connection.target) return;

    setEdges((eds) => {
      // Auto-assign isPrimary: first outgoing edge from this source = primary,
      // subsequent edges = not primary. Recovery edges are never primary.
      // Explicit dataUpdates.isPrimary overrides the auto-assignment.
      // Derive final pathSemantic from explicit updates or legacy booleans
      const resolvedSemantic: PathSemantic =
        dataUpdates.pathSemantic ??
        (dataUpdates.isRecovery === true
          ? "recovery"
          : dataUpdates.isHappyPath === true
          ? "happy"
          : "neutral");

      const autoIsPrimary =
        dataUpdates.isPrimary !== undefined
          ? dataUpdates.isPrimary
          : resolvedSemantic === "recovery"
          ? false
          : eds.filter((e) => e.source === connection.source).length === 0;

      const edgeData: WorkflowEdgeData = {
        ...DEFAULT_EDGE_DATA,
        ...dataUpdates,
        pathSemantic: resolvedSemantic,
        isHappyPath: resolvedSemantic === "happy",
        isRecovery: resolvedSemantic === "recovery",
        isPrimary: autoIsPrimary,
      };
      if (resolvedSemantic === "recovery") {
        edgeData.strokeColor = dataUpdates.strokeColor ?? "#F59E0B";
        edgeData.strokeWidth = dataUpdates.strokeWidth ?? 2;
      } else if (resolvedSemantic === "happy") {
        edgeData.strokeColor = dataUpdates.strokeColor ?? "#10B981";
        edgeData.strokeWidth = dataUpdates.strokeWidth ?? 2;
      } else if (resolvedSemantic === "failure") {
        edgeData.strokeColor = dataUpdates.strokeColor ?? "#F87171";
        edgeData.strokeWidth = dataUpdates.strokeWidth ?? 2;
      }
      const baseEdges = resolvedSemantic === "happy"
        ? eds.map((edge) => {
            if (edge.source !== connection.source) return edge;
            const prev = normalizeWorkflowEdgeData(edge.data);
            return {
              ...edge,
              data: {
                ...prev,
                isHappyPath: false,
                pathSemantic: (prev.pathSemantic === "happy" ? "neutral" : prev.pathSemantic) as PathSemantic,
              },
            };
          })
        : eds;

      const next = addEdge(
        applyEdgeRendering({
          ...connection,
          id: `edge_${nanoid(8)}`,
          type: "custom",
          data: edgeData,
        }, edgeData),
        baseEdges
      );
      setNodes((current) => {
        pushHistory(current, next);
        triggerSave(current, next, activePageIdRef.current);
        return current;
      });
      return next;
    });
  }

  function edgeDataWithUpdates(
    edge: Edge,
    dataUpdates: Partial<WorkflowEdgeData> = {}
  ): WorkflowEdgeData {
    const previousData = normalizeWorkflowEdgeData(edge.data);

    // Determine the effective semantic (explicit > legacy booleans > previous)
    const resolvedSemantic: PathSemantic =
      dataUpdates.pathSemantic ??
      (dataUpdates.isRecovery === true
        ? "recovery"
        : dataUpdates.isHappyPath === true
        ? "happy"
        : dataUpdates.isRecovery === false && dataUpdates.isHappyPath === false
        ? "neutral"
        : previousData.pathSemantic ?? "neutral");

    const edgeData: WorkflowEdgeData = {
      ...previousData,
      ...dataUpdates,
      pathSemantic: resolvedSemantic,
      isHappyPath: resolvedSemantic === "happy",
      isRecovery: resolvedSemantic === "recovery",
    };

    if (resolvedSemantic === "recovery") {
      edgeData.strokeColor = dataUpdates.strokeColor ?? "#F59E0B";
      edgeData.strokeWidth = dataUpdates.strokeWidth ?? 2;
    } else if (resolvedSemantic === "happy") {
      edgeData.recoveryLabel = undefined;
      edgeData.strokeColor = dataUpdates.strokeColor ?? "#10B981";
      edgeData.strokeWidth = dataUpdates.strokeWidth ?? 2;
    } else if (resolvedSemantic === "failure") {
      edgeData.recoveryLabel = undefined;
      edgeData.strokeColor = dataUpdates.strokeColor ?? "#F87171";
      edgeData.strokeWidth = dataUpdates.strokeWidth ?? 2;
    } else {
      // neutral — reset to defaults if coming from a semantic type
      edgeData.recoveryLabel = undefined;
      const AUTO_SEMANTIC_COLORS = new Set(["#00BFA5", "#10B981", "#F59E0B", "#F87171"]);
      if (!dataUpdates.strokeColor && AUTO_SEMANTIC_COLORS.has(previousData.strokeColor ?? "")) {
        edgeData.strokeColor = DEFAULT_EDGE_DATA.strokeColor;
      }
      if (!dataUpdates.strokeWidth && previousData.strokeWidth === 2 &&
          (previousData.pathSemantic === "happy" || previousData.pathSemantic === "failure" ||
           previousData.pathSemantic === "recovery")) {
        edgeData.strokeWidth = DEFAULT_EDGE_DATA.strokeWidth;
      }
    }

    return edgeData;
  }

  function reconnectExistingEdge(
    oldEdge: Edge,
    connection: Connection,
    dataUpdates: Partial<WorkflowEdgeData> = {}
  ) {
    if (!connection.source || !connection.target) return;

    setEdges((currentEdges) => {
      const storedEdge = currentEdges.find((edge) => edge.id === oldEdge.id) ?? oldEdge;
      const edgeData = edgeDataWithUpdates(storedEdge, dataUpdates);
      const baseEdges = edgeData.isHappyPath
        ? currentEdges.map((edge) => {
            if (edge.id === oldEdge.id || edge.source !== connection.source) return edge;
            const prev = normalizeWorkflowEdgeData(edge.data);
            return {
              ...edge,
              data: {
                ...prev,
                isHappyPath: false,
                pathSemantic: (prev.pathSemantic === "happy" ? "neutral" : prev.pathSemantic) as PathSemantic,
              },
            };
          })
        : currentEdges;

      const edgeForReconnect = applyEdgeRendering(
        {
          ...storedEdge,
          label: edgeData.label ?? "",
          data: edgeData,
        },
        edgeData
      );

      const nextEdges = reconnectEdge(
        edgeForReconnect,
        connection,
        baseEdges,
        { shouldReplaceId: false }
      ).map((edge) =>
        edge.id === oldEdge.id
          ? applyEdgeRendering(
              {
                ...edge,
                label: edgeData.label ?? "",
                data: edgeData,
              },
              edgeData
            )
          : edge
      );

      setNodes((currentNodes) => {
        // Auto-delete dangling endpoint when its edge is reconnected to a real node
        const isDanglingTarget = currentNodes.some(
          (n) => n.id === oldEdge.target && n.type === "dangling_endpoint"
        );
        const nextNodes = isDanglingTarget
          ? currentNodes.filter((n) => n.id !== oldEdge.target)
          : currentNodes;
        pushHistory(nextNodes, nextEdges);
        triggerSave(nextNodes, nextEdges, activePageIdRef.current);
        return nextNodes;
      });
      return nextEdges;
    });
  }

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (connection.target && stepNumbers.has(connection.target)) {
        setPendingConnection(connection);
        setEdgeTypeModalOpen(true);
        return;
      }
      createEdge(connection);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stepNumbers]
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, connection: Connection) => {
      if (
        connection.target &&
        connection.target !== oldEdge.target &&
        stepNumbers.has(connection.target)
      ) {
        setPendingConnection(connection);
        setPendingReconnect({ oldEdge, connection });
        setEdgeTypeModalOpen(true);
        return;
      }

      reconnectExistingEdge(oldEdge, connection);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stepNumbers]
  );

  const onReconnectStart = useCallback(() => {
    reconnectingRef.current = true;
  }, []);

  const onReconnectEnd = useCallback(() => {
    reconnectingRef.current = false;
  }, []);

  function clientPositionFromEvent(event: MouseEvent | TouchEvent) {
    if ("changedTouches" in event && event.changedTouches.length > 0) {
      return {
        x: event.changedTouches[0].clientX,
        y: event.changedTouches[0].clientY,
      };
    }
    return { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY };
  }

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      if (reconnectingRef.current || connectionState.isValid || edgeTypeModalOpen) return;
      // Only create a dangling edge when dragging from a real node handle
      if (!connectionState.fromNode) return;

      const client = clientPositionFromEvent(event);
      const position = screenToFlowPosition(client);

      const endpointId = `endpoint_${nanoid(8)}`;
      const sourceHandle = connectionState.fromHandle?.id ?? "bottom";
      const targetHandle = sourceHandle === "right" ? "left" : "top";

      const endpointNode: FlowNode = {
        id: endpointId,
        type: "dangling_endpoint",
        // Offset by half the node size (8px) to centre the dot on the drop point
        position: { x: position.x - 8, y: position.y - 8 },
        data: {
          label: "",
          type: "dangling_endpoint",
          actor: undefined,
          actorLabel: "",
          notes: "",
          feasibility: "confirmed",
          data: {},
        } as WorkflowNodeData,
      };

      const newEdge = applyEdgeRendering(
        {
          id: `edge_${nanoid(8)}`,
          source: connectionState.fromNode.id,
          sourceHandle,
          target: endpointId,
          targetHandle,
          type: "custom",
          data: { ...DEFAULT_EDGE_DATA } satisfies WorkflowEdgeData,
        },
        DEFAULT_EDGE_DATA
      );

      setNodes((currentNodes) => {
        const nextNodes = [
          ...currentNodes.map((n) => ({ ...n, selected: false })),
          endpointNode,
        ];
        setEdges((currentEdges) => {
          const nextEdges = addEdge(
            newEdge,
            currentEdges.map((e) => ({ ...e, selected: false }))
          );
          pushHistory(nextNodes, nextEdges);
          triggerSave(nextNodes, nextEdges, activePageIdRef.current);
          return nextEdges;
        });
        return nextNodes;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [edgeTypeModalOpen, screenToFlowPosition]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => {
      const shouldPersistNodes = changes.some((change) => {
        if (change.type === "add" || change.type === "remove" || change.type === "replace") {
          return true;
        }

        if (change.type === "position") {
          return !change.dragging;
        }

        if (change.type === "dimensions") {
          return !change.resizing;
        }

        return false;
      });

      // Cache any real dimensions React Flow reports. Populated lazily as
      // nodes mount — first-render uses Dagre's per-type fallback sizes.
      let sawDimensionChange = false;
      for (const change of changes) {
        if (
          change.type === "dimensions" &&
          change.dimensions &&
          change.dimensions.width > 0 &&
          change.dimensions.height > 0
        ) {
          nodeDimensionsRef.current.set(change.id, {
            width: change.dimensions.width,
            height: change.dimensions.height,
          });
          sawDimensionChange = true;
        }
      }

      setNodes((currentNodes) => {
        const nextNodes = applyNodeChanges(changes, currentNodes) as FlowNode[];

        if (shouldPersistNodes) {
          pushHistory(nextNodes, edges);
          triggerSave(nextNodes, edges, activePageIdRef.current);
        }

        return nextNodes;
      });

      // If a measurement pass is pending (net-new nodes arrived from AI /
      // template / MCP), debounce a check — once every node in the current
      // page has a measured size, re-run Dagre with real dimensions.
      if (sawDimensionChange && measurementPendingRef.current) {
        if (measurementDebounceRef.current) {
          clearTimeout(measurementDebounceRef.current);
        }
        measurementDebounceRef.current = setTimeout(() => {
          measurementDebounceRef.current = null;
          if (!measurementPendingRef.current) return;

          setNodes((currentNodes) => {
            const allMeasured = currentNodes.every((n) =>
              nodeDimensionsRef.current.has(n.id)
            );
            if (!allMeasured) return currentNodes;

            const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(
              currentNodes as FlowNode[],
              edges,
              { nodeDimensions: nodeDimensionsRef.current }
            );
            const nextNodes = layouted as FlowNode[];
            const nextEdges = layoutedEdges as Edge[];

            measurementPendingRef.current = false;
            setEdges(nextEdges);
            pushHistory(nextNodes, nextEdges);
            triggerSave(nextNodes, nextEdges, activePageIdRef.current);
            setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
            toast.success("Layout optimized");
            return nextNodes;
          });
        }, 100);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [edges, setNodes, setEdges, triggerSave, fitView]
  );

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: { nodes: FlowNode[]; edges: Edge[] }) => {
      const ids = selectedNodes.map((node) => node.id);
      setSelectedNodeIds(ids);
      setSelectedNodeId(ids.length === 1 ? ids[0] : null);
      setSelectedEdgeId(
        ids.length === 0 && selectedEdges.length === 1 ? selectedEdges[0].id : null
      );

      if (ids.length > 0) {
        setEditingEdge(null);
        setVersionPanelOpen(false);
        setSeBriefOpen(false);
        setSelectedEdgeId(null);
      } else if (selectedEdges.length > 0) {
        setEditingEdge(null);
        setVersionPanelOpen(false);
        setSeBriefOpen(false);
      }
    },
    []
  );

  // ── Node add helpers ────────────────────────────────────────────────────────
  function addNodeToCanvas(
    type: Exclude<NodeType, "annotation" | "dangling_endpoint">,
    position: { x: number; y: number },
    label?: string,
    actor?: ActorType,
    autoArrange = false
  ) {
    const node = createNode(type, position, label, actor);
    setNodes((prev) => {
      let next = [...prev, node];
      if (autoArrange) {
        const { nodes: layouted } = getLayoutedElements(next, edges);
        next = layouted as FlowNode[];
      }
      pushHistory(next, edges);
      triggerSave(next, edges, activePageIdRef.current);
      setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
      return next;
    });
  }

  function handlePaletteAddNode(type: NodeType, actor?: ActorType) {
    if (type === "annotation") return; // handled separately via addAnnotationToCanvas
    if (CONTAINER_TYPES.has(type)) {
      addContainer(type as "swimlane" | "frame");
      return;
    }
    const vp = getViewport();
    const centerX = (window.innerWidth / 2 - vp.x) / vp.zoom;
    const centerY = (window.innerHeight / 2 - vp.y) / vp.zoom;
    addNodeToCanvas(type as Exclude<NodeType, "annotation" | "dangling_endpoint">, { x: centerX - 120, y: centerY - 40 }, undefined, actor);
  }

  function addAnnotationToCanvas(shape: AnnotationShapeType, label: string) {
    const vp = getViewport();
    const centerX = (window.innerWidth / 2 - vp.x) / vp.zoom;
    const centerY = (window.innerHeight / 2 - vp.y) / vp.zoom;
    const annotationNode: FlowNode = {
      id: `node_${nanoid(8)}`,
      type: "annotation",
      position: { x: centerX - 150, y: centerY - 80 },
      style: shape === "circle" ? { width: 160, height: 160 } : shape === "divider" ? { width: 300, height: 32 } : { width: 300, height: 160 },
      zIndex: -1,
      data: {
        isAnnotation: true,
        shape,
        label,
        fillColor: "transparent",
        borderColor: "#6B7280",
        borderStyle: "dashed",
        fontSize: 14,
        textAlign: "left",
        opacity: 1.0,
        bold: false,
        italic: false,
        zIndex: -1,
      } satisfies AnnotationNodeData,
    };
    setNodes((prev) => {
      const next = [annotationNode, ...prev];
      pushHistory(next, edges);
      triggerSave(next, edges, activePageIdRef.current);
      return next;
    });
  }

  function addContainer(type: "swimlane" | "frame") {
    const vp = getViewport();
    const centerX = (window.innerWidth / 2 - vp.x) / vp.zoom;
    const centerY = (window.innerHeight / 2 - vp.y) / vp.zoom;
    const defaultSizes = {
      swimlane: { width: 800, height: 280 },
      frame: { width: 600, height: 380 },
    };
    const size = defaultSizes[type];
    const newNode: FlowNode = {
      id: `node_${nanoid(8)}`,
      type,
      position: { x: centerX - size.width / 2, y: centerY - size.height / 2 },
      style: { width: size.width, height: size.height },
      zIndex: -1,
      data: {
        label: type === "swimlane" ? "New Swimlane" : "Frame",
        type,
        actor: "automated" as ActorType,
        actorLabel: "Talkpush Automation",
        notes: "",
        feasibility: "confirmed" as FeasibilityLevel,
        data: {},
      } as WorkflowNodeData,
    };
    setNodes((prev) => {
      // Prepend so containers render behind regular nodes
      const next = [newNode, ...prev];
      pushHistory(next, edges);
      triggerSave(next, edges, activePageIdRef.current);
      return next;
    });
  }

  function handleQuickAdd(label: string, type: NodeType, actor: ActorType) {
    const vp = getViewport();
    const centerX = (window.innerWidth / 2 - vp.x) / vp.zoom;
    const bottomY =
      nodes.length > 0
        ? Math.max(...nodes.map((n) => (n.position?.y ?? 0) + 80)) + 80
        : (window.innerHeight / 2 - vp.y) / vp.zoom;
    addNodeToCanvas(type as Exclude<NodeType, "annotation" | "dangling_endpoint">, { x: centerX - 120, y: bottomY }, label, actor, true);
  }

  // ── Container drag-drop grouping ────────────────────────────────────────────
  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, draggedNode: FlowNode) => {
      // Don't reparent containers themselves
      if (CONTAINER_TYPES.has(draggedNode.type ?? "")) return;

      const containers = nodes.filter((n) => CONTAINER_TYPES.has(n.type ?? ""));
      if (containers.length === 0 && !draggedNode.parentId) return;

      // Compute the node's absolute position
      let absX = draggedNode.position.x;
      let absY = draggedNode.position.y;
      if (draggedNode.parentId) {
        const parent = nodes.find((n) => n.id === draggedNode.parentId);
        if (parent) {
          absX += parent.position.x;
          absY += parent.position.y;
        }
      }

      const nodeW = draggedNode.measured?.width ?? 180;
      const nodeH = draggedNode.measured?.height ?? 60;
      const nodeCenterX = absX + nodeW / 2;
      const nodeCenterY = absY + nodeH / 2;

      let targetContainer: FlowNode | null = null;
      for (const container of containers) {
        const contW =
          (container.style?.width as number | undefined) ??
          container.measured?.width ??
          800;
        const contH =
          (container.style?.height as number | undefined) ??
          container.measured?.height ??
          300;
        if (
          nodeCenterX >= container.position.x &&
          nodeCenterX <= container.position.x + contW &&
          nodeCenterY >= container.position.y &&
          nodeCenterY <= container.position.y + contH
        ) {
          targetContainer = container;
          break;
        }
      }

      if (targetContainer && targetContainer.id !== draggedNode.parentId) {
        // Reparent into container — convert position to relative coords
        setNodes((prev) => {
          const next = prev.map((n) => {
            if (n.id !== draggedNode.id) return n;
            return {
              ...n,
              parentId: targetContainer!.id,
              position: {
                x: absX - targetContainer!.position.x,
                y: absY - targetContainer!.position.y,
              },
            };
          });
          pushHistory(next, edges);
          triggerSave(next, edges, activePageIdRef.current);
          return next;
        });
      } else if (!targetContainer && draggedNode.parentId) {
        // Drag out of container — convert to absolute position
        setNodes((prev) => {
          const next = prev.map((n) => {
            if (n.id !== draggedNode.id) return n;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { parentId: _removed, ...rest } = n;
            return { ...rest, position: { x: absX, y: absY } };
          });
          pushHistory(next, edges);
          triggerSave(next, edges, activePageIdRef.current);
          return next;
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, setNodes, edges, triggerSave]
  );

  // ── Drop handling ───────────────────────────────────────────────────────────
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/reactflow/type") as NodeType;
      if (!type) return;

      // Handle annotation shape drops
      if (type === "annotation") {
        const shape = (e.dataTransfer.getData("application/reactflow/annotation-shape") || "rect") as AnnotationShapeType;
        const label = e.dataTransfer.getData("application/reactflow/annotation-label") || "Box";
        const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        const annotationNode: FlowNode = {
          id: `node_${nanoid(8)}`,
          type: "annotation",
          position,
          style: shape === "circle" ? { width: 160, height: 160 } : shape === "divider" ? { width: 300, height: 32 } : { width: 300, height: 160 },
          zIndex: -1,
          data: {
            isAnnotation: true,
            shape,
            label,
            fillColor: "transparent",
            borderColor: "#6B7280",
            borderStyle: "dashed",
            fontSize: 14,
            textAlign: "left",
            opacity: 1.0,
            bold: false,
            italic: false,
            zIndex: -1,
          } satisfies AnnotationNodeData,
        };
        setNodes((prev) => {
          // Prepend so annotations render behind workflow nodes
          const next = [annotationNode, ...prev];
          pushHistory(next, edges);
          triggerSave(next, edges, activePageIdRef.current);
          return next;
        });
        return;
      }

      if (!NODE_TYPE_CONFIG[type as keyof typeof NODE_TYPE_CONFIG]) return;

      if (CONTAINER_TYPES.has(type)) {
        addContainer(type as "swimlane" | "frame");
        return;
      }

      const actor = (e.dataTransfer.getData("application/reactflow/actor") || undefined) as ActorType | undefined;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const node = createNode(type as Exclude<NodeType, "annotation" | "dangling_endpoint">, position, undefined, actor);
      setNodes((prev) => {
        const next = [...prev, node];
        pushHistory(next, edges);
        triggerSave(next, edges, activePageIdRef.current);
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [screenToFlowPosition, setNodes, edges, triggerSave, addContainer]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  // ── Node interactions ───────────────────────────────────────────────────────
  function handleNodeClick(_: React.MouseEvent, node: FlowNode) {
    setEditingEdge(null);
    setVersionPanelOpen(false);
    setSeBriefOpen(false);
    setSelectedEdgeId(null);
    if (selectedNodeIds.length === 1) {
      setSelectedNodeId(node.id);
    }
  }

  function handlePaneClick() {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setEditingEdge(null);
    setNodeSuggestionState((current) => ({ ...current, open: false }));
  }

  function handleEdgeClick(event: React.MouseEvent, edge: Edge) {
    event.stopPropagation();
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setEditingEdge(null);
    setVersionPanelOpen(false);
    setSeBriefOpen(false);
    setNodeSuggestionState((current) => ({ ...current, open: false }));
  }

  function handleInlineLabelChange(id: string, label: string) {
    setNodes((prev) => {
      const next = prev.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                label,
                isEditingLabel: false,
              },
            }
          : node
      );
      pushHistory(next, edges);
      triggerSave(next, edges, activePageIdRef.current);
      return next;
    });
  }

  function handleOpenSuggestionFromNode(request: NodeSuggestionOpenRequest) {
    const basePosition = screenToFlowPosition({
      x: request.clientX,
      y: request.clientY,
    });
    setNodeSuggestionState({
      open: true,
      position: {
        x: basePosition.x + (request.sourceHandle === "right" ? 180 : 0),
        y: basePosition.y + (request.sourceHandle === "bottom" ? 120 : 0),
      },
      popupPosition: { x: request.clientX, y: request.clientY },
      sourceNodeId: request.sourceNodeId,
      sourceNodeType: request.sourceNodeType,
      sourceHandle: request.sourceHandle,
    });
  }

  function handleSuggestionDismiss() {
    setNodeSuggestionState((current) => ({ ...current, open: false }));
  }

  function handleSuggestionSelect(
    nodeType: WorkflowNodeType,
    markAsHappyPath: boolean
  ) {
    const baseNode = createNode(
      nodeType,
      nodeSuggestionState.position,
      DEFAULT_LABEL_BY_NODE_TYPE[nodeType]
    );
    const newNode = {
      ...baseNode,
      selected: true,
      data: {
        ...baseNode.data,
        isEditingLabel: true,
      },
    } as FlowNode;

    setNodes((currentNodes) => {
      const nextNodes = [
        ...currentNodes.map((node) => ({ ...node, selected: false })),
        newNode,
      ];
      setEdges((currentEdges) => {
        let nextEdges: Edge[] = currentEdges.map((edge) => ({
          ...edge,
          selected: false,
        }));
        if (nodeSuggestionState.sourceNodeId) {
          if (markAsHappyPath) {
            nextEdges = nextEdges.map((edge) =>
              edge.source === nodeSuggestionState.sourceNodeId
                ? {
                    ...edge,
                    data: {
                      ...normalizeWorkflowEdgeData(edge.data),
                      isHappyPath: false,
                    },
                  }
                : edge
            );
          }
          nextEdges = addEdge(
            applyEdgeRendering(
              {
                id: `edge_${nanoid(8)}`,
                source: nodeSuggestionState.sourceNodeId,
                sourceHandle: nodeSuggestionState.sourceHandle ?? "bottom",
                target: newNode.id,
                targetHandle:
                  nodeSuggestionState.sourceHandle === "right" ? "left" : "top",
                type: "custom",
                data: {
                  ...DEFAULT_EDGE_DATA,
                  isHappyPath: markAsHappyPath,
                  strokeColor: markAsHappyPath
                    ? "#00BFA5"
                    : DEFAULT_EDGE_DATA.strokeColor,
                  strokeWidth: markAsHappyPath ? 2 : DEFAULT_EDGE_DATA.strokeWidth,
                } satisfies WorkflowEdgeData,
              },
              {
                ...DEFAULT_EDGE_DATA,
                isHappyPath: markAsHappyPath,
                strokeColor: markAsHappyPath
                  ? "#00BFA5"
                  : DEFAULT_EDGE_DATA.strokeColor,
                strokeWidth: markAsHappyPath ? 2 : DEFAULT_EDGE_DATA.strokeWidth,
              }
            ),
            nextEdges
          );
        }
        pushHistory(nextNodes, nextEdges);
        triggerSave(nextNodes, nextEdges, activePageIdRef.current);
        return nextEdges;
      });
      return nextNodes;
    });

    setSelectedNodeIds([newNode.id]);
    setSelectedNodeId(newNode.id);
    setSelectedEdgeId(null);
    setNodeSuggestionState((current) => ({ ...current, open: false }));
  }

  /**
   * Replaces what is on screen with a workflow loaded from the server (after a version restore, or after
   * staff accept a client's suggestion). `updated` carries the pages (or the older single canvas).
   */
  function applyServerWorkflow(updated: {
    pages?: unknown;
    nodes?: unknown;
    edges?: unknown;
    viewport?: unknown;
  }) {
        // Restore the full multi-page snapshot when present, falling
        // back to a synthetic single page for legacy versions.
        const restoredPages: WorkflowPage[] =
          Array.isArray(updated.pages) && updated.pages.length > 0
            ? (updated.pages as WorkflowPage[])
            : [
        {
          id: `page_${nanoid(8)}`,
          name: "Page 1",
          nodes: (updated.nodes ?? []) as WorkflowPage["nodes"],
          edges: (updated.edges ?? []) as WorkflowPage["edges"],
          viewport: (updated.viewport as WorkflowPage["viewport"]) ?? {
            x: 0,
            y: 0,
            zoom: 1,
          },
        },
      ];

        const firstPage = restoredPages[0];
        const restoredNodes =
          (firstPage.nodes as unknown as FlowNode[]) ?? [];
        const restoredEdges = migrateEdges(firstPage.edges);
        const restoredViewport = firstPage.viewport as Viewport | undefined;

        setPages(restoredPages);
        pagesRef.current = restoredPages;
        setActivePageId(firstPage.id);
        activePageIdRef.current = firstPage.id;

        setNodes(restoredNodes);
        setEdges(restoredEdges);
        if (restoredViewport) {
          setViewport(restoredViewport);
        }

        historyRef.current = [{ nodes: restoredNodes, edges: restoredEdges }];
        historyIndexRef.current = 0;
        setSelectedNodeId(null);
        setSelectedNodeIds([]);
        setSelectedEdgeId(null);
        setEditingEdge(null);
        setVersionPanelOpen(false);
  }

  /** After the server changed the canvas behind our back, fetch the new copy and the new revision number. */
  async function syncFromServer() {
    const res = await fetch(`/api/workflows/${workflow.id}`);
    if (!res.ok) return;
    const fresh = await res.json();
    applyServerWorkflow(fresh);
    if (typeof fresh.revision === "number") onServerRevision(fresh.revision);
  }

  function openVersionPanel() {
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setEditingEdge(null);
    setSeBriefOpen(false);
    setReviewOpen(false);
    setVersionPanelOpen(true);
  }

  function openSEBriefPanel() {
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setEditingEdge(null);
    setVersionPanelOpen(false);
    setReviewOpen(false);
    setSeBriefOpen(true);
  }

  function openReviewPanel() {
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setEditingEdge(null);
    setVersionPanelOpen(false);
    setSeBriefOpen(false);
    setReviewOpen(true);
  }

  function handleNodeDataChange(
    id: string,
    updates: Partial<WorkflowNodeData>
  ) {
    setNodes((prev) => {
      const next = prev.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...updates } } : n
      );
      pushHistory(next, edges, `node:${id}`);
      triggerSave(next, edges, activePageIdRef.current);
      return next;
    });
  }

  function handleNodeSubDataChange(
    id: string,
    dataUpdates: Partial<WorkflowNodeData["data"]>
  ) {
    setNodes((prev) => {
      const next = prev.map((n) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...n.data,
                data: { ...n.data.data, ...dataUpdates },
              },
            }
          : n
      );
      pushHistory(next, edges, `node:${id}`);
      triggerSave(next, edges, activePageIdRef.current);
      return next;
    });
  }

  function handleEdgeDataChange(
    id: string,
    updates: Partial<WorkflowEdgeData>
  ) {
    setEdges((prevEdges) => {
      const nextEdges = prevEdges.map((edge) => {
        if (edge.id !== id) return edge;

        const prev = normalizeWorkflowEdgeData(edge.data);
        let finalUpdates = { ...updates };

        // When pathSemantic changes explicitly, sync booleans and colours
        if (updates.pathSemantic !== undefined) {
          finalUpdates = edgeDataWithUpdates(edge, updates);
        } else if (updates.label !== undefined) {
          // Smart default: suggest pathSemantic from label when source is a decision node
          // and the edge hasn't already been given an explicit semantic
          const sourceNode = getNodes().find((n) => n.id === edge.source);
          const sourceData = sourceNode?.data as WorkflowNodeData | undefined;
          if (sourceData?.type === "decision" && prev.pathSemantic === "neutral") {
            const label = updates.label.trim();
            if (/^(pass|yes|success|approved|ok)/i.test(label)) {
              finalUpdates = {
                ...finalUpdates,
                pathSemantic: "happy",
                isHappyPath: true,
                isRecovery: false,
                strokeColor: "#10B981",
                strokeWidth: 2,
              };
            } else if (/^(fail|no|reject|decline|denied)/i.test(label)) {
              finalUpdates = {
                ...finalUpdates,
                pathSemantic: "failure",
                isHappyPath: false,
                isRecovery: false,
                strokeColor: "#F87171",
                strokeWidth: 2,
              };
            }
          }
        }

        const data = {
          ...prev,
          ...finalUpdates,
        };
        return applyEdgeRendering(
          {
            ...edge,
            label: data.label ?? "",
            data,
          },
          data
        );
      });
      setNodes((currentNodes) => {
        pushHistory(currentNodes, nextEdges, `edge:${id}`);
        triggerSave(currentNodes, nextEdges, activePageIdRef.current);
        return currentNodes;
      });
      return nextEdges;
    });
  }

  function handleDeleteNodes(ids: string[]) {
    const nodeIds = Array.from(new Set(ids));
    if (nodeIds.length === 0) return;

    const idsToDelete = new Set(nodeIds);
    setNodes((prevNodes) => {
      const nextNodes = prevNodes.filter((n) => !idsToDelete.has(n.id));
      setEdges((prevEdges) => {
        const nextEdges = prevEdges.filter(
          (e) => !idsToDelete.has(e.source) && !idsToDelete.has(e.target)
        );
        pushHistory(nextNodes, nextEdges);
        triggerSave(nextNodes, nextEdges, activePageIdRef.current);
        return nextEdges;
      });
      return nextNodes;
    });
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    toast.success(nodeIds.length === 1 ? "Node deleted" : `${nodeIds.length} nodes deleted`);
  }

  function handleDeleteNode(id: string) {
    handleDeleteNodes([id]);
  }

  // ── Edge label editing ──────────────────────────────────────────────────────
  function handleEdgeDoubleClick(e: React.MouseEvent, edge: Edge) {
    e.stopPropagation();
    const label =
      (edge.data as { label?: string })?.label ??
      (edge.label as string) ??
      "";
    setEditingEdge({ id: edge.id, label, x: e.clientX, y: e.clientY });
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedEdgeId(edge.id);
  }

  function commitEdgeLabel() {
    if (!editingEdge) return;
    setEdges((prev) => {
      const next = prev.map((e) => {
        if (e.id !== editingEdge.id) return e;
        const data = {
          ...normalizeWorkflowEdgeData(e.data),
          label: editingEdge.label,
        };
        return applyEdgeRendering({ ...e, label: editingEdge.label, data }, data);
      });
      setNodes((currentNodes) => {
        pushHistory(currentNodes, next);
        triggerSave(currentNodes, next, activePageIdRef.current);
        return currentNodes;
      });
      return next;
    });
    setEditingEdge(null);
  }

  function handleDeleteEdge(edgeId: string) {
    setEdges((prevEdges) => {
      const nextEdges = prevEdges.filter((e) => e.id !== edgeId);
      setNodes((currentNodes) => {
        pushHistory(currentNodes, nextEdges);
        triggerSave(currentNodes, nextEdges, activePageIdRef.current);
        return currentNodes;
      });
      return nextEdges;
    });
    setEditingEdge(null);
    setSelectedEdgeId((current) => (current === edgeId ? null : current));
    toast.success("Connector deleted");
  }

  function handleEdgeContextMenu(e: React.MouseEvent, edge: Edge) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedEdgeId(edge.id);
    setEdgeContextMenu({
      edgeId: edge.id,
      position: { x: e.clientX, y: e.clientY },
    });
  }

  function handleMarkHappyPath(edgeId: string) {
    setEdges((prevEdges) => {
      const selectedEdge = prevEdges.find((edge) => edge.id === edgeId);
      if (!selectedEdge) return prevEdges;

      const nextEdges = prevEdges.map((edge) => {
        if (edge.source !== selectedEdge.source) return edge;
        const data = {
          ...normalizeWorkflowEdgeData(edge.data),
          isHappyPath: edge.id === edgeId,
          ...(edge.id === edgeId
            ? {
                isRecovery: false,
                recoveryLabel: undefined,
                strokeColor: "#00BFA5",
                strokeWidth: 2,
              }
            : {}),
        };
        return applyEdgeRendering({ ...edge, data }, data);
      });
      setNodes((currentNodes) => {
        pushHistory(currentNodes, nextEdges);
        triggerSave(currentNodes, nextEdges, activePageIdRef.current);
        return currentNodes;
      });
      return nextEdges;
    });
    setEdgeContextMenu(null);
  }

  function handleMarkRecoveryPath(edgeId: string) {
    setEdges((prevEdges) => {
      const nextEdges = prevEdges.map((edge) => {
        if (edge.id !== edgeId) return edge;
        const data = {
          ...normalizeWorkflowEdgeData(edge.data),
          isHappyPath: false,
          isRecovery: true,
          strokeColor: "#F59E0B",
          strokeWidth: 2,
        };
        return applyEdgeRendering({ ...edge, data }, data);
      });
      setNodes((currentNodes) => {
        pushHistory(currentNodes, nextEdges);
        triggerSave(currentNodes, nextEdges, activePageIdRef.current);
        return currentNodes;
      });
      return nextEdges;
    });
    setEdgeContextMenu(null);
  }

  function handleAddEdgeLabelFromContext(edgeId: string) {
    const edge = edges.find((item) => item.id === edgeId);
    if (!edge || !edgeContextMenu) return;
    const data = normalizeWorkflowEdgeData(edge.data);
    setEditingEdge({
      id: edgeId,
      label: data.label ?? "",
      x: edgeContextMenu.position.x,
      y: edgeContextMenu.position.y,
    });
    setEdgeContextMenu(null);
  }

  function handleResetWaypoints(edgeId: string) {
    setEdges((prevEdges) => {
      const next = prevEdges.map((edge) => {
        if (edge.id !== edgeId) return edge;
        const data = { ...normalizeWorkflowEdgeData(edge.data), waypoints: undefined };
        return applyEdgeRendering({ ...edge, data }, data);
      });
      setNodes((ns) => {
        pushHistory(ns, next);
        triggerSave(ns, next, activePageIdRef.current);
        return ns;
      });
      return next;
    });
    setEdgeContextMenu(null);
  }

  function handleRenumber() {
    setRenumberVersion((current) => current + 1);
    toast.success("Step numbers refreshed");
  }

  function handleEdgeTypeCancel() {
    setPendingConnection(null);
    setPendingReconnect(null);
    setEdgeTypeModalOpen(false);
  }

  function handleEdgeTypeConfirm(type: "recovery" | "branch" | "happy") {
    if (!pendingConnection) return;
    if (pendingReconnect) {
      if (type === "recovery") {
        reconnectExistingEdge(pendingReconnect.oldEdge, pendingReconnect.connection, {
          pathSemantic: "recovery",
          isRecovery: true,
          isHappyPath: false,
        });
      } else if (type === "happy") {
        reconnectExistingEdge(pendingReconnect.oldEdge, pendingReconnect.connection, {
          pathSemantic: "happy",
          isRecovery: false,
          isHappyPath: true,
          recoveryLabel: undefined,
        });
      } else {
        reconnectExistingEdge(pendingReconnect.oldEdge, pendingReconnect.connection, {
          pathSemantic: "neutral",
          isRecovery: false,
          isHappyPath: false,
          recoveryLabel: undefined,
        });
        toast.error("Consider using a recovery path when connecting back to an existing step");
      }
    } else if (type === "recovery") {
      createEdge(pendingConnection, { pathSemantic: "recovery", isRecovery: true, isHappyPath: false });
    } else if (type === "happy") {
      createEdge(pendingConnection, { pathSemantic: "happy", isRecovery: false, isHappyPath: true });
    } else {
      createEdge(pendingConnection, { pathSemantic: "neutral" });
      toast.error("Consider using a recovery path when connecting back to an existing step");
    }
    setPendingConnection(null);
    setPendingReconnect(null);
    setEdgeTypeModalOpen(false);
  }

  function cloneSerializable<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  function buildClipboardSnapshot(sourceNodes: FlowNode[], sourceEdges: Edge[]) {
    const selectedNodes = sourceNodes.filter((node) => node.selected);
    if (selectedNodes.length === 0) return null;

    const selectedIds = new Set(selectedNodes.map((node) => node.id));
    const internalEdges = sourceEdges.filter(
      (edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target)
    );

    return {
      nodes: selectedNodes.map((node) => ({
        ...node,
        selected: false,
        position: { ...node.position },
        data: cloneSerializable(node.data),
      })),
      edges: internalEdges.map((edge) => ({
        ...edge,
        selected: false,
        data: cloneSerializable(edge.data ?? {}),
      })),
    };
  }

  function pasteClipboardSnapshot(snapshot: { nodes: FlowNode[]; edges: Edge[] }) {
    if (snapshot.nodes.length === 0) return;

    const idMap = new Map(snapshot.nodes.map((node) => [node.id, `node_${nanoid(8)}`]));
    const pastedNodes = snapshot.nodes.map((node) => {
      const nextParentId = node.parentId ? idMap.get(node.parentId) : undefined;
      return {
        ...node,
        id: idMap.get(node.id) ?? `node_${nanoid(8)}`,
        parentId: nextParentId,
        selected: true,
        position: {
          x: node.position.x + 80,
          y: node.position.y + 80,
        },
        data: cloneSerializable(node.data),
      };
    });

    const pastedNodeIds = new Set(pastedNodes.map((node) => node.id));
    const pastedEdges = snapshot.edges.flatMap((edge) => {
      const source = idMap.get(edge.source);
      const target = idMap.get(edge.target);
      if (!source || !target || !pastedNodeIds.has(source) || !pastedNodeIds.has(target)) {
        return [];
      }
      const data = normalizeWorkflowEdgeData(edge.data);
      return [
        applyEdgeRendering(
          {
            ...edge,
            id: `edge_${nanoid(8)}`,
            source,
            target,
            type: "custom",
            selected: false,
            data: cloneSerializable(data),
          },
          data
        ),
      ];
    });

    setNodes((currentNodes) => {
      const deselectedCurrentNodes = currentNodes.map((node) => ({
        ...node,
        selected: false,
      }));
      const nextNodes = [...deselectedCurrentNodes, ...pastedNodes];
      setEdges((currentEdges) => {
        const nextEdges = [
          ...currentEdges.map((edge) => ({ ...edge, selected: false })),
          ...pastedEdges,
        ];
        pushHistory(nextNodes, nextEdges);
        triggerSave(nextNodes, nextEdges, activePageIdRef.current);
        return nextEdges;
      });
      return nextNodes;
    });

    setSelectedNodeIds(pastedNodes.map((node) => node.id));
    setSelectedNodeId(pastedNodes.length === 1 ? pastedNodes[0].id : null);
    toast.success(`${pastedNodes.length} nodes pasted`);
  }

  // ── Auto-arrange ────────────────────────────────────────────────────────────
  /** Process Map layout. It never silently overwrites hand-placed steps: it says how many will move first. */
  function commitArranged(laid: { nodes: FlowNode[]; edges: Edge[] }, message: string) {
    const nextNodes = laid.nodes;
    const nextEdges = laid.edges.map((e) => applyEdgeRendering(e, normalizeWorkflowEdgeData(e.data)));
    setNodes(nextNodes);
    setEdges(nextEdges);
    pushHistory(nextNodes, nextEdges);
    triggerSave(nextNodes, nextEdges, activePageIdRef.current);
    setTimeout(() => fitView({ padding: 0.1, duration: 300 }), 80);
    toast.success(message);
  }
  const movedCount = (laid: { nodes: FlowNode[] }) =>
    laid.nodes.filter((n, i) => {
      const before = nodes[i]?.position;
      return before && (Math.abs(before.x - n.position.x) > 2 || Math.abs(before.y - n.position.y) > 2);
    }).length;
  const moveWarning = (moved: number) => `${moved} step${moved === 1 ? "" : "s"} will move, including any you placed by hand. You can undo it with Ctrl or ⌘ + Z.`;

  function handleProcessMapArrange() {
    if (nodes.length === 0) return;
    const laid = applyLayout(nodes, edges, layoutDiagram(nodes, edges, look));
    const moved = movedCount(laid);
    if (moved === 0) {
      toast.info("Everything is already in place");
      return;
    }
    setLayoutPreview({
      moved,
      apply: () => commitArranged(laid, "Steps arranged"),
      message: lanesMode ? `This lays the steps out in their lanes and stage bands. ${moveWarning(moved)}` : undefined,
    });
  }

  /**
   * A lane change (switch to lanes or back, rename, reorder, mark as another system, move a step to a lane) edits the
   * steps and re-arranges in one go. Like Arrange it says how many steps will move first, and it is one undo step.
   */
  function arrangeAfter(transform: (steps: FlowNode[]) => FlowNode[], what: string, done: string) {
    if (nodes.length === 0) return;
    const changed = transform(nodes);
    const laid = applyLayout(changed, edges, layoutDiagram(changed, edges, look));
    const moved = movedCount(laid);
    const apply = () => commitArranged(laid, done);
    if (moved === 0) {
      apply();
      return;
    }
    setLayoutPreview({ moved, apply, message: `${what} ${moveWarning(moved)}` });
  }
  const lanePanel = {
    lanesMode,
    lanes: laneList,
    onSetMode: (mode: "spine" | "lanes") =>
      mode === "lanes"
        ? arrangeAfter((ns) => assignLanes(ns).nodes, "Lanes put each step in the row of whoever does it (taken from its role), in stage bands.", "Lanes on")
        : arrangeAfter((ns) => stripLanes(ns).nodes, "Back to a single row: the lanes and stages are removed from the steps.", "Back to a single row"),
    onRename: (from: string, to: string) => arrangeAfter((ns) => renameLane(ns, from, to), `Renaming the lane to "${to}" re-arranges the diagram.`, "Lane renamed"),
    onToggleExternal: (lane: string, external: boolean) =>
      arrangeAfter((ns) => setLaneExternal(ns, lane, external), external ? `Marking "${lane}" as another system re-draws it in blue.` : `"${lane}" becomes an ordinary lane.`, external ? "Marked as another system" : "Marked as an ordinary lane"),
    onMove: (lane: string, delta: -1 | 1) => arrangeAfter((ns) => moveLane(ns, edges, lane, delta), `Moving "${lane}" ${delta < 0 ? "up" : "down"} re-arranges the diagram.`, "Lane moved"),
  };
  function handleStepLaneChange(id: string, patch: { lane?: string; stage?: string }) {
    arrangeAfter(
      (ns) => {
        let out = ns;
        if (patch.lane !== undefined) out = setStepLane(out, id, patch.lane);
        if (patch.stage !== undefined) out = out.map((n) => (n.id === id ? { ...n, data: { ...n.data, stage: patch.stage } } : n));
        return out;
      },
      patch.lane !== undefined ? "Moving this step to another lane re-arranges the diagram." : "Changing where the stage starts re-arranges the diagram.",
      patch.lane !== undefined ? "Step moved to its lane" : "Stage updated"
    );
  }

  async function handleDiagramStyleChange(next: "classic" | "process_map") {
    if (next === diagramStyle) return;
    try {
      const res = await fetch(`/api/workflows/${workflow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagramStyle: next }),
      });
      if (!res.ok) throw new Error();
      const body = await res.json();
      if (typeof body.revision === "number") onServerRevision(body.revision);
      setDiagramStyle(next);
      toast.success(next === "process_map" ? "Process Map style on" : "Classic style on");
      if (next === "process_map") setTimeout(() => handleProcessMapArrangeSoon(), 100);
    } catch {
      toast.error("Could not change the style");
    }
  }
  /** Switches a map between its two looks. Sizes change with the look, so the steps are arranged again (after a preview of how many move). */
  async function handleLookChange(next: "original" | "readable") {
    if (next === look) return;
    try {
      const res = await fetch(`/api/workflows/${workflow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ look: next }),
      });
      if (!res.ok) throw new Error();
      const body = await res.json();
      if (typeof body.revision === "number") onServerRevision(body.revision);
      setLook(next);
      toast.success(next === "readable" ? "Easier-to-read look on" : "Original look on");
      setTimeout(() => handleProcessMapArrangeSoon(), 100);
    } catch {
      toast.error("Could not change the look");
    }
  }
  // After switching style the canvas needs one render before a layout can be previewed.
  const arrangeSoon = useRef<() => void>(() => undefined);
  function handleProcessMapArrangeSoon() {
    arrangeSoon.current();
  }
  useEffect(() => {
    arrangeSoon.current = handleProcessMapArrange;
  });

  function handleAutoArrange() {
    if (nodes.length === 0) return;
    if (isProcessMap) {
      handleProcessMapArrange();
      return;
    }
    const { nodes: layouted } = getLayoutedElements(nodes, edges, {
      nodeDimensions: nodeDimensionsRef.current,
    });
    const next = layouted as FlowNode[];
    setNodes(next);
    pushHistory(next, edges);
    triggerSave(next, edges, activePageIdRef.current);
    setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
  }

  // ── PDF Export ──────────────────────────────────────────────────────────────
  // Builds a vector PDF directly from the nodes/edges data — no rasterization,
  // no embedded PNG. See src/lib/workflow-pdf-export.ts for the renderer.
  async function handleExportPdf() {
    try {
      await exportWorkflowToPdf({
        clientName: workflow.clientName,
        workflowName: workflow.workflowName,
        nodes: nodes as FlowNode[],
        edges: edges as Edge[],
        stepNumbers,
      });
      toast.success("PDF exported");
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Failed to export PDF");
    }
  }

  // Lasso → "Export selected as PDF". Auto-crops the PDF to the bounding
  // box of the selected nodes and drops dangling edges (Lucidchart behavior).
  async function handleExportSelectedPdf() {
    if (selectedNodeIds.length === 0) {
      toast.error("Select nodes first using lasso mode");
      return;
    }
    try {
      await exportWorkflowToPdf({
        clientName: workflow.clientName,
        workflowName: workflow.workflowName,
        nodes: nodes as FlowNode[],
        edges: edges as Edge[],
        selectedNodeIds,
        stepNumbers,
      });
      toast.success(
        `Exported ${selectedNodeIds.length} node${selectedNodeIds.length === 1 ? "" : "s"} as PDF`
      );
    } catch (err) {
      console.error("PDF export (selection) error:", err);
      toast.error("Failed to export selection");
    }
  }

  // ── Mermaid copy ─────────────────────────────────────────────────────────────
  async function handleCopyMermaid() {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const mermaidCode = toMermaid(
      (nodes as unknown as any[]).filter((n) => !(n.data as AnnotationNodeData)?.isAnnotation),
      edges as unknown as any[],
      stepNumbers
    );
    /* eslint-enable @typescript-eslint/no-explicit-any */
    void copyMermaid(mermaidCode, "mermaid");
  }

  // ── Share link ───────────────────────────────────────────────────────────────
  async function handleRevokeShareLink() {
    setShareLoading(true);
    try {
      const res = await fetch(`/api/workflows/${workflow.id}/share`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch((err) => { console.error("[fetch]", err); return {}; });
        throw new Error(data.error ?? "Failed to revoke share link");
      }
      setShareToken(null);
      await fetchVersions();
      toast.success("Old share link turned off");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke share link");
    } finally {
      setShareLoading(false);
    }
  }

  // ── Save as Template ─────────────────────────────────────────────────────────
  function openSaveTemplateDialog() {
    setTemplateName(`${workflow.clientName}: ${workflow.workflowName}`);
    setTemplateIndustry("general");
    setSaveTemplateOpen(true);
  }

  async function handleSaveAsTemplate() {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    try {
      const res = await fetch("/api/workflows/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName.trim(),
          description: workflow.description || null,
          industry: templateIndustry,
          nodes,
          edges,
        }),
      });
      if (res.ok) {
        toast.success("Saved as template");
        setSaveTemplateOpen(false);
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to save template");
      }
    } catch {
      toast.error("Failed to save template");
    } finally {
      setSavingTemplate(false);
    }
  }

  // ── Workflow name editing ───────────────────────────────────────────────────
  function handleNameBlur() {
    setEditingName(false);
    if (nameValue.trim() && nameValue !== workflow.workflowName) {
      onWorkflowNameChange(nameValue.trim());
    }
  }

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable;
      const key = e.key.toLowerCase();

      // Ctrl/Cmd + C — copy selected nodes and their internal edges
      if ((e.ctrlKey || e.metaKey) && key === "c" && !isInput) {
        const snapshot = buildClipboardSnapshot(
          getNodes() as FlowNode[],
          getEdges()
        );
        if (!snapshot) return;
        e.preventDefault();
        setClipboard(snapshot);
        return;
      }

      // Ctrl/Cmd + V — paste clipboard with an offset and fresh ids
      if ((e.ctrlKey || e.metaKey) && key === "v" && !isInput) {
        if (!clipboard) return;
        e.preventDefault();
        pasteClipboardSnapshot(clipboard);
        return;
      }

      // Ctrl/Cmd + D — duplicate the current selection without replacing clipboard
      if ((e.ctrlKey || e.metaKey) && key === "d" && !isInput) {
        const snapshot = buildClipboardSnapshot(
          getNodes() as FlowNode[],
          getEdges()
        );
        if (!snapshot) return;
        e.preventDefault();
        pasteClipboardSnapshot(snapshot);
        return;
      }

      // Delete / Backspace — remove selected node(s) or edge
      if ((e.key === "Delete" || e.key === "Backspace") && !isInput) {
        if (selectedNodeIds.length > 0) {
          e.preventDefault();
          handleDeleteNodes(selectedNodeIds);
          return;
        }
        if (selectedEdgeId) {
          e.preventDefault();
          handleDeleteEdge(selectedEdgeId);
          return;
        }
      }

      // Ctrl/Cmd + Z — undo
      if ((e.ctrlKey || e.metaKey) && key === "z" && !e.shiftKey && !isInput) {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl/Cmd + Shift + Z — redo
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === "z" && !isInput) {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl/Cmd + K — open command palette
      if ((e.ctrlKey || e.metaKey) && key === "k") {
        e.preventDefault();
        setCommandOpen((open) => !open);
        return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeIds, selectedEdgeId, historyIndexRef.current, clipboard, getNodes, getEdges]);

  const renderNodes = useMemo(
    () => {
      const mapped = nodes.map((node) => {
        const isAnnotation = (node.data as { isAnnotation?: boolean })?.isAnnotation === true;
        const hidden = isAnnotation ? !showAnnotations : !showWorkflowNodes;
        // Process Map steps have exact sizes (from the text-fit formula); the canvas uses them as they are.
        const pmShape = scene?.shapes.find((sh) => sh.id === node.id);
        return {
          ...node,
          ...(pmShape ? { style: { ...(node.style ?? {}), width: pmShape.rect.w, height: pmShape.rect.h } } : {}),
          hidden,
          data: {
            ...node.data,
            stepNumber: stepNumbers.get(node.id),
            hasWarning: warnings.has(node.id),
            isOverflow: overflowNodes.has(node.id),
            isMerge: mergeNodes.has(node.id),
            onLabelChange: handleInlineLabelChange,
            onOpenSuggestion: handleOpenSuggestionFromNode,
            hideLabel: !showLabels,
          },
        };
      });
      return scene ? [...mapped, ...derivedProcessMapNodes(scene)] : mapped;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, stepNumbers, warnings, overflowNodes, mergeNodes, showWorkflowNodes, showAnnotations, showLabels, scene]
  );

  const renderEdges = useMemo(
    () =>
      edges.map((edge) => {
        const data = normalizeWorkflowEdgeData(edge.data);
        const recoveryLabel = recoveryEdges.get(edge.id) ?? data.recoveryLabel;
        const isRecovery = data.isRecovery || recoveryEdges.has(edge.id);
        const isHappyPath = data.isHappyPath && !isRecovery;
        const displayLabel = isRecovery
          ? recoveryLabel ?? "↩ Recovery path"
          : isHappyPath
          ? data.label
            ? `✓ ${data.label}`
            : "✓"
          : data.label || edge.label;

        const displayData = {
            ...data,
            isRecovery,
            recoveryLabel,
        };
        return applyEdgeRendering({
          ...edge,
          label: displayLabel,
          data: displayData,
          style: {
            ...edge.style,
            stroke:
              recoveryEdges.has(edge.id) && !data.isRecovery
                ? "#F59E0B"
                : edge.style?.stroke,
            strokeWidth:
              recoveryEdges.has(edge.id) && !data.isRecovery
                ? 2.5
                : edge.style?.strokeWidth,
            strokeDasharray:
              isRecovery && !data.animated
                ? "6 4"
                : data.isPrimary === false && !data.animated && !isRecovery
                ? "6 3"
                : edge.style?.strokeDasharray,
            opacity:
              data.isPrimary === false && !isRecovery ? 0.7 : undefined,
          },
        }, displayData);
      }),
    [edges, recoveryEdges]
  );

  const activeEdgeContextEdge = edgeContextMenu
    ? edges.find((edge) => edge.id === edgeContextMenu.edgeId) ?? null
    : null;
  const activeEdgeContextSource = activeEdgeContextEdge
    ? nodes.find((node) => node.id === activeEdgeContextEdge.source) ?? null
    : null;

  const selectedNode =
    selectedNodeIds.length === 1 && selectedNodeId
      ? nodes.find((n) => n.id === selectedNodeId) ?? null
      : null;
  const selectedEdge = selectedEdgeId
    ? edges.find((edge) => edge.id === selectedEdgeId) ?? null
    : null;
  const currentVersionNumber = versions[0]?.versionNumber ?? workflow.currentVersion ?? 0;
  const pendingTargetNode = pendingConnection?.target
    ? nodes.find((node) => node.id === pendingConnection.target) ?? null
    : null;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <StepNumberContext.Provider value={{ visible: showStepNumbers }}>
    <ProcessMapContext.Provider value={scene}>
    {isProcessMap && <ProcessMapDefs />}
    <div className={`flex flex-col h-screen w-screen overflow-hidden bg-background${look === "readable" ? " font-workflow" : ""}`}>
      {/* ── Top bar ── */}
      <EditorToolbar
        clientName={workflow.clientName}
        workflowName={workflow.workflowName}
        onBack={() => router.push("/admin/workflows")}
        editingName={editingName}
        nameValue={nameValue}
        onNameChange={setNameValue}
        onStartRename={() => setEditingName(true)}
        onNameBlur={handleNameBlur}
        onCancelRename={() => {
          setNameValue(workflow.workflowName);
          setEditingName(false);
        }}
        saveStatus={saveStatus}
        onRetrySave={retrySave}
        currentVersionNumber={currentVersionNumber}
        versions={versions}
        versionsLoading={versionsLoading}
        onOpenVersionPanel={openVersionPanel}
        canUndo={historyIndexRef.current > 0}
        canRedo={historyIndexRef.current < historyRef.current.length - 1}
        onUndo={undo}
        onRedo={redo}
        onAutoArrange={handleAutoArrange}
        isProcessMap={isProcessMap}
        onRenumber={handleRenumber}
        layoutFindingCount={layoutFindings.length}
        layoutHasHighFinding={layoutFindings.some((f) => f.severity === "high")}
        onOpenLayoutCheck={() => setLayoutCheckOpen(true)}
        reviewOpen={reviewOpen}
        onToggleReview={() => (reviewOpen ? setReviewOpen(false) : openReviewPanel())}
        seBriefOpen={seBriefOpen}
        onToggleSEBrief={openSEBriefPanel}
        selectedCount={selectedNodeIds.length}
        exportPages={pages.map((p) => (p.id === activePageId ? { ...p, nodes, edges } : p)) as never}
        activePageId={activePageId}
        exportMeta={{
          clientName: workflow.clientName,
          workflowName: workflow.workflowName,
          versionLabel: workflow.currentVersion ? `v${workflow.currentVersion}` : "Draft",
          fileVersion: workflow.currentVersion ? `v${workflow.currentVersion}` : "draft",
          date: new Date().toISOString().slice(0, 10),
          author: "Talkpush",
          look,
        }}
        onExportPdf={handleExportPdf}
        onExportSelectedPdf={handleExportSelectedPdf}
        onCopyMermaid={handleCopyMermaid}
        onSaveTemplate={openSaveTemplateDialog}
        onShare={() => setShareDialogOpen(true)}
      />

      <div className="lg:hidden border-b border-brand-amber/50 bg-brand-amber/15 px-4 py-3 shrink-0">
        <div className="flex items-start gap-2 text-foreground">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">
            This workflow canvas is designed for desktop screens. You can still make
            edits here, but the best experience is on a laptop or desktop.
          </p>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel. Below md it opens over the canvas instead of squeezing it. */}
        <div className="relative z-20 shrink-0 max-md:w-11">
          <div
            className={cn(
              "flex h-full flex-col border-r border-border bg-card transition-all duration-200",
              sidebarOpen ? "w-60 max-md:absolute max-md:left-0 max-md:top-0 max-md:w-[min(15rem,85vw)] max-md:shadow-xl" : "w-11 md:w-8"
            )}
          >
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="flex h-11 shrink-0 items-center justify-center border-b border-border/50 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:h-8"
              title={sidebarOpen ? "Collapse panel" : "Expand panel"}
              aria-label={sidebarOpen ? "Collapse left panel" : "Expand left panel"}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
            </button>

            {sidebarOpen && (
              <div className="flex-1 overflow-y-auto">
                <NodePalette
                  onAddNode={handlePaletteAddNode}
                  onAddAnnotation={addAnnotationToCanvas}
                  diagramStyle={diagramStyle}
                  onDiagramStyleChange={handleDiagramStyleChange}
                  look={look}
                  onLookChange={handleLookChange}
                  lanePanel={isProcessMap ? lanePanel : undefined}
                  outline={outlineItems}
                  selectedStepId={selectedNodeId}
                  onSelectStep={(id) => {
                    setSelectedNodeId(id);
                    setSelectedNodeIds([id]);
                    setTimeout(() => fitView({ nodes: [{ id }], padding: 1.2, maxZoom: 1, duration: 400 }), 60);
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Canvas + QuickAddBar */}
        <div className="flex flex-col flex-1 min-w-0">
          <div ref={canvasRef} className="flex-1 relative">
            <ReactFlow
              nodes={renderNodes}
              edges={renderEdges}
              onNodesChange={handleNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onConnectEnd={onConnectEnd}
              onReconnect={onReconnect}
              onReconnectStart={onReconnectStart}
              onReconnectEnd={onReconnectEnd}
              onNodeClick={handleNodeClick}
              onPaneClick={handlePaneClick}
              onSelectionChange={handleSelectionChange}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onEdgeClick={handleEdgeClick}
              onEdgeDoubleClick={handleEdgeDoubleClick}
              onEdgeContextMenu={handleEdgeContextMenu}
              onNodeDragStop={handleNodeDragStop}
              nodeTypes={nodeTypesFor(diagramStyle)}
              edgeTypes={edgeTypesFor(diagramStyle)}
              defaultEdgeOptions={{ type: "custom", data: DEFAULT_EDGE_DATA }}
              connectionMode={ConnectionMode.Loose}
              edgesReconnectable
              reconnectRadius={16}
              deleteKeyCode={null} // manual deletion only
              selectionOnDrag={lassoMode}
              selectionMode={SelectionMode.Partial}
              panOnDrag={lassoMode ? [1, 2] : true}
              panActivationKeyCode="Space"
              minZoom={0.05}
              nodesDraggable={!isCanvasLocked}
              nodesConnectable={!isCanvasLocked}
              elementsSelectable={!isCanvasLocked}
              className="bg-secondary"
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={16}
                size={1}
                color="var(--border)"
              />
              {/* Canvas behaviour: pan or select, which layers show, bulk delete */}
              <Panel position="top-left" className="m-2">
                <CanvasTools
                  lassoMode={lassoMode}
                  onLassoModeChange={setLassoMode}
                  showWorkflowNodes={showWorkflowNodes}
                  onShowWorkflowNodes={setShowWorkflowNodes}
                  showAnnotations={showAnnotations}
                  onShowAnnotations={setShowAnnotations}
                  showLabels={showLabels}
                  onShowLabels={setShowLabels}
                  showStepNumbers={showStepNumbers}
                  onShowStepNumbers={setShowStepNumbers}
                  selectedCount={selectedNodeIds.length}
                  onDeleteSelected={() => handleDeleteNodes(selectedNodeIds)}
                />
              </Panel>
              {/* Custom zoom controls with accessible tooltips */}
              <Panel position="bottom-left" className="m-2">
                <div className="flex flex-col bg-card border border-border rounded-lg shadow-sm overflow-hidden">
                  <button
                    title="Zoom in"
                    aria-label="Zoom in"
                    className="flex h-11 w-11 items-center justify-center border-b border-border/50 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:h-8 md:w-8"
                    onClick={() => zoomIn({ duration: 200 })}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    title="Zoom out"
                    aria-label="Zoom out"
                    className="flex h-11 w-11 items-center justify-center border-b border-border/50 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:h-8 md:w-8"
                    onClick={() => zoomOut({ duration: 200 })}
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    title="Fit workflow to screen"
                    aria-label="Fit workflow to screen"
                    className="flex h-11 w-11 items-center justify-center border-b border-border/50 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:h-8 md:w-8"
                    onClick={() => fitView({ padding: 0.1, duration: 300 })}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    title={isCanvasLocked ? "Unlock canvas (re-enable editing)" : "Lock canvas (prevent accidental edits)"}
                    aria-label={isCanvasLocked ? "Unlock canvas" : "Lock canvas"}
                    className={`flex h-11 w-11 items-center justify-center transition-colors md:h-8 md:w-8 ${
                      isCanvasLocked
                        ? "bg-brand-lavender-lightest text-foreground hover:bg-brand-lavender-lighter"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground/70"
                    }`}
                    onClick={() => setIsCanvasLocked((v) => !v)}
                  >
                    {isCanvasLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    title={showMinimap ? "Hide minimap" : "Show minimap"}
                    aria-label={showMinimap ? "Hide minimap" : "Show minimap"}
                    className={`flex h-11 w-11 items-center justify-center transition-colors md:h-8 md:w-8 ${
                      showMinimap
                        ? "text-foreground bg-brand-lavender-lightest hover:bg-brand-lavender-lighter"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground/70"
                    }`}
                    onClick={() => setShowMinimap((v) => !v)}
                  >
                    <MapIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Panel>
              {showMinimap && <MiniMap
                position="bottom-right"
                className="!bg-card !border !border-border !rounded-lg"
                nodeColor={(n) => {
                  const data = n.data as unknown as WorkflowNodeData;
                  if (data?.customColor?.border) return data.customColor.border;
                  const cfg =
                    NODE_TYPE_CONFIG[
                      data?.type as keyof typeof NODE_TYPE_CONFIG
                    ];
                  return cfg?.border ?? "#9CA3AF";
                }}
              />}
            </ReactFlow>

            {/* Empty state */}
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center max-w-xs">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                    <LayoutDashboard className="w-6 h-6 text-muted-foreground/60" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Canvas is empty
                  </p>
                  <p className="text-xs text-muted-foreground/60 leading-relaxed">
                    Use Add step in the left panel to add your first step, or type it in Quick Add below.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Page tabs */}
          <PageTabs
            pages={pages.map((p) => ({
              id: p.id,
              name: p.name,
              nodeCount:
                p.id === activePageId
                  ? nodes.length
                  : (p.nodes as unknown as FlowNode[])?.length ?? 0,
            })) as PageTabsItem[]}
            activePageId={activePageId}
            onSwitch={switchPage}
            onAdd={addPage}
            onRename={renamePage}
            onDelete={deletePage}
          />

          {/* Quick Add Bar */}
          <QuickAddBar onAdd={handleQuickAdd} />
        </div>

        {/* Right sidebar — node/edge properties, SE brief, or version history */}
        {reviewOpen && !versionPanelOpen && !seBriefOpen && !selectedNode && !selectedEdge && (
          <ReviewPanel workflowId={workflow.id} onClose={() => setReviewOpen(false)} onCanvasChanged={syncFromServer} />
        )}
        {seBriefOpen && !versionPanelOpen && !reviewOpen && !selectedNode && !selectedEdge && (
          <SEBriefPanel
            workflowId={workflow.id}
            onClose={() => setSeBriefOpen(false)}
          />
        )}
        {selectedNode && !versionPanelOpen && !seBriefOpen && !reviewOpen && (
          <NodeProperties
            nodeId={selectedNode.id}
            data={selectedNode.data as unknown as WorkflowNodeData}
            diagramStyle={diagramStyle}
            otherSteps={nodes
              .filter((n) => n.id !== selectedNode.id && !(n.data as { isAnnotation?: boolean })?.isAnnotation && !["swimlane", "frame", "note", "table"].includes(n.type ?? ""))
              .map((n) => ({ id: n.id, label: String((n.data as WorkflowNodeData).label ?? n.id), number: stepNumbers.get(n.id) ?? "" }))}
            laneControls={lanesMode ? { lanes: laneList.map((l) => l.name), onChange: handleStepLaneChange } : undefined}
            onChange={handleNodeDataChange}
            onDataChange={handleNodeSubDataChange}
            onDelete={handleDeleteNode}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
        {selectedEdge && !selectedNode && !versionPanelOpen && !seBriefOpen && !reviewOpen && (
          <EdgeProperties
            edge={selectedEdge}
            onChange={handleEdgeDataChange}
            onClose={() => setSelectedEdgeId(null)}
          />
        )}
        {versionPanelOpen && (
          <VersionHistory
            workflowId={workflow.id}
            currentVersion={currentVersionNumber}
            versions={versions}
            loading={versionsLoading}
            onClose={() => setVersionPanelOpen(false)}
            onRefresh={fetchVersions}
            onRestore={async (updated) => {
              applyServerWorkflow(updated);
              setVersionPanelOpen(false);
              await syncFromServer();
              await fetchVersions();
            }}
          />
        )}
      </div>

      {/* Save as Template Dialog */}
      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4 text-foreground" />
              Save as template
            </DialogTitle>
            <DialogDescription>
              Save the current workflow canvas as a reusable template.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div>
              <label className="text-sm font-medium text-foreground/85 mb-1 block">
                Template name <span className="text-destructive">*</span>
              </label>
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. BPO Voice Screening"
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-ring focus:outline-none"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground/85 mb-1 block">
                Industry
              </label>
              <select
                value={templateIndustry}
                onChange={(e) => setTemplateIndustry(e.target.value)}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:border-ring focus:outline-none"
              >
                <option value="general">General</option>
                <option value="bpo">BPO</option>
                <option value="retail">Retail</option>
              </select>
            </div>

            <p className="text-xs text-muted-foreground">
              Saves {nodes.length} nodes and {edges.length} edges as a reusable template.
            </p>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSaveTemplateOpen(false)}
                disabled={savingTemplate}
              >
                Cancel
              </Button>
              <LoadingButton
                size="sm"
                variant="cta"
                isLoading={savingTemplate}
                disabled={!templateName.trim()}
                onClick={handleSaveAsTemplate}
                className="gap-1.5"
              >
                {!savingTemplate && <LayoutTemplate className="w-3.5 h-3.5" />}
                {savingTemplate ? "Saving…" : "Save template"}
              </LoadingButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Arrange: say how many steps will move before moving them */}
      <AlertDialog open={layoutPreview !== null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arrange the diagram?</AlertDialogTitle>
            <AlertDialogDescription>
              {layoutPreview?.message ?? (
                <>
                  This puts the main path on one row and drops each branch below its decision. {layoutPreview?.moved} step
                  {layoutPreview?.moved === 1 ? "" : "s"} will move, including any you placed by hand. You can undo it with Ctrl or ⌘ + Z.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLayoutPreview(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                layoutPreview?.apply();
                setLayoutPreview(null);
              }}
            >
              Arrange
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Keyboard shortcuts */}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>Press ? any time (when you are not typing) to see this.</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {([
              ["⌘ / Ctrl + K", "Add a step, or jump to any step by number or name"],
              ["F", "Fit the whole diagram on screen"],
              ["L", "Open the layout check (Process Map style)"],
              ["⌘ / Ctrl + Z", "Undo"],
              ["⌘ / Ctrl + Shift + Z", "Redo"],
              ["⌘ / Ctrl + C, V, D", "Copy, paste, duplicate the selected steps"],
              ["Delete", "Delete the selected steps or connector"],
              ["Double-click", "Rename a step or a connector"],
              ["?", "This list"],
            ] as const).map(([k, v]) => (
              <div key={k} className="contents">
                <dt><kbd className="rounded border border-input bg-secondary px-1.5 py-0.5 text-xs">{k}</kbd></dt>
                <dd className="text-foreground/85">{v}</dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>

      {/* Layout check: the automated version of the self-audit checklist */}
      <Dialog open={layoutCheckOpen} onOpenChange={setLayoutCheckOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Layout check</DialogTitle>
            <DialogDescription>
              {layoutFindings.length === 0 ? "No problems found. Nothing overlaps, no connector crosses a step, and the text fits." : `${layoutFindings.length} thing${layoutFindings.length === 1 ? "" : "s"} worth a look. Nothing is changed for you.`}
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            {layoutFindings.map((f, i) => (
              <li key={i} className="rounded-lg border border-border p-3">
                <p className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${f.severity === "high" ? "bg-destructive/15 text-destructive" : f.severity === "medium" ? "bg-brand-amber/25 text-foreground" : "bg-muted text-foreground/85"}`}>
                    {f.severity === "high" ? "Fix" : f.severity === "medium" ? "Should fix" : "Nice to fix"}
                  </span>
                  <span>{f.message}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{f.recommendation}</p>
                {f.nodeId && (
                  <Button
                    size="xs"
                    variant="outline"
                    className="mt-2"
                    onClick={() => {
                      setLayoutCheckOpen(false);
                      setSelectedNodeId(f.nodeId!);
                      setSelectedNodeIds([f.nodeId!]);
                      setTimeout(() => fitView({ nodes: [{ id: f.nodeId! }], padding: 1.5, duration: 400 }), 80);
                    }}
                  >
                    Show me
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-border/50 pt-3">
            <Button variant="outline" onClick={() => { setLayoutCheckOpen(false); handleProcessMapArrange(); }}>Re-run layout</Button>
            <Button onClick={() => setLayoutCheckOpen(false)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share dialog: people, shared links, what clients see, preview as */}
      <ShareDialog
        workflowId={workflow.id}
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        legacyLinkActive={Boolean(shareToken)}
        onStopLegacyLink={() => void handleRevokeShareLink()}
      />

      {edgeContextMenu && activeEdgeContextEdge && (
        <EdgeContextMenu
          open
          position={edgeContextMenu.position}
          showHappyPath={
            activeEdgeContextSource?.type === "decision" ||
            activeEdgeContextSource?.type === "parallel"
          }
          showRecoveryPath={stepNumbers.has(activeEdgeContextEdge.target)}
          showResetRouting={
            Array.isArray((activeEdgeContextEdge.data as WorkflowEdgeData)?.waypoints) &&
            ((activeEdgeContextEdge.data as WorkflowEdgeData).waypoints as Array<unknown>).length > 0
          }
          onOpenChange={(open) => {
            if (!open) setEdgeContextMenu(null);
          }}
          onMarkHappyPath={() => handleMarkHappyPath(activeEdgeContextEdge.id)}
          onMarkRecoveryPath={() => handleMarkRecoveryPath(activeEdgeContextEdge.id)}
          onAddLabel={() => handleAddEdgeLabelFromContext(activeEdgeContextEdge.id)}
          onResetRouting={() => handleResetWaypoints(activeEdgeContextEdge.id)}
          onDelete={() => handleDeleteEdge(activeEdgeContextEdge.id)}
        />
      )}

      <EdgeTypeModal
        open={edgeTypeModalOpen}
        targetLabel={(pendingTargetNode?.data as WorkflowNodeData | undefined)?.label ?? "this step"}
        targetStepNumber={
          pendingConnection?.target
            ? stepNumbers.get(pendingConnection.target) ?? ""
            : ""
        }
        onCancel={handleEdgeTypeCancel}
        onConfirm={handleEdgeTypeConfirm}
      />

      <NodeSuggestionPopup
        open={nodeSuggestionState.open}
        popupPosition={nodeSuggestionState.popupPosition}
        sourceNodeId={nodeSuggestionState.sourceNodeId}
        sourceNodeType={nodeSuggestionState.sourceNodeType}
        defaultHappyPath={Boolean(
          nodeSuggestionState.sourceNodeId &&
            (nodeSuggestionState.sourceNodeType === "decision" ||
              nodeSuggestionState.sourceNodeType === "parallel") &&
            !edges.some(
              (edge) =>
                edge.source === nodeSuggestionState.sourceNodeId &&
                normalizeWorkflowEdgeData(edge.data).isHappyPath
            )
        )}
        processMap={isProcessMap}
        onSelect={handleSuggestionSelect}
        onDismiss={handleSuggestionDismiss}
      />

      {/* Floating edge label editor */}
      {editingEdge && (
        <div
          style={{
            position: "fixed",
            left: editingEdge.x,
            top: editingEdge.y,
            transform: "translate(-50%, -50%)",
            zIndex: 1000,
          }}
          className="bg-card shadow-lg border border-brand-lavender rounded-lg p-2"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[11px] text-muted-foreground mb-1 px-0.5">Connector label</p>
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={editingEdge.label}
              onChange={(e) =>
                setEditingEdge((prev) =>
                  prev ? { ...prev, label: e.target.value } : null
                )
              }
              onBlur={commitEdgeLabel}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdgeLabel();
                if (e.key === "Escape") setEditingEdge(null);
              }}
              placeholder="e.g. Pass, Fail, Yes, No"
              className="text-xs border border-border rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-ring focus:border-ring w-44"
            />
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDeleteEdge(editingEdge.id);
              }}
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
              title="Delete connector"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>

    {/* ⌘K Command Palette */}
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Add a step, or type a step number or name to go to it…" />
      <CommandList>
        <CommandEmpty>No node types found.</CommandEmpty>
        <CommandGroup heading="Workflow nodes">
          {(Object.entries(NODE_TYPE_CONFIG) as [string, { label: string }][])
            .filter(([type]) => type !== "swimlane" && type !== "frame")
            .map(([type, config]) => (
              <CommandItem
                key={type}
                value={config.label}
                onSelect={() => {
                  handlePaletteAddNode(type as NodeType);
                  setCommandOpen(false);
                }}
              >
                {config.label}
              </CommandItem>
            ))}
          <CommandItem
            value="Candidate Action"
            onSelect={() => {
              handlePaletteAddNode("manual_action", "candidate");
              setCommandOpen(false);
            }}
          >
            Candidate Action
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Layout">
          {(Object.entries(NODE_TYPE_CONFIG) as [string, { label: string }][])
            .filter(([type]) => type === "swimlane" || type === "frame")
            .map(([type, config]) => (
              <CommandItem
                key={type}
                value={config.label}
                onSelect={() => {
                  handlePaletteAddNode(type as NodeType);
                  setCommandOpen(false);
                }}
              >
                {config.label}
              </CommandItem>
            ))}
        </CommandGroup>
        <CommandGroup heading="Go to step">
          {nodes
            .filter((n) => !(n.data as { isAnnotation?: boolean })?.isAnnotation && !["swimlane", "frame", "dangling_endpoint"].includes(n.type ?? ""))
            .map((n) => {
              const num = stepNumbers.get(n.id);
              const label = String((n.data as WorkflowNodeData)?.label ?? n.id);
              return (
                <CommandItem
                  key={`go_${n.id}`}
                  value={`${num ? `${num} ` : ""}${label} (${n.id})`}
                  onSelect={() => {
                    setCommandOpen(false);
                    setSelectedNodeId(n.id);
                    setSelectedNodeIds([n.id]);
                    setTimeout(() => fitView({ nodes: [{ id: n.id }], padding: 1.2, maxZoom: 1, duration: 400 }), 80);
                  }}
                >
                  <span className="mr-2 inline-block w-10 text-right text-xs font-semibold tabular-nums text-muted-foreground">{num ?? "•"}</span>
                  {label}
                </CommandItem>
              );
            })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>

    </ProcessMapContext.Provider>
    </StepNumberContext.Provider>
  );
}

// ─── Outer wrapper — fetches data, provides ReactFlow context ─────────────────

interface WorkflowEditorProps {
  workflowId: string;
}

export default function WorkflowEditor({ workflowId }: WorkflowEditorProps) {
  const [workflow, setWorkflow] = useState<WorkflowProject | null>(null);
  // The revision this screen is based on, and what to do when a save is refused because it is out of date.
  const revisionRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<[FlowNode[], Edge[], Viewport, WorkflowPage[]] | null>(null);
  const [conflict, setConflict] = useState<{ latestRevision: number | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">(
    "saved"
  );
  const router = useRouter();

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/workflows/${workflowId}`);
        if (res.status === 404) {
          router.push("/admin/workflows");
          return;
        }
        if (!res.ok) throw new Error();
        const data = await res.json();
        revisionRef.current = typeof data.revision === "number" ? data.revision : null;
        setWorkflow(migrateWorkflowData(data));
      } catch {
        toast.error("Failed to load workflow");
        router.push("/admin/workflows");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [workflowId, router]);

  const handleSave = useCallback(
    async (
      newNodes: FlowNode[],
      newEdges: Edge[],
      viewport: Viewport,
      newPages: WorkflowPage[]
    ) => {
      setSaveStatus("saving");
      const saveBody = JSON.stringify({
        nodes: newNodes,
        edges: newEdges,
        viewport,
        pages: newPages,
        // Tells the server which version of the workflow this screen was built from.
        baseRevision: revisionRef.current,
      });
      try {
        const res = await fetch(`/api/workflows/${workflowId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: saveBody,
          // A save started while the page is closing may still finish (browsers cap such requests at about 64 KB).
          keepalive: saveBody.length < 60_000,
        });
        if (res.status === 409) {
          // Someone else (another tab, a teammate, or Claude) saved first. Do not overwrite silently.
          const body = (await res.json().catch(() => ({}))) as { latestRevision?: number };
          pendingSaveRef.current = [newNodes, newEdges, viewport, newPages];
          setConflict({ latestRevision: typeof body.latestRevision === "number" ? body.latestRevision : null });
          setSaveStatus("unsaved");
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (typeof data.revision === "number") revisionRef.current = data.revision;
          setWorkflow((current) =>
            current
              ? {
                  ...current,
                  currentVersion: data.currentVersion ?? current.currentVersion,
                  updatedAt: data.updatedAt ?? current.updatedAt,
                  pages: (data.pages as WorkflowPage[]) ?? current.pages,
                }
              : current
          );
          setSaveStatus("saved");
        } else {
          setSaveStatus("unsaved");
          toast.error("Failed to save");
        }
      } catch {
        setSaveStatus("unsaved");
        toast.error("Failed to save");
      }
    },
    [workflowId]
  );

  async function handleWorkflowNameChange(name: string) {
    if (!workflow) return;
    setWorkflow((w) => (w ? { ...w, workflowName: name } : w));
    try {
      await fetch(`/api/workflows/${workflowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowName: name }),
      });
      toast.success("Workflow renamed");
    } catch {
      toast.error("Failed to rename workflow");
    }
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background" role="status">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Loading workflow</span>
      </div>
    );
  }

  if (!workflow) return null;

  return (
    <ReactFlowProvider>
      <EditorInner
        workflow={workflow}
        onWorkflowNameChange={handleWorkflowNameChange}
        saveStatus={saveStatus}
        onSave={handleSave}
        onServerRevision={(n) => {
          revisionRef.current = n;
        }}
      />
      <AlertDialog open={conflict !== null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This workflow was changed somewhere else</AlertDialogTitle>
            <AlertDialogDescription>
              Another browser tab, a teammate or Claude saved a newer version while you were editing, so your latest
              changes were not saved. Reload to see the newest version (your unsaved changes on this screen will be
              lost), or keep your version and replace theirs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                if (conflict?.latestRevision != null) revisionRef.current = conflict.latestRevision;
                const pending = pendingSaveRef.current;
                setConflict(null);
                if (pending) void handleSave(...pending);
              }}
            >
              Keep my version
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => window.location.reload()}>Reload latest</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ReactFlowProvider>
  );
}
