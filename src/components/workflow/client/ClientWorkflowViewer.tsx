"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import { ChevronLeft, ChevronRight, Eye, Footprints, Hash, ListTree, Loader2, Lock, MessageSquare, Pencil, PenLine, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/workflow/ui/toast";
import { StepNumberContext } from "@/components/workflow/StepNumberContext";
import { edgeTypesFor, nodeTypesFor } from "@/components/workflow/registry";
import WorkflowLegend from "@/components/workflow/WorkflowLegend";
import { ProcessMapContext } from "@/components/workflow/process-map/context";
import { ProcessMapDefs, derivedProcessMapNodes } from "@/components/workflow/process-map/nodes";
import { cn } from "@/lib/utils";
import { formatDateInManila } from "@/lib/workflow/dates";
import { nanoid } from "@/lib/workflow/ids";
import { computeStepNumbers } from "@/lib/workflow/numbering";
import { computeDecimalNumbers } from "@/lib/workflow/numbering-decimal";
import { applyOps, OpError, type OpPage, type WorkflowOp } from "@/lib/workflow/ops";
import { buildOutline, walkChoices, walkStart } from "@/lib/workflow/outline";
import { buildScene } from "@/lib/workflow/process-map/scene";
import { boxFor } from "@/lib/workflow/process-map/text-fit";
import { buildRenderEdges } from "@/lib/workflow/render-edges";
import { computeOverlay } from "@/lib/workflow/suggestion-overlay";
import { WORKFLOW_STATUS_CONFIG, type WorkflowStatus } from "@/lib/workflow/types";
import type { Principal } from "@/lib/workflow/access/permissions";
import type { ClientPagePayload } from "@/lib/workflow/access/client-payload";

import { ApiFailure, type ClientApi } from "./api";
import { CommentThread, NewComment } from "./CommentsPanel";
import NamePrompt from "./NamePrompt";
import OutlinePanel from "./OutlinePanel";
import SignOffBar from "./SignOffBar";
import StepDetail, { type EditMode } from "./StepDetail";
import SuggestionsPanel from "./SuggestionsPanel";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
  initial: ClientPagePayload;
  api: ClientApi;
  /** Set when staff are previewing as a client: shows a banner and saves nothing. */
  previewLabel?: string;
  /** Extra controls for the header (for example the Download menu). */
  headerExtras?: (ctx: ViewerExportContext) => React.ReactNode;
}

/** What a header add-on (downloads) needs to know about what is on screen. */
export interface ViewerExportContext {
  pages: OpPage[];
  activePageId: string | null;
  workflow: ClientPagePayload["workflow"];
  view: ClientPagePayload["view"];
}

export default function ClientWorkflowViewer(props: Props) {
  return (
    <ReactFlowProvider>
      <Viewer {...props} />
    </ReactFlowProvider>
  );
}

/** True on large screens (the list sits beside the diagram), false on phones and tablets. */
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia("(min-width: 1024px)");
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => true
  );
}

const READABLE_ROLE: Record<string, string> = { viewer: "Viewing", commenter: "Commenting", editor: "Editor", admin: "Owner" };

function principalOf(you: ClientPagePayload["you"]): Principal {
  return {
    kind: "link",
    level: you.level as Principal["level"],
    editMode: you.editMode as Principal["editMode"],
    canApprove: you.canApprove,
    canComment: you.canComment,
    canAcceptSuggestions: you.canAcceptSuggestions,
  };
}

