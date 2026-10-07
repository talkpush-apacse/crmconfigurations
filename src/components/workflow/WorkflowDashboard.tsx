"use client";

import { useCurrentUser } from "@/lib/use-current-user";
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
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/workflow/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WorkflowStatus } from "@/lib/workflow/types";
import { statusStyle } from "./status-style";
import DeleteConfirmDialog from "@/components/workflow/ui/DeleteConfirmDialog";
import { useDebouncedSearch } from "@/components/workflow/ui/useDebouncedSearch";
import NewWorkflowModal from "./modals/NewWorkflowModal";
import TemplatePickerModal from "./modals/TemplatePickerModal";

interface WorkflowItem {
  id: string;
  clientName: string;
  /** The company this workflow is filed under, if any. */
  accountId?: string | null;
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
  { value: "changes_requested", label: "Changes requested" },
];

export default function WorkflowDashboard() {
  const { canEdit } = useCurrentUser();
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
            // A copy stays under the same company.
            accountId: workflow.accountId ?? undefined,
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
          name: `${workflow.clientName}: ${workflow.workflowName}`,
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
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Workflow builder</h1>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button
              variant="outline"
              onClick={() => setTemplateModalOpen(true)}
              className="min-h-11 md:min-h-9"
            >
              <LayoutTemplate className="h-4 w-4" />
              Start from template
            </Button>
          )}
          {canEdit && (
            <Button
              onClick={() => setNewModalOpen(true)}
              className="min-h-11 md:min-h-9"
            >
              <Plus className="h-4 w-4" />
              New workflow
            </Button>
          )}
        </div>
      </div>

      {/* Search + Status filter */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <div className="relative w-full md:min-w-[14rem] md:max-w-sm md:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search workflows..."
            aria-label="Search workflows"
            className="min-h-11 pl-9 md:min-h-9"
          />
        </div>
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1">
          {STATUS_TABS.map((tab) => (
            <Button
              key={tab.value}
              variant={statusFilter === tab.value ? "default" : "ghost"}
              size="sm"
              aria-pressed={statusFilter === tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn("min-h-11 md:min-h-8", statusFilter === tab.value ? undefined : "text-muted-foreground")}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        <label className="flex min-h-11 items-center gap-2 text-xs text-foreground/70 md:min-h-0">
          <input type="checkbox" checked={groupByClient} onChange={(e) => setGroupByClient(e.target.checked)} />
          Group by client
        </label>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-lg border border-border bg-card p-5">
              <Skeleton className="h-4 w-32 animate-pulse" />
              <Skeleton className="h-5 w-48 animate-pulse" />
              <Skeleton className="h-3 w-24 animate-pulse" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-20">
          <Workflow className="mx-auto mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-base font-medium text-foreground mb-1">
            {searchInput || statusFilter !== "all"
              ? "No workflows match your filters"
              : "No workflows yet"}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {searchInput || statusFilter !== "all"
              ? "Try a different search or clear filters"
              : "Create your first workflow to get started"}
          </p>
          {canEdit && !searchInput && statusFilter === "all" && (
            <Button
              onClick={() => setNewModalOpen(true)}
              className="min-h-11 md:min-h-9"
            >
              <Plus className="h-4 w-4" />
              New workflow
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
        {sections.map(([clientName, list]) => (
        <section key={clientName ?? "all"} aria-label={clientName ?? "Workflows"}>
        {clientName && <h2 className="mb-2 text-sm font-semibold text-foreground/85">{clientName} <span className="font-normal text-muted-foreground">· {list.length}</span></h2>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((w) => {
            const statusCfg = statusStyle(w.status);
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
                className="group relative cursor-pointer rounded-lg border border-border bg-card p-5 transition-all hover:border-input hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                {/* Three-dot menu */}
                <div
                  className="absolute right-2 top-2 md:right-3 md:top-3"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
{canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`More actions for ${w.workflowName}`}
                        className="h-11 w-11 p-0 transition-opacity data-[state=open]:opacity-100 md:h-7 md:w-7 md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
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
                        {savingTemplateId === w.id ? "Saving..." : "Save as template"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteTarget(w)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
)}
                </div>

                <div className="mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {w.clientName}
                  </p>
                  <h3 className="truncate pr-12 text-sm font-semibold text-foreground md:pr-8">
                    {w.workflowName}
                  </h3>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusCfg.className}`}
                  >
                    {statusCfg.label}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{w.nodeCount} {w.nodeCount === 1 ? "node" : "nodes"}</span>
                  {(w.currentVersion ?? 0) > 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums">· v{w.currentVersion}</span>
                  )}
                </div>

                {w.attention && (w.attention.openComments > 0 || w.attention.pendingSuggestions > 0 || w.attention.openRequests > 0) && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {w.attention.openComments > 0 && <span className="rounded-full bg-brand-lavender-lighter px-2 py-0.5 text-[11px] font-medium text-foreground">{w.attention.openComments} open comment{w.attention.openComments === 1 ? "" : "s"}</span>}
                    {w.attention.pendingSuggestions > 0 && <span className="rounded-full bg-brand-sage/25 px-2 py-0.5 text-[11px] font-medium text-foreground">{w.attention.pendingSuggestions} suggestion{w.attention.pendingSuggestions === 1 ? "" : "s"} waiting</span>}
                    {w.attention.openRequests > 0 && <span className="rounded-full bg-brand-amber/25 px-2 py-0.5 text-[11px] font-medium text-foreground">{w.attention.openRequests} access request{w.attention.openRequests === 1 ? "" : "s"}</span>}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Edited{" "}
                  {formatDistanceToNow(new Date(w.updatedAt), { addSuffix: true })}
                </p>

                {latestFeedback && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {latestFeedback.action === "approved" ? "Approved" : "Changes requested"}{" "}
                    by {latestFeedback.reviewerName},{" "}
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
