"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/workflow/ui/toast";
import { formatDistanceToNow } from "@/lib/workflow/dates";
import {
  Copy,
  LayoutTemplate,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/workflow/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  WORKFLOW_STATUS_CONFIG,
  type WorkflowStatus,
} from "@/lib/workflow/types";
import DeleteConfirmDialog from "@/components/workflow/ui/DeleteConfirmDialog";
import { useDebouncedSearch } from "@/components/workflow/ui/useDebouncedSearch";
import NewWorkflowModal from "./modals/NewWorkflowModal";
import TemplatePickerModal from "./modals/TemplatePickerModal";

interface WorkflowItem {
  id: string;
  clientName: string;
  workflowName: string;
  description: string | null;
  status: WorkflowStatus;
  currentVersion?: number;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
  feedback: {
    action: string;
    reviewerName: string;
    createdAt: string;
  }[];
  attention?: { openComments: number; pendingSuggestions: number; openRequests: number };
}

/** Anything a person should look at: client comments, waiting suggestions, access requests, or a decision that needs follow-up. */
function needsAttention(w: WorkflowItem): boolean {
  const a = w.attention;
  return Boolean((a && (a.openComments || a.pendingSuggestions || a.openRequests)) || w.status === "changes_requested" || w.status === "modified_since_approval");
}

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "needs_attention", label: "Needs attention" },
  { value: "draft", label: "Draft" },
  { value: "shared", label: "Shared" },
  { value: "approved", label: "Approved" },
  { value: "changes_requested", label: "Changes Requested" },
];

