"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Plus,
  ExternalLink,
  Trash2,
  Copy,
  Download,
  Settings,
  Search,
  CheckCircle,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Link2,
  RefreshCw,
  Mail,
} from "lucide-react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { SettingsDialog } from "@/components/admin/SettingsDialog";
import { getAllSelectableTabSlugs } from "@/lib/tab-config";
import { defaultCommunicationChannels, defaultFeatureToggles } from "@/lib/template-data";
import type { CommunicationChannels, FeatureToggles, CustomFieldDef, CustomTab } from "@/lib/types";
import changelog from "../../../CHANGELOG.json";

// P4-06: Show search only when there are enough rows to warrant it
const SEARCH_THRESHOLD = 8;

const APP_VERSION = (changelog as { version: string }[])[0]?.version ?? "1.0.0";

// P2-03: Lightweight relative time — no date-fns required
function formatRelativeTime(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) { const m = Math.floor(diff / 60); return `${m}m ago`; }
  if (diff < 86400) { const h = Math.floor(diff / 3600); return `${h}h ago`; }
  if (diff < 86400 * 7) { const d = Math.floor(diff / 86400); return `${d}d ago`; }
  if (diff < 86400 * 30) { const w = Math.floor(diff / (86400 * 7)); return `${w}w ago`; }
  if (diff < 86400 * 365) { const mo = Math.floor(diff / (86400 * 30)); return `${mo}mo ago`; }
  return `${Math.floor(diff / (86400 * 365))}y ago`;
}

function formatFullDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface ChecklistSummary {
  id: string;
  slug: string;
  editorToken: string;
  clientName: string;
  ownerEmail: string | null;
  createdAt: string;
  updatedAt: string;
  enabledTabs: string[] | null;
  communicationChannels: CommunicationChannels | null;
  version: number;
  featureToggles: FeatureToggles | null;
  configuratorChecklist: unknown | null;
  isCustom?: boolean;
  customSchema?: CustomFieldDef[] | null;
  customTabs?: CustomTab[] | null;
}

interface EditingState {
  id: string;
  clientName: string;
  ownerEmail: string;
  tabs: string[];
  channels: CommunicationChannels;
  featureToggles: FeatureToggles;
  version: number;
  isCustom: boolean;
  customSchema: CustomFieldDef[];
  customTabs: CustomTab[];
}

interface PendingDelete {
  item: ChecklistSummary;
  timer: ReturnType<typeof setTimeout>;
}

type SortKey = "clientName" | "createdAt" | "updatedAt";
type SortDir = "asc" | "desc";