function Viewer({ initial, api, previewLabel, headerExtras }: Props) {
  const rf = useReactFlow();
  const isDesktop = useIsDesktop();
  const [data, setData] = useState(initial);
  const [basePages, setBasePages] = useState<OpPage[]>(initial.workflow.pages as unknown as OpPage[]);
  const revisionRef = useRef(initial.revision);
  const [activePageId, setActivePageId] = useState<string | null>(initial.workflow.pages[0]?.id ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNumbers, setShowNumbers] = useState(true);
  const [leftTab, setLeftTab] = useState<"outline" | "comments" | "suggestions">("outline");
  const [mobileView, setMobileView] = useState<"outline" | "diagram" | "comments">("outline");
  const [walk, setWalk] = useState<{ current: string; history: string[] } | null>(null);
  const [nameOpen, setNameOpen] = useState(false);
  const afterName = useRef<(() => void) | null>(null);

  // Editing state: edits waiting to be saved (direct) or collected into a suggestion (suggesting).
  const canEditDirect = data.you.canEdit;
  const canSuggest = data.you.canSuggest;
  const [mode, setMode] = useState<EditMode>(canEditDirect ? "edit" : canSuggest ? "suggest" : "view");
  const queue = useRef<WorkflowOp[]>([]);
  const [pending, setPending] = useState(0);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "failed">("saved");
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draftOps, setDraftOps] = useState<WorkflowOp[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestSummary, setSuggestSummary] = useState("");
  const [staleBanner, setStaleBanner] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [others, setOthers] = useState<{ name: string; editing: boolean }[]>([]);

  const principal = useMemo(() => principalOf(data.you), [data.you]);
  const editing = mode !== "view";
  const isProcessMap = data.workflow.diagramStyle === "process_map";

  // The diagram as shown: the saved pages, with the person's unsent suggestion drafted on top.
  const workingPages = useMemo<OpPage[]>(() => {
    if (draftOps.length === 0) return basePages;
    try {
      return applyOps(basePages, draftOps, principal);
    } catch {
      return basePages;
    }
  }, [basePages, draftOps, principal]);

  const activePage = workingPages.find((p) => p.id === activePageId) ?? workingPages[0] ?? null;
  const pageNodes = useMemo(() => (activePage?.nodes ?? []) as any[], [activePage]);
  const pageEdges = useMemo(() => (activePage?.edges ?? []) as any[], [activePage]);
  const numbering = useMemo(
    () => (isProcessMap ? computeDecimalNumbers(pageNodes, pageEdges) : computeStepNumbers(pageNodes as unknown as Node[], pageEdges as unknown as Edge[])),
    [isProcessMap, pageNodes, pageEdges]
  );
  const outline = useMemo(() => buildOutline(pageNodes, numbering.stepNumbers), [pageNodes, numbering]);
  const pendingSuggestions = useMemo(() => data.suggestions.filter((s) => s.status === "pending"), [data.suggestions]);
  const overlay = useMemo(() => computeOverlay(activePage?.id ?? "", pageNodes, pendingSuggestions), [activePage?.id, pageNodes, pendingSuggestions]);

  // Process Map: the exact shapes and connectors, including suggested additions drawn as ghosts.
  const scene = useMemo(() => {
    if (!isProcessMap) return null;
    const ghostNodes = overlay.addedNodes.map((n) => ({ ...n, id: `ghost_${n.id}`, position: n.position ?? { x: 0, y: 0 } }));
    const known = new Set(pageNodes.map((n) => n.id));
    const ghostEdges = overlay.addedEdges.map((e) => ({
      ...e,
      id: `ghost_${e.id}`,
      source: known.has(e.source) ? e.source : `ghost_${e.source}`,
      target: known.has(e.target) ? e.target : `ghost_${e.target}`,
    }));
    return buildScene([...pageNodes, ...ghostNodes], [...pageEdges, ...ghostEdges], {
      clientName: data.workflow.clientName,
      workflowName: data.workflow.workflowName,
      versionLabel: data.view.versionNumber ? `v${data.view.versionNumber}` : "Draft",
      date: new Date(data.workflow.updatedAt).toISOString().slice(0, 10),
      author: data.view.publishedBy ?? "Talkpush",
      hideNumbers: !showNumbers,
    });
  }, [isProcessMap, pageNodes, pageEdges, overlay, data.workflow.clientName, data.workflow.workflowName, data.workflow.updatedAt, data.view.versionNumber, data.view.publishedBy, showNumbers]);

  const draftAddedIds = useMemo(
    () => new Set(draftOps.filter((o): o is Extract<WorkflowOp, { op: "addNode" }> => o.op === "addNode").map((o) => o.node.id)),
    [draftOps]
  );
  const commentCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of data.comments) if (c.nodeId && !c.parentId && c.status === "open") map.set(c.nodeId, (map.get(c.nodeId) ?? 0) + 1);
    return map;
  }, [data.comments]);
  const openComments = data.comments.filter((c) => !c.parentId && c.status === "open").length;

  const selectedNode = selectedId ? pageNodes.find((n) => n.id === selectedId) ?? null : null;

  // ---- loading and refreshing -------------------------------------------------------------------------

  const reload = useCallback(
    async (silent = false) => {
      if (silent && (queue.current.length > 0 || draftOps.length > 0)) return;
      try {
        const next = await api.load();
        setData(next);
        setBasePages(next.workflow.pages as unknown as OpPage[]);
        revisionRef.current = next.revision;
        setStaleBanner(false);
        setConflict(false);
        if (!silent) {
          queue.current = [];
          setPending(0);
          setDraftOps([]);
        }
      } catch (err) {
        if (!silent) toast.error(err instanceof Error ? err.message : "Could not refresh.");
      }
    },
    [api, draftOps.length]
  );

  // Poll for changes by others and send a "still here" signal.
  useEffect(() => {
    if (api.readOnly) return;
    let stopped = false;
    // A tab nobody is looking at has no need to ask the server anything; it catches up the moment it is shown again.
    const hidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";
    const tick = async () => {
      if (hidden()) return;
      try {
        const p = await api.poll();
        if (stopped) return;
        setOthers(p.others);
        const clean = queue.current.length === 0 && draftOps.length === 0;
        const knownPending = data.suggestions.filter((s) => s.status === "pending").length;
        if (p.revision > revisionRef.current || p.pendingSuggestions !== knownPending || p.openComments !== openComments) {
          if (clean) await reload(true);
          else if (p.revision > revisionRef.current) setStaleBanner(true);
        }
      } catch {
        // offline or the link was turned off: the next real action will say so
      }
    };
    const beat = async () => {
      if (hidden()) return;
      if (data.you.displayName && data.you.level !== "viewer") {
        try {
          const r = await api.heartbeat(queue.current.length > 0 || draftOps.length > 0);
          if (!stopped) setOthers(r.others);
        } catch {
          // ignore
        }
      }
    };
    const poll = setInterval(tick, 10_000);
    const heart = setInterval(beat, 15_000);
    void beat();
    const onFocus = () => void tick();
    const onVisible = () => {
      if (!hidden()) {
        void tick();
        void beat();
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(poll);
      clearInterval(heart);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [api, draftOps.length, data.suggestions, data.you.displayName, data.you.level, openComments, reload]);

  // Do not let a person close the page while edits are unsaved.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (queue.current.length > 0 || draftOps.length > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draftOps.length]);

  // ---- names -------------------------------------------------------------------------------------------

  const requireName = useCallback(
    (action: () => void) => {
      if (api.readOnly) return toast.info("This is a preview. Nothing is saved.");
      if (data.you.needsName) {
        afterName.current = action;
        setNameOpen(true);
        return;
      }
      action();
    },
    [api.readOnly, data.you.needsName]
  );

  async function submitName(name: string, email?: string) {
    await api.identify(name, email);
    await reload(true);
    setNameOpen(false);
    const next = afterName.current;
    afterName.current = null;
    // `needsName` is false after the reload; run what they were doing.
    setTimeout(() => next?.(), 0);
  }

  // ---- edits -------------------------------------------------------------------------------------------

  const flushing = useRef(false);
  const flush = useCallback(async () => {
    if (flushing.current) return; // one save at a time; the loop below picks up anything added meanwhile
    flushing.current = true;
    try {
      while (queue.current.length > 0) {
        const ops = queue.current.slice();
        setSaveState("saving");
        try {
          const res = await api.saveOps(revisionRef.current, ops);
          revisionRef.current = res.revision;
          queue.current = queue.current.slice(ops.length);
          setPending(queue.current.length);
        } catch (err) {
          setSaveState("failed");
          if (err instanceof ApiFailure && err.info.status === 409) setConflict(true);
          else toast.error(err instanceof Error ? err.message : "Could not save.");
          return;
        }
      }
      setSaveState("saved");
    } finally {
      flushing.current = false;
    }
  }, [api]);

  const schedule = useCallback(() => {
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => void flush(), 700);
  }, [flush]);

  const commitOps = useCallback(
    (ops: WorkflowOp[]) => {
      if (mode === "view") return;
      requireName(() => {
        if (mode === "edit") {
          try {
            setBasePages((prev) => applyOps(prev, ops, principal));
          } catch (e) {
            toast.error(e instanceof OpError ? e.message : "That change is not allowed.");
            return;
          }
          queue.current = [...queue.current, ...ops];
          setPending(queue.current.length);
          setSaveState("saving");
          schedule();
        } else {
          setDraftOps((d) => [...d, ...ops]);
        }
      });
    },
    [mode, principal, requireName, schedule]
  );

  const pageId = activePage?.id ?? "";

  function editField(field: "label" | "notes" | "actorLabel", value: string) {
    if (!selectedId) return;
    commitOps([{ op: "updateNode", pageId, nodeId: selectedId, patch: { [field]: value } }]);
  }

  const newEdgeData = () =>
    JSON.parse(JSON.stringify({ label: "", lineType: "smoothstep", markerStart: "none", markerEnd: "arrowclosed", strokeColor: "#6B7280", strokeWidth: 1, animated: false, pathSemantic: "neutral", isHappyPath: false, isRecovery: false }));

  function addStepAfter() {
    if (!selectedNode) return;
    const id = `node_${nanoid(8)}`;
    const node = {
      id,
      type: "stage",
      position: { x: selectedNode.position.x, y: selectedNode.position.y + 170 },
      data: { label: "New step", type: "stage", notes: "", actor: "manual", actorLabel: "" },
    };
    const edge = { id: `edge_${nanoid(8)}`, source: selectedNode.id, target: id, sourceHandle: "bottom", targetHandle: "top", type: "custom", data: newEdgeData() };
    commitOps([
      { op: "addNode", pageId, node },
      { op: "addEdge", pageId, edge },
    ]);
    setSelectedId(id);
  }

  function deleteStep() {
    if (!selectedId) return;
    commitOps([{ op: "deleteNode", pageId, nodeId: selectedId }]);
    setSelectedId(null);
  }

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return;
      commitOps([
        {
          op: "addEdge",
          pageId,
          edge: { id: `edge_${nanoid(8)}`, source: c.source, target: c.target, sourceHandle: c.sourceHandle, targetHandle: c.targetHandle, type: "custom", data: newEdgeData() },
        },
      ]);
    },
    [commitOps, pageId]
  );

  async function sendSuggestion() {
    requireName(async () => {
      try {
        await api.suggest(revisionRef.current, draftOps, suggestSummary || undefined);
        setDraftOps([]);
        setSuggestOpen(false);
        setSuggestSummary("");
        toast.success("Suggestion sent. The owner will review it.");
        await reload(true);
        setLeftTab("suggestions");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not send your suggestion.");
      }
    });
  }

  // ---- comments, suggestions, sign-off ------------------------------------------------------------------

  const nodeComments = useMemo(
    () => data.comments.filter((c) => c.nodeId === selectedId || (c.parentId && data.comments.find((p) => p.id === c.parentId)?.nodeId === selectedId)),
    [data.comments, selectedId]
  );

  async function addComment(body: string, nodeId?: string, parentId?: string) {
    await new Promise<void>((resolve, reject) =>
      requireName(async () => {
        try {
          await api.comment({ pageId, nodeId, parentId, body, versionId: data.view.versionId ?? undefined });
          await reload(true);
          resolve();
        } catch (err) {
          reject(err);
        }
      })
    );
  }

  async function setCommentStatus(id: string, status: "open" | "resolved") {
    try {
      await api.setCommentStatus(id, status);
      await reload(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the comment.");
    }
  }

  async function resolveSuggestion(id: string, action: "accept" | "reject" | "withdraw"): Promise<string | null> {
    try {
      const out = await api.resolveSuggestion(id, action);
      await reload(true);
      return out.status === "stale" ? (out.message ?? "That suggestion no longer fits.") : null;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not do that.");
      return null;
    }
  }

  async function submitDecision(action: "approved" | "changes_requested", comment?: string) {
    await new Promise<void>((resolve, reject) =>
      requireName(async () => {
        try {
          await api.feedback({ action, comment, versionId: data.view.versionId ?? undefined });
          await reload(true);
          toast.success(action === "approved" ? "Thank you. Your approval is recorded." : "Thank you. Your request is sent.");
          resolve();
        } catch (err) {
          reject(err);
        }
      })
    );
  }

  // ---- walk-through -------------------------------------------------------------------------------------

  function focusNode(id: string) {
    setSelectedId(id);
    const n = pageNodes.find((x) => x.id === id);
    if (n) rf.setCenter(n.position.x + 100, n.position.y + 40, { zoom: 1, duration: 400 });
  }

  function startWalk() {
    const start = walkStart(pageNodes, pageEdges, numbering.stepNumbers);
    if (!start) return;
    setWalk({ current: start, history: [] });
    setMobileView("diagram");
    setTimeout(() => focusNode(start), 50);
  }

  function walkTo(id: string) {
    setWalk((w) => (w ? { current: id, history: [...w.history, w.current] } : w));
    focusNode(id);
  }

  function walkBack() {
    setWalk((w) => {
      if (!w || w.history.length === 0) return w;
      const prev = w.history[w.history.length - 1];
      setTimeout(() => focusNode(prev), 0);
      return { current: prev, history: w.history.slice(0, -1) };
    });
  }

  // ---- what the diagram draws -----------------------------------------------------------------------------

  const canDrag = editing && !api.readOnly;
  const renderNodes = useMemo(() => {
    const sizeOf = (n: any): React.CSSProperties => {
      if (!isProcessMap || n.type === "table") return {};
      const shape = scene?.shapes.find((s) => s.id === n.id);
      const box = shape ? null : boxFor(n);
      return { width: shape?.rect.w ?? box!.width, height: shape?.rect.h ?? box!.height };
    };
    const real = pageNodes.map((n) => {
      const marks = overlay.nodeMarks.get(n.id) ?? [];
      const style: React.CSSProperties = { ...(n.style ?? {}), ...sizeOf(n) };
      if (marks.includes("deleted")) Object.assign(style, { outline: "2px dashed #dc2626", outlineOffset: 4, opacity: 0.55, background: "rgba(254,226,226,0.5)" });
      else if (marks.includes("edited")) Object.assign(style, { outline: "2px dashed #d97706", outlineOffset: 4 });
      if (draftAddedIds.has(n.id)) Object.assign(style, { outline: "2px dashed #16a34a", outlineOffset: 4 });
      const isWalk = walk?.current === n.id;
      return {
        ...n,
        draggable: canDrag,
        selected: selectedId === n.id,
        style: isWalk ? { ...style, outline: "3px solid #2563eb", outlineOffset: 4, borderRadius: 12 } : style,
        data: {
          ...n.data,
          stepNumber: numbering.stepNumbers.get(n.id),
          hasWarning: numbering.warnings.has(n.id),
          isOverflow: numbering.overflowNodes.has(n.id),
          isMerge: numbering.mergeNodes.has(n.id),
        },
      };
    });
    const ghosts = overlay.addedNodes.map((n) => ({
      ...n,
      id: `ghost_${n.id}`,
      draggable: false,
      selectable: false,
      connectable: false,
      style: { ...(n.style ?? {}), ...sizeOf({ ...n, id: `ghost_${n.id}` }), outline: "2px dashed #16a34a", outlineOffset: 4, opacity: 0.85 },
    }));
    const moved = [...overlay.movedTo.entries()].map(([id, position]) => {
      const n = pageNodes.find((x) => x.id === id)!;
      return { ...n, id: `moved_${id}`, position, draggable: false, selectable: false, connectable: false, style: { ...(n.style ?? {}), ...sizeOf(n), outline: "2px dashed #6b7280", outlineOffset: 4, opacity: 0.35 } };
    });
    return [...real, ...ghosts, ...moved, ...(scene ? derivedProcessMapNodes(scene) : [])];
  }, [pageNodes, overlay, draftAddedIds, canDrag, selectedId, numbering, walk, isProcessMap, scene]);

  const renderEdges = useMemo(() => {
    const base = buildRenderEdges(pageEdges, "recoveryEdges" in numbering ? numbering.recoveryEdges : new Map(), (e) =>
      overlay.deletedEdgeIds.has(e.id) ? { style: { ...(e.style ?? {}), stroke: "#dc2626", strokeDasharray: "6 4", opacity: 0.6 } } : {}
    );
    const added = buildRenderEdges(overlay.addedEdges, new Map(), () => ({ style: { stroke: "#16a34a", strokeDasharray: "6 4" } })).map((e) => ({
      ...e,
      id: `ghost_${e.id}`,
      source: pageNodes.some((n) => n.id === e.source) ? e.source : `ghost_${e.source}`,
      target: pageNodes.some((n) => n.id === e.target) ? e.target : `ghost_${e.target}`,
    }));
    return [...base, ...added];
  }, [pageEdges, numbering, overlay, pageNodes]);

  // ---- layout ------------------------------------------------------------------------------------------------

  const statusCfg = WORKFLOW_STATUS_CONFIG[data.workflow.status as WorkflowStatus];
  const walkNode = walk ? pageNodes.find((n) => n.id === walk.current) : null;
  const choices = walk ? walkChoices(walk.current, pageEdges) : [];
  const desktopTab = leftTab === "suggestions" && data.you.level === "viewer" ? "outline" : leftTab;
  // Which list the left panel shows: chosen by tabs on a large screen, by the three-way switch on a small one.
  const panel: "outline" | "comments" | "suggestions" = isDesktop ? desktopTab : mobileView === "comments" ? "comments" : "outline";
  const canModeSwitch = canEditDirect && canSuggest;
  const nodeTypes = useMemo(() => nodeTypesFor(isProcessMap ? "process_map" : "classic"), [isProcessMap]);
  const edgeTypes = useMemo(() => edgeTypesFor(isProcessMap ? "process_map" : "classic"), [isProcessMap]);

  return (
    <StepNumberContext.Provider value={{ visible: showNumbers }}>
      <ProcessMapContext.Provider value={scene}>
        <div className="flex h-dvh flex-col bg-background text-foreground">
          {isProcessMap && <ProcessMapDefs />}
          {previewLabel && (
            <div role="status" className="shrink-0 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900">
              Previewing as {previewLabel}. This is what they see. Nothing you do here is saved.
            </div>
          )}

          <header className="shrink-0 border-b border-border bg-card px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Lock className="h-3 w-3" aria-hidden />
                  {data.workflow.clientName}
                </p>
                <h1 className="truncate text-lg font-bold tracking-tight">{data.workflow.workflowName}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {others.length > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs" title={others.map((o) => o.name).join(", ")}>
                    <Users className="h-3 w-3" aria-hidden />
                    {others.length === 1 ? `${others[0].name} is ${others[0].editing ? "editing" : "here"}` : `${others.length} people here`}
                  </span>
                )}
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusCfg?.className ?? "bg-muted text-foreground"}`}>{statusCfg?.label ?? data.workflow.status}</span>
                <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                  {READABLE_ROLE[data.you.level] ?? data.you.level}
                  {data.you.displayName ? ` · ${data.you.displayName}${data.you.verified ? "" : " (unverified)"}` : ""}
                </span>
                {canModeSwitch && !api.readOnly && (
                  <div role="group" aria-label="Editing mode" className="flex overflow-hidden rounded-md border border-border text-xs">
                    {(["edit", "suggest"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={mode === m}
                        onClick={() => {
                          if (draftOps.length && !window.confirm("Switching modes discards your unsent suggestion. Continue?")) return;
                          setDraftOps([]);
                          setMode(m);
                        }}
                        className={cn("flex min-h-8 items-center gap-1 px-2.5 py-1", mode === m ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}
                      >
                        {m === "edit" ? <Pencil className="h-3 w-3" /> : <PenLine className="h-3 w-3" />}
                        {m === "edit" ? "Editing" : "Suggesting"}
                      </button>
                    ))}
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={startWalk} className="min-h-8"><Footprints className="h-3.5 w-3.5" />Walk me through</Button>
                <button
                  type="button"
                  onClick={() => setShowNumbers((v) => !v)}
                  aria-pressed={showNumbers}
                  className="flex min-h-8 items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                >
                  <Hash className="h-3 w-3" />
                  {showNumbers ? "Hide numbers" : "Show numbers"}
                </button>
                {headerExtras?.({ pages: workingPages, activePageId: activePage?.id ?? null, workflow: data.workflow, view: data.view })}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {data.view.kind === "published" ? (
                <span>
                  Version {data.view.versionNumber} · published {data.view.publishedAt ? formatDateInManila(data.view.publishedAt, { month: "short", day: "numeric", year: "numeric" }) : ""}
                  {data.view.publishedBy ? ` by ${data.view.publishedBy}` : ""}
                </span>
              ) : (
                <span>Live draft · updated {formatDateInManila(data.workflow.updatedAt, { month: "short", day: "numeric", year: "numeric" })}</span>
              )}
              {editing && mode === "edit" && (
                <span role="status" className={saveState === "failed" ? "font-medium text-destructive" : ""}>
                  {saveState === "saving" ? "Saving…" : saveState === "failed" ? "Not saved. Retrying needs a refresh." : pending ? "Saving…" : "All changes saved"}
                </span>
              )}
              {mode === "suggest" && draftOps.length > 0 && (
                <span className="flex items-center gap-2">
                  <strong className="text-foreground">{draftOps.length} change{draftOps.length === 1 ? "" : "s"} in your suggestion</strong>
                  <Button size="xs" onClick={() => setSuggestOpen(true)}>Send suggestion</Button>
                  <Button size="xs" variant="ghost" onClick={() => setDraftOps([])}>Discard</Button>
                </span>
              )}
              {data.workflow.description && <span className="min-w-0 truncate">{data.workflow.description}</span>}
            </div>
          </header>

          {(staleBanner || conflict) && (
            <div role="alert" className="flex shrink-0 flex-wrap items-center gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
              <span>{conflict ? "Someone else changed this workflow, so your last changes were not saved." : "New changes from someone else are available."}</span>
              <Button size="sm" variant="outline" onClick={() => void reload(false)}>Refresh{conflict ? " (your unsaved changes are lost)" : ""}</Button>
            </div>
          )}

          {/* Small screens switch between outline, diagram and comments; large screens show the list beside the diagram. */}
          <div className="flex shrink-0 border-b border-border bg-card lg:hidden" role="tablist" aria-label="View">
            {([["outline", "Outline", ListTree], ["diagram", "Diagram", Eye], ["comments", `Comments${openComments ? ` (${openComments})` : ""}`, MessageSquare]] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mobileView === id}
                onClick={() => {
                  setMobileView(id);
                  if (id === "diagram") setTimeout(() => rf.fitView({ padding: 0.15 }), 50);
                }}
                className={cn("flex min-h-11 flex-1 items-center justify-center gap-1.5 border-b-2 text-sm", mobileView === id ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground")}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>

          <div className="flex min-h-0 flex-1">
            {/* left panel */}
            <div className={cn("w-full min-w-0 flex-col border-r border-border bg-card lg:flex lg:w-[22rem] lg:shrink-0", mobileView === "diagram" ? "hidden" : "flex")}>
              <div className="hidden shrink-0 border-b border-border lg:flex" role="tablist" aria-label="Panel">
                {([["outline", "Outline"], ["comments", `Comments${openComments ? ` (${openComments})` : ""}`], ...(data.you.level !== "viewer" ? [["suggestions", `Suggestions${pendingSuggestions.length ? ` (${pendingSuggestions.length})` : ""}`]] : [])] as [string, string][]).map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={panel === id} onClick={() => setLeftTab(id as typeof leftTab)} className={cn("min-h-10 flex-1 border-b-2 px-2 text-xs", panel === id ? "border-primary font-semibold" : "border-transparent text-muted-foreground")}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {panel === "outline" ? (
                  <OutlinePanel
                    items={outline}
                    selectedId={selectedId}
                    commentCounts={commentCounts}
                    onSelect={(id) => {
                      setSelectedId(id);
                      if (isDesktop) focusNode(id);
                    }}
                  />
                ) : null}
                {panel === "comments" && (
                  <div className="space-y-4 p-3">
                    <CommentThread comments={data.comments} canComment={data.you.canComment} onReply={(parentId, body) => addComment(body, undefined, parentId)} onSetStatus={setCommentStatus} />
                    {data.you.canComment && <NewComment placeholder="Comment on this page" onSend={(body) => addComment(body)} />}
                  </div>
                )}
                {panel === "suggestions" && data.you.level !== "viewer" && (
                  <SuggestionsPanel suggestions={data.suggestions} canAccept={data.you.canAcceptSuggestions} onResolve={resolveSuggestion} />
                )}
              </div>
            </div>

            {/* diagram */}
            <div className={cn("relative min-w-0 flex-1 lg:block", mobileView === "diagram" ? "block" : "hidden")}>
              <div className="absolute inset-0">
                <ReactFlow
                  key={activePage?.id ?? "single"}
                  nodes={renderNodes as Node[]}
                  edges={renderEdges}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  onNodeClick={(_, node) => !String(node.id).startsWith("ghost_") && !String(node.id).startsWith("moved_") && !node.id.startsWith("pm_") && !node.id.startsWith("container_") && setSelectedId(node.id)}
                  onPaneClick={() => setSelectedId(null)}
                  onEdgeClick={(_, edge) => {
                    if (!canDrag || String(edge.id).startsWith("ghost_")) return;
                    const label = window.prompt("Connector label", String((edge.data as any)?.label ?? ""));
                    if (label !== null) commitOps([{ op: "updateEdge", pageId, edgeId: edge.id, patch: { label } }]);
                  }}
                  onNodeDragStop={(_, node) => canDrag && commitOps([{ op: "moveNode", pageId, nodeId: node.id, position: { x: Math.round(node.position.x), y: Math.round(node.position.y) } }])}
                  onConnect={onConnect}
                  nodesDraggable={canDrag}
                  nodesConnectable={canDrag}
                  elementsSelectable
                  connectionMode={ConnectionMode.Loose}
                  fitView
                  fitViewOptions={{ padding: 0.1 }}
                  minZoom={0.05}
                  className="bg-muted/30"
                >
                  <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#d8d6c6" />
                  <Controls showInteractive={false} position="bottom-left" />
                </ReactFlow>

                {(overlay.addedNodes.length > 0 || overlay.nodeMarks.size > 0) && (
                  <p className="pointer-events-none absolute left-3 top-3 max-w-xs rounded-md bg-card/95 px-2.5 py-1.5 text-[11px] text-muted-foreground shadow">
                    Dashed green = suggested addition · red = suggested removal · amber = suggested edit · grey = suggested move
                  </p>
                )}

                {walk && walkNode && (
                  <div className="absolute inset-x-3 bottom-3 z-10 mx-auto max-w-xl rounded-xl border border-border bg-card p-4 shadow-lg" role="dialog" aria-label="Walk-through">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-muted-foreground">Step {numbering.stepNumbers.get(walkNode.id) ?? "•"} · walk-through</p>
                        <p className="font-semibold">{walkNode.data?.label}</p>
                        {walkNode.data?.notes && <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{walkNode.data.notes}</p>}
                      </div>
                      <Button variant="ghost" size="icon-sm" onClick={() => setWalk(null)} aria-label="Stop walk-through"><X className="h-4 w-4" /></Button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" onClick={walkBack} disabled={walk.history.length === 0}><ChevronLeft className="h-4 w-4" />Back</Button>
                      {choices.length === 0 && <span className="text-sm text-muted-foreground">This is where this path ends.</span>}
                      {choices.map((c) => (
                        <Button key={c.edgeId} size="sm" variant={c.isMain ? "default" : "secondary"} onClick={() => walkTo(c.targetId)}>
                          {c.label ? `${c.label}: ` : ""}
                          {String(pageNodes.find((n) => n.id === c.targetId)?.data?.label ?? "Next")}
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* step details: a side panel on large screens, a bottom sheet on small ones */}
            {selectedNode && (
              <>
                <button type="button" aria-label="Close step details" className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSelectedId(null)} />
                <div className="fixed inset-x-0 bottom-0 z-40 max-h-[75dvh] rounded-t-2xl border-t border-border shadow-2xl lg:static lg:z-auto lg:max-h-none lg:w-96 lg:shrink-0 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none">
                  <StepDetail
                    node={selectedNode}
                    stepNumber={numbering.stepNumbers.get(selectedNode.id)}
                    comments={nodeComments}
                    canComment={data.you.canComment}
                    editMode={api.readOnly ? "view" : mode}
                    textChanges={overlay.textChanges.get(selectedNode.id)}
                    onClose={() => setSelectedId(null)}
                    onEditField={editField}
                    onAddAfter={addStepAfter}
                    onDelete={deleteStep}
                    onComment={(body) => addComment(body, selectedNode.id)}
                    onReply={(parentId, body) => addComment(body, selectedNode.id, parentId)}
                    onSetStatus={setCommentStatus}
                  />
                </div>
              </>
            )}
          </div>

          {workingPages.length > 1 && (
            <nav aria-label="Pages" className="flex shrink-0 gap-1.5 overflow-x-auto border-t border-border bg-card px-3 py-2">
              {workingPages.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setActivePageId(p.id);
                    setSelectedId(null);
                  }}
                  aria-current={p.id === activePage?.id ? "page" : undefined}
                  className={cn("min-h-9 shrink-0 rounded-md border px-3 text-xs", p.id === activePage?.id ? "border-primary bg-primary/10 font-semibold" : "border-border hover:bg-muted")}
                >
                  {p.name}
                </button>
              ))}
            </nav>
          )}

          {!isProcessMap && (
            <details className="shrink-0 border-t border-border bg-card">
              <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-muted-foreground">Legend</summary>
              <WorkflowLegend showFeasibility={workingPages.some((p) => p.nodes.some((n: any) => Boolean(n.data?.feasibility)))} />
            </details>
          )}

          {data.you.canApprove && <SignOffBar latest={data.latestDecision} disabled={api.readOnly} onSubmit={submitDecision} sticky />}

          {suggestOpen && (
            <div role="dialog" aria-label="Send suggestion" className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
              <div className="w-full max-w-md rounded-xl bg-card p-5 shadow-xl">
                <h2 className="text-base font-semibold">Send your suggestion</h2>
                <p className="mt-1 text-sm text-muted-foreground">{draftOps.length} change{draftOps.length === 1 ? "" : "s"}. Add a short note so the owner knows what you meant.</p>
                <textarea
                  className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/70"
                  rows={3}
                  maxLength={200}
                  value={suggestSummary}
                  onChange={(e) => setSuggestSummary(e.target.value)}
                  placeholder="For example: split the interview into two steps"
                  aria-label="Note to the owner"
                  autoFocus
                />
                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setSuggestOpen(false)}>Cancel</Button>
                  <Button onClick={() => void sendSuggestion()}>Send</Button>
                </div>
              </div>
            </div>
          )}

          <NamePrompt
            open={nameOpen}
            onSubmit={submitName}
            onCancel={() => {
              afterName.current = null;
              setNameOpen(false);
            }}
          />

          {saveState === "saving" && <Loader2 className="pointer-events-none fixed bottom-3 right-3 z-50 h-4 w-4 animate-spin text-muted-foreground" aria-hidden />}
        </div>
      </ProcessMapContext.Provider>
    </StepNumberContext.Provider>
  );
}