export default function WorkflowDashboard() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { input: searchInput, setInput: setSearchInput, query: searchQuery } = useDebouncedSearch();
  const [statusFilter, setStatusFilter] = useState("all");
  const [groupByClient, setGroupByClient] = useState(false);

  // Modal state
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedTemplateName, setSelectedTemplateName] = useState<string | null>(null);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<WorkflowItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Save-as-template state
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null);

  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (statusFilter !== "all" && statusFilter !== "needs_attention") params.set("status", statusFilter);
      const res = await fetch(`/api/workflows?${params}`);
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data.items);
      }
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const visible = statusFilter === "needs_attention" ? workflows.filter(needsAttention) : workflows;
  const sections: [string | null, WorkflowItem[]][] = groupByClient
    ? [...visible.reduce((map, w) => map.set(w.clientName, [...(map.get(w.clientName) ?? []), w]), new Map<string, WorkflowItem[]>())].sort((a, b) => a[0].localeCompare(b[0]))
    : [[null, visible]];

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/workflows/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Workflow deleted");
        setWorkflows((prev) => prev.filter((w) => w.id !== deleteTarget.id));
      } else {
        toast.error("Failed to delete workflow");
      }
    } catch {
      toast.error("Failed to delete workflow");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  async function handleDuplicate(workflow: WorkflowItem) {
    try {
      const [res, originalRes] = await Promise.all([
        fetch("/api/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: workflow.clientName,
            workflowName: `${workflow.workflowName} (Copy)`,
            description: workflow.description,
          }),
        }),
        fetch(`/api/workflows/${workflow.id}`),
      ]);

      if (res.ok && originalRes.ok) {
        const [{ id }, original] = await Promise.all([
          res.json(),
          originalRes.json(),
        ]);

        const copyRes = await fetch(`/api/workflows/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodes: original.nodes,
            edges: original.edges,
          }),
        });
        if (!copyRes.ok) throw new Error();
        toast.success("Workflow duplicated");
        fetchWorkflows();
      } else {
        toast.error("Failed to duplicate workflow");
      }
    } catch {
      toast.error("Failed to duplicate workflow");
    }
  }

  async function handleSaveAsTemplate(workflow: WorkflowItem) {
    setSavingTemplateId(workflow.id);
    try {
      const fullRes = await fetch(`/api/workflows/${workflow.id}`);
      if (!fullRes.ok) throw new Error();
      const full = await fullRes.json();

      const res = await fetch("/api/workflows/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${workflow.clientName} — ${workflow.workflowName}`,
          description: workflow.description,
          industry: "general",
          nodes: full.nodes,
          edges: full.edges,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Saved as template");
    } catch {
      toast.error("Failed to save as template");
    } finally {
      setSavingTemplateId(null);
    }
  }

  function handleTemplateSelect(templateId: string, templateName: string) {
    setSelectedTemplateId(templateId);
    setSelectedTemplateName(templateName);
    setNewModalOpen(true);
  }

  function handleNewModalClose(open: boolean) {
    setNewModalOpen(open);
    if (!open) {
      setSelectedTemplateId(null);
      setSelectedTemplateName(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[28px] font-bold text-gray-900">Workflow Builder</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTemplateModalOpen(true)}
            className="gap-1.5"
          >
            <LayoutTemplate className="w-4 h-4" />
            Start from Template
          </Button>
          <Button
            variant="cta"
            size="sm"
            onClick={() => setNewModalOpen(true)}
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            New Workflow
          </Button>
        </div>
      </div>

      {/* Search + Status filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search workflows..."
            className="pl-9 border border-gray-300 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>
        <div className="flex gap-1">
          {STATUS_TABS.map((tab) => (
            <Button
              key={tab.value}
              variant={statusFilter === tab.value ? "cta" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter(tab.value)}
              className={statusFilter === tab.value ? undefined : "text-gray-500"}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input type="checkbox" checked={groupByClient} onChange={(e) => setGroupByClient(e.target.checked)} />
          Group by client
        </label>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-5 space-y-3">
              <Skeleton className="h-4 w-32 animate-pulse" />
              <Skeleton className="h-5 w-48 animate-pulse" />
              <Skeleton className="h-3 w-24 animate-pulse" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-20">
          <Workflow className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-base font-medium text-gray-800 mb-1">
            {searchInput || statusFilter !== "all"
              ? "No workflows match your filters"
              : "No workflows yet"}
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            {searchInput || statusFilter !== "all"
              ? "Try a different search or clear filters"
              : "Create your first workflow to get started"}
          </p>
          {!searchInput && statusFilter === "all" && (
            <Button
              variant="cta"
              size="sm"
              onClick={() => setNewModalOpen(true)}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              New Workflow
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
        {sections.map(([clientName, list]) => (
        <section key={clientName ?? "all"} aria-label={clientName ?? "Workflows"}>
        {clientName && <h2 className="mb-2 text-sm font-semibold text-gray-700">{clientName} <span className="font-normal text-gray-400">· {list.length}</span></h2>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((w) => {
            const statusCfg = WORKFLOW_STATUS_CONFIG[w.status] ?? WORKFLOW_STATUS_CONFIG.draft;
            const latestFeedback = w.feedback?.[0];

            return (
              <div
                key={w.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/admin/workflows/${w.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/admin/workflows/${w.id}`);
                  }
                }}
                className="group border border-gray-200 rounded-lg p-5 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-inset"
              >
                {/* Three-dot menu */}
                <div
                  className="absolute top-3 right-3"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDuplicate(w)}>
                        <Copy className="w-4 h-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleSaveAsTemplate(w)}
                        disabled={savingTemplateId === w.id}
                      >
                        <LayoutTemplate className="w-4 h-4 mr-2" />
                        {savingTemplateId === w.id ? "Saving..." : "Save as Template"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteTarget(w)}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mb-2">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                    {w.clientName}
                  </p>
                  <h3 className="text-sm font-semibold text-gray-900 truncate pr-8">
                    {w.workflowName}
                  </h3>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusCfg.className}`}
                  >
                    {statusCfg.label}
                  </span>
                  <span className="text-xs text-gray-400">{w.nodeCount} nodes</span>
                  {w.currentVersion && w.currentVersion > 0 && (
                    <span className="text-xs text-gray-400">· v{w.currentVersion}</span>
                  )}
                </div>

                {w.attention && (w.attention.openComments > 0 || w.attention.pendingSuggestions > 0 || w.attention.openRequests > 0) && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {w.attention.openComments > 0 && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800">{w.attention.openComments} open comment{w.attention.openComments === 1 ? "" : "s"}</span>}
                    {w.attention.pendingSuggestions > 0 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">{w.attention.pendingSuggestions} suggestion{w.attention.pendingSuggestions === 1 ? "" : "s"} waiting</span>}
                    {w.attention.openRequests > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">{w.attention.openRequests} access request{w.attention.openRequests === 1 ? "" : "s"}</span>}
                  </div>
                )}

                <p className="text-xs text-gray-500">
                  Edited{" "}
                  {formatDistanceToNow(new Date(w.updatedAt), { addSuffix: true })}
                </p>

                {latestFeedback && (
                  <p className="text-xs text-gray-400 mt-1 truncate">
                    {latestFeedback.action === "approved" ? "Approved" : "Changes requested"}{" "}
                    by {latestFeedback.reviewerName} &mdash;{" "}
                    {formatDistanceToNow(new Date(latestFeedback.createdAt), {
                      addSuffix: true,
                    })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        </section>
        ))}
        </div>
      )}

      {/* Modals */}
      <NewWorkflowModal
        open={newModalOpen}
        onOpenChange={handleNewModalClose}
        templateId={selectedTemplateId}
        templateName={selectedTemplateName}
      />
      <TemplatePickerModal
        open={templateModalOpen}
        onOpenChange={setTemplateModalOpen}
        onSelect={handleTemplateSelect}
      />

      <DeleteConfirmDialog
        isOpen={!!deleteTarget}
        isDeleting={deleting}
        itemName={deleteTarget?.workflowName ?? ""}
        onConfirm={handleDelete}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