// P4-02: Sortable column header button
function SortHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey | null;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = currentKey === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
    >
      {label}
      {active ? (
        currentDir === "asc" ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )
      ) : (
        <ChevronsUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [checklists, setChecklists] = useState<ChecklistSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [saving, setSaving] = useState(false);
  // P1-01: Dialog-based delete — replaces inline deletingId pattern
  const [deleteTarget, setDeleteTarget] = useState<ChecklistSummary | null>(null);
  // Confirmation state for token regeneration
  const [regenTarget, setRegenTarget] = useState<ChecklistSummary | null>(null);
  // P4-05: Optimistic delete with 5s undo window
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  // P4-02: Sort state
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  // Editor link copy feedback
  const [editorLinkCopied, setEditorLinkCopied] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Admin Dashboard | Talkpush CRM";
  }, []);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (pendingDelete) clearTimeout(pendingDelete.timer);
    };
  }, [pendingDelete]);

  // P4-06: Clear stale search when rows drop below threshold
  useEffect(() => {
    if (checklists.length < SEARCH_THRESHOLD) setSearchQuery("");
  }, [checklists.length]);

  const fetchChecklists = async (page = currentPage) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/checklists?page=${page}`);
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load checklists");
        setChecklists([]);
        return;
      }
      if (!data.items || !Array.isArray(data.items)) {
        setError("Unexpected response from server");
        setChecklists([]);
        return;
      }
      setError("");
      setChecklists(data.items);
      setTotal(data.total ?? 0);
      setCurrentPage(page);
    } catch {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChecklists(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // P1-01 + P4-05: Close dialog and defer actual API call by 5s (undo-able)
  const handleConfirmDelete = (c: ChecklistSummary) => {
    setDeleteTarget(null);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/checklists/${c.id}`, { method: "DELETE" });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || "Delete failed");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to delete checklist";
        setOperationError(msg);
        setTimeout(() => setOperationError(null), 5000);
      } finally {
        setPendingDelete(null);
        // Refetch current page; if it's now empty and not page 1, go back one page
        const newPage = checklists.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
        fetchChecklists(newPage);
      }
    }, 5000);
    setPendingDelete({ item: c, timer });
  };

  // P4-05: Cancel the pending delete within the grace period
  const handleUndo = () => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timer);
    setPendingDelete(null);
  };

  const handleCopy = async (id: string) => {
    try {
      // 1. Fetch the full source checklist (auth-protected endpoint)
      const res = await fetch(`/api/checklists/${id}`);
      if (!res.ok) throw new Error("Failed to fetch source checklist");
      const original = await res.json() as Record<string, unknown>;

      // 2. Create the new record (config skeleton)
      const newName = `${original.clientName} (Copy)`;
      const createBody: Record<string, unknown> = { clientName: newName };
      createBody.ownerEmail = original.ownerEmail ?? null;
      if (original.isCustom) {
        createBody.isCustom = true;
        createBody.customSchema = original.customSchema;
      } else {
        createBody.enabledTabs = original.enabledTabs;
        createBody.communicationChannels = original.communicationChannels;
        createBody.featureToggles = original.featureToggles;
        if (original.customTabs) createBody.customTabs = original.customTabs;
      }
      const createRes = await fetch("/api/checklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createBody),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to create copy");
      }
      const created = await createRes.json() as { id: string; slug: string; version: number };

      // 3. PUT all content data from original into the new record (whole-document path)
      // Without this step every content section would be empty defaults.
      const contentBody: Record<string, unknown> = {
        version: created.version,
        enabledTabs: original.enabledTabs,
        tabOrder: original.tabOrder,
        tabFilledBy: original.tabFilledBy,
        communicationChannels: original.communicationChannels,
        featureToggles: original.featureToggles,
        companyInfo: original.companyInfo,
        users: original.users,
        campaigns: original.campaigns,
        sites: original.sites,
        prescreening: original.prescreening,
        messaging: original.messaging,
        sources: original.sources,
        folders: original.folders,
        documents: original.documents,
        attributes: original.attributes,
        fbWhatsapp: original.fbWhatsapp,
        instagram: original.instagram,
        aiCallFaqs: original.aiCallFaqs,
        agencyPortal: original.agencyPortal,
        agencyPortalUsers: original.agencyPortalUsers,
        rejectionReasons: original.rejectionReasons,
        labels: original.labels,
        adminSettings: original.adminSettings,
        atsIntegrations: original.atsIntegrations,
        tabUploadMeta: original.tabUploadMeta,
        customSchema: original.customSchema,
        customData: original.customData,
        customTabs: original.customTabs,
      };
      const putRes = await fetch(`/api/checklists/${created.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contentBody),
      });
      if (!putRes.ok) {
        const err = await putRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to copy content data");
      }

      fetchChecklists(currentPage);
      setCopySuccess(`Checklist duplicated: ${created.slug || newName}`);
      setTimeout(() => setCopySuccess(null), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to copy checklist";
      setOperationError(msg);
      setTimeout(() => setOperationError(null), 5000);
    }
  };

  const handleEditSettings = (c: ChecklistSummary) => {
    setEditing({
      id: c.id,
      clientName: c.clientName,
      ownerEmail: c.ownerEmail ?? "",
      tabs: c.enabledTabs || getAllSelectableTabSlugs(),
      channels: (c.communicationChannels as CommunicationChannels) || defaultCommunicationChannels,
      featureToggles: (c.featureToggles as FeatureToggles) || defaultFeatureToggles,
      version: c.version,
      isCustom: !!c.isCustom,
      customSchema: (c.customSchema as CustomFieldDef[]) || [],
      customTabs: (c.customTabs as CustomTab[]) || [],
    });
  };

  const handleEditChannelsChange = useCallback((newChannels: CommunicationChannels) => {
    setEditing((prev) => {
      if (!prev) return prev;
      let newTabs = [...prev.tabs];
      if (newChannels.aiCalls && !newTabs.includes("ai-call-faqs")) {
        newTabs = [...newTabs, "ai-call-faqs"];
      } else if (!newChannels.aiCalls && newTabs.includes("ai-call-faqs")) {
        newTabs = newTabs.filter((t) => t !== "ai-call-faqs");
      }
      return { ...prev, channels: newChannels, tabs: newTabs };
    });
  }, []);

  const handleEditTabsChange = useCallback((newTabs: string[]) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const aiTabEnabled = newTabs.includes("ai-call-faqs");
      const newChannels =
        aiTabEnabled !== prev.channels.aiCalls
          ? { ...prev.channels, aiCalls: aiTabEnabled }
          : prev.channels;
      return { ...prev, tabs: newTabs, channels: newChannels };
    });
  }, []);

  const handleSaveSettings = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        version: editing.version,
        ownerEmail: editing.ownerEmail.trim() || null,
        changedFields: editing.isCustom
          ? ["customSchema"]
          : ["enabledTabs", "communicationChannels", "featureToggles", "customTabs"],
      };
      if (editing.isCustom) {
        body.customSchema = editing.customSchema;
      } else {
        body.enabledTabs = editing.tabs;
        body.communicationChannels = editing.channels;
        body.featureToggles = editing.featureToggles;
        body.customTabs = editing.customTabs;
      }
      const res = await fetch(`/api/checklists/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        const msg = (err as { error?: string }).error || "Failed to save settings";
        setOperationError(msg);
        setTimeout(() => setOperationError(null), 5000);
        return;
      }
      setEditing(null);
      fetchChecklists(currentPage);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save settings";
      setOperationError(msg);
      setTimeout(() => setOperationError(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyEditorLink = async (c: ChecklistSummary) => {
    const url = `${window.location.origin}/editor/${c.editorToken}/welcome`;
    await navigator.clipboard.writeText(url);
    setEditorLinkCopied(c.id);
    setTimeout(() => setEditorLinkCopied(null), 2000);
  };

  const handleRegenerateToken = (c: ChecklistSummary) => {
    setRegenTarget(c);
  };

  const handleConfirmRegenToken = async () => {
    if (!regenTarget) return;
    const c = regenTarget;
    setRegenTarget(null);
    try {
      const res = await fetch(`/api/checklists/${c.id}/regenerate-token`, { method: "POST" });
      if (!res.ok) throw new Error("Token regeneration failed");
      fetchChecklists(currentPage);
      setCopySuccess(`Editor link regenerated for ${c.clientName}`);
      setTimeout(() => setCopySuccess(null), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to regenerate token";
      setOperationError(msg);
      setTimeout(() => setOperationError(null), 5000);
    }
  };

  // P4-02: Toggle sort key/direction
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // P4-02 + P4-05: Filtered, sorted, and pending-delete-excluded list
  const displayed = useMemo(() => {
    let list = checklists;

    // Optimistically hide the item during the 5s undo window
    if (pendingDelete) {
      list = list.filter((c) => c.id !== pendingDelete.item.id);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.clientName.toLowerCase().includes(q) ||
          c.slug.toLowerCase().includes(q)
      );
    }

    if (sortKey) {
      list = [...list].sort((a, b) => {
        if (sortKey === "clientName") {
          return sortDir === "asc"
            ? a.clientName.localeCompare(b.clientName)
            : b.clientName.localeCompare(a.clientName);
        }
        const aTime = new Date(a[sortKey]).getTime();
        const bTime = new Date(b[sortKey]).getTime();
        return sortDir === "asc" ? aTime - bTime : bTime - aTime;
      });
    }

    return list;
  }, [checklists, pendingDelete, searchQuery, sortKey, sortDir]);

  return (
    <div className="flex min-h-screen flex-col">
      {/* P2-01: Sticky app shell header */}
      <AdminHeader />

      <div className="flex flex-1 overflow-hidden">
        {/* P4-03: Collapsible sidebar, desktop only */}
        <AdminSidebar />

        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="mx-auto max-w-5xl p-6">

            {/* P3-05: Larger title with more breathing room */}
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">CRM Config Checklists</h1>
                <p className="text-sm text-muted-foreground">
                  Manage client configuration checklists
                </p>
              </div>
              <Link href="/admin/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Checklist
                </Button>
              </Link>
            </div>

            {/* P1-01: Proper delete confirmation dialog */}
            <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete checklist?</DialogTitle>
                  <DialogDescription>
                    Delete <strong>{deleteTarget?.clientName}</strong>&apos;s checklist?
                    This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => deleteTarget && handleConfirmDelete(deleteTarget)}
                  >
                    Delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Edit Settings Dialog */}
            <SettingsDialog
              editing={editing}
              saving={saving}
              onClose={() => setEditing(null)}
              onSave={handleSaveSettings}
              onChannelsChange={handleEditChannelsChange}
              onTabsChange={handleEditTabsChange}
              onFeatureTogglesChange={(toggles) =>
                setEditing((prev) => prev ? { ...prev, featureToggles: toggles } : prev)
              }
              onOwnerEmailChange={(ownerEmail) =>
                setEditing((prev) => prev ? { ...prev, ownerEmail } : prev)
              }
              onCustomSchemaChange={(schema) =>
                setEditing((prev) => prev ? { ...prev, customSchema: schema } : prev)
              }
              onCustomTabsChange={(tabs) =>
                setEditing((prev) => prev ? { ...prev, customTabs: tabs } : prev)
              }
            />

            {/* Regen token confirmation dialog */}
            <Dialog open={!!regenTarget} onOpenChange={() => setRegenTarget(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Regenerate editor link?</DialogTitle>
                  <DialogDescription>
                    This will invalidate the current editor link for <strong>{regenTarget?.clientName}</strong>. Anyone using the old link will lose access immediately.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRegenTarget(null)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleConfirmRegenToken}>
                    Regenerate
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Operation success notification */}
            {copySuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <p className="text-sm text-green-700">
                  <span className="font-medium">{copySuccess}</span>
                </p>
              </div>
            )}

            {/* Operation error notification */}
            {operationError && (
              <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                <p className="text-sm text-destructive">{operationError}</p>
              </div>
            )}

            {/* P4-05: Undo notification during the 5s delete grace period */}
            {pendingDelete && (
              <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 shrink-0 text-orange-600" />
                  <p className="text-sm text-orange-700">
                    <strong>{pendingDelete.item.clientName}</strong>&apos;s checklist will be
                    deleted in 5 seconds.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleUndo} className="shrink-0">
                  Undo
                </Button>
              </div>
            )}

            {/* P3-04: Upgraded to shadow-md */}
            <Card className="shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="text-base">
                    All Checklists ({total})
                  </CardTitle>

                  {/* P2-07 + P4-06: sr-only label; shown only at threshold */}
                  {checklists.length >= SEARCH_THRESHOLD && (
                    <div className="relative w-64">
                      <label htmlFor="checklist-search" className="sr-only">
                        Search checklists
                      </label>
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="checklist-search"
                        placeholder="Search clients..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-9 border-input pl-8"
                      />
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                {error && (
                  <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                {loading ? (
                  // Animated skeleton loader
                  <div className="space-y-3 py-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
                    ))}
                  </div>
                ) : checklists.length === 0 ? (
                  // P4-01: Empty state — no checklists exist yet
                  <div className="py-12 text-center">
                    <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                    <p className="font-medium text-muted-foreground">No checklists yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Create your first client checklist to get started.
                    </p>
                    <Link href="/admin/new">
                      <Button variant="outline" className="mt-4">
                        Create first checklist
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {/* P2-06: Uppercase, small, spaced column headers */}
                        <TableHead className="py-2">
                          <SortHeader
                            label="Client"
                            sortKey="clientName"
                            currentKey={sortKey}
                            currentDir={sortDir}
                            onSort={handleSort}
                          />
                        </TableHead>
                        {/* P2-04: Status column — TODO: wire to actual completion data */}
                        <TableHead className="py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Status
                        </TableHead>
                        <TableHead className="py-2">
                          <SortHeader
                            label="Created"
                            sortKey="createdAt"
                            currentKey={sortKey}
                            currentDir={sortDir}
                            onSort={handleSort}
                          />
                        </TableHead>
                        <TableHead className="py-2">
                          <SortHeader
                            label="Updated"
                            sortKey="updatedAt"
                            currentKey={sortKey}
                            currentDir={sortDir}
                            onSort={handleSort}
                          />
                        </TableHead>
                        <TableHead className="py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {displayed.length === 0 ? (
                        // P4-01: Empty state when search returns no results
                        <TableRow>
                          <TableCell colSpan={5} className="py-12 text-center">
                            <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                            <p className="text-sm font-medium text-muted-foreground">
                              No results for &ldquo;{searchQuery}&rdquo;
                            </p>
                            <button
                              type="button"
                              className="mt-2 text-sm text-primary underline-offset-2 hover:underline"
                              onClick={() => setSearchQuery("")}
                            >
                              Clear search
                            </button>
                          </TableCell>
                        </TableRow>
                      ) : (
                        displayed.map((c) => (
                          // P2-02 + P4-04: Clickable row with smooth hover transition
                          <TableRow
                            key={c.id}
                            className="cursor-pointer transition-colors duration-100 hover:bg-muted/50"
                            onClick={() => router.push(`/admin/checklists/${c.id}/welcome`)}
                          >
                            {/* P1-03 + P3-02: Teal link + slug as secondary line, no separate slug column */}
                            <TableCell className="py-2 font-medium">
                              <span className="flex items-center gap-1.5">
                                <Link
                                  href={`/admin/checklists/${c.id}/welcome`}
                                  target="_blank"
                                  className="text-teal-700 transition-colors hover:text-teal-900 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {c.clientName}
                                </Link>
                                {c.isCustom && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium text-violet-600 border-violet-300">
                                    Custom
                                  </Badge>
                                )}
                                {c.ownerEmail && (
                                  <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 font-medium text-emerald-700 border-emerald-300">
                                    <Mail className="h-3 w-3" />
                                    Owner email
                                  </Badge>
                                )}
                              </span>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {c.slug}
                              </p>
                            </TableCell>

                            {/* P2-04: Status placeholder — TODO: wire to actual completion data */}
                            <TableCell className="py-2">
                              <Badge variant="outline" className="text-muted-foreground">
                                —
                              </Badge>
                            </TableCell>

                            {/* P2-03: Relative timestamps with full date in tooltip */}
                            <TableCell className="py-2 text-muted-foreground">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-default text-sm">
                                    {formatRelativeTime(c.createdAt)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="text-xs">
                                  {formatFullDate(c.createdAt)}
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>

                            <TableCell className="py-2 text-muted-foreground">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-default text-sm">
                                    {formatRelativeTime(c.updatedAt)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="text-xs">
                                  {formatFullDate(c.updatedAt)}
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>

                            {/* P2-02: stopPropagation prevents row-click when using action buttons */}
                            <TableCell
                              className="py-2 text-right"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* P2-05: Separator between safe actions and destructive delete */}
                              <div className="flex items-center justify-end gap-1">
                                {/* Copy Editor Link */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label={`Copy editor link for ${c.clientName}`}
                                      onClick={() => handleCopyEditorLink(c)}
                                    >
                                      {editorLinkCopied === c.id ? (
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <Link2 className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {editorLinkCopied === c.id ? "Copied!" : "Copy editor link"}
                                  </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Link href={`/admin/${c.slug}/configurator`}>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`${c.configuratorChecklist ? "View" : "Generate"} configurator checklist for ${c.clientName}`}
                                      >
                                        <FileText className="h-4 w-4" />
                                      </Button>
                                    </Link>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {c.configuratorChecklist
                                      ? "View Configurator's Checklist"
                                      : "Generate Configurator's Checklist"}
                                  </TooltipContent>
                                </Tooltip>

                                {/* P1-02: aria-label on every icon button */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Link href={`/admin/checklists/${c.id}/welcome`} target="_blank">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Open ${c.clientName} checklist`}
                                      >
                                        <ExternalLink className="h-4 w-4" />
                                      </Button>
                                    </Link>
                                  </TooltipTrigger>
                                  <TooltipContent>Open checklist</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <a
                                      href={`/api/export/${c.slug}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Export ${c.clientName} checklist`}
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                    </a>
                                  </TooltipTrigger>
                                  <TooltipContent>Export to XLS</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label={`Configure ${c.clientName}`}
                                      onClick={() => handleEditSettings(c)}
                                    >
                                      <Settings className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Configure</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label={`Duplicate ${c.clientName} checklist`}
                                      onClick={() => handleCopy(c.id)}
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Duplicate</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label={`Regenerate editor link for ${c.clientName}`}
                                      onClick={() => handleRegenerateToken(c)}
                                    >
                                      <RefreshCw className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Regenerate editor link</TooltipContent>
                                </Tooltip>

                                <Separator orientation="vertical" className="mx-1 h-5" />

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label={`Delete ${c.clientName} checklist`}
                                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                      onClick={() => setDeleteTarget(c)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete</TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* P3-03: Footer with pagination and app version */}
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {searchQuery
                  ? `${displayed.length} result${displayed.length !== 1 ? "s" : ""} on this page`
                  : `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, total)} of ${total} checklist${total !== 1 ? "s" : ""}`
                }
              </span>
              <div className="flex items-center gap-3">
                {total > pageSize && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={currentPage <= 1 || loading}
                      onClick={() => { setSearchQuery(""); fetchChecklists(currentPage - 1); }}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="tabular-nums">
                      {currentPage} / {Math.ceil(total / pageSize)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={currentPage >= Math.ceil(total / pageSize) || loading}
                      onClick={() => { setSearchQuery(""); fetchChecklists(currentPage + 1); }}
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
                <span>Talkpush CRM Config · v{APP_VERSION}</span>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
