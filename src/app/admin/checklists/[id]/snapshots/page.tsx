"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useChecklistContext } from "@/lib/checklist-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Camera,
  Plus,
  RotateCcw,
  MoreHorizontal,
  Edit3,
  Archive,
  ArchiveRestore,
  Trash2,
  Pin,
  AlertTriangle,
  History,
  Loader2,
} from "lucide-react";
import type { SnapshotMetadata } from "@/lib/types";

type ToastState = { kind: "success" | "error"; message: string } | null;

function summaryString(s: SnapshotMetadata["summary"]): string {
  const parts: string[] = [];
  if (s.usersCount) parts.push(`${s.usersCount} users`);
  if (s.campaignsCount) parts.push(`${s.campaignsCount} campaigns`);
  if (s.foldersCount) parts.push(`${s.foldersCount} folders`);
  if (s.sourcesCount) parts.push(`${s.sourcesCount} sources`);
  if (s.documentsCount) parts.push(`${s.documentsCount} documents`);
  if (s.attributesCount) parts.push(`${s.attributesCount} attributes`);
  if (s.messagingCount) parts.push(`${s.messagingCount} templates`);
  if (s.prescreeningCount) parts.push(`${s.prescreeningCount} questions`);
  if (s.atsIntegrationsCount) parts.push(`${s.atsIntegrationsCount} ATS`);
  if (s.integrationsCount) parts.push(`${s.integrationsCount} integrations`);
  if (s.autoflowsCount) parts.push(`${s.autoflowsCount} autoflows`);
  return parts.length ? parts.join(" · ") : "Empty checklist state";
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SnapshotsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data } = useChecklistContext();
  const slug = data?.slug ?? "";

  const [snapshots, setSnapshots] = useState<SnapshotMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createLabel, setCreateLabel] = useState("");
  const [createDescription, setCreateDescription] = useState("");

  const [editTarget, setEditTarget] = useState<SnapshotMetadata | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [restoreTarget, setRestoreTarget] = useState<SnapshotMetadata | null>(null);
  const [restoreSlugInput, setRestoreSlugInput] = useState("");
  const [restoreRunning, setRestoreRunning] = useState(false);

  const [archiveTarget, setArchiveTarget] = useState<SnapshotMetadata | null>(null);
  const [archiveRunning, setArchiveRunning] = useState(false);

  const [hardDeleteTarget, setHardDeleteTarget] = useState<SnapshotMetadata | null>(null);
  const [hardDeleteInput, setHardDeleteInput] = useState("");
  const [hardDeleteRunning, setHardDeleteRunning] = useState(false);

  const [toast, setToast] = useState<ToastState>(null);

  const fetchSnapshots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/checklists/${id}/snapshots?includeArchived=${showArchived}`
      );
      if (!res.ok) throw new Error("Failed to load snapshots");
      const json = await res.json();
      setSnapshots(json.snapshots as SnapshotMetadata[]);
    } catch (err) {
      setToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to load snapshots",
      });
    } finally {
      setLoading(false);
    }
  }, [id, showArchived]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch(`/api/checklists/${id}/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: createLabel.trim() || null,
          description: createDescription.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create snapshot");
      }
      setCreateOpen(false);
      setCreateLabel("");
      setCreateDescription("");
      setToast({ kind: "success", message: "Snapshot created" });
      await fetchSnapshots();
    } catch (err) {
      setToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to create snapshot",
      });
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (snap: SnapshotMetadata) => {
    setEditTarget(snap);
    setEditLabel(snap.label ?? "");
    setEditDescription(snap.description ?? "");
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      const res = await fetch(
        `/api/checklists/${id}/snapshots/${editTarget.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: editLabel,
            description: editDescription,
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update snapshot");
      }
      setEditTarget(null);
      setToast({ kind: "success", message: "Snapshot updated" });
      await fetchSnapshots();
    } catch (err) {
      setToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to update snapshot",
      });
    } finally {
      setEditSaving(false);
    }
  };

  const handleArchiveToggle = async (snap: SnapshotMetadata) => {
    try {
      const res = await fetch(`/api/checklists/${id}/snapshots/${snap.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !snap.archived }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed");
      }
      setToast({
        kind: "success",
        message: snap.archived ? "Snapshot unarchived" : "Snapshot archived",
      });
      await fetchSnapshots();
    } catch (err) {
      setToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed",
      });
    }
  };

  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    setArchiveRunning(true);
    try {
      const res = await fetch(
        `/api/checklists/${id}/snapshots/${archiveTarget.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to archive");
      }
      setArchiveTarget(null);
      setToast({ kind: "success", message: "Snapshot archived" });
      await fetchSnapshots();
    } catch (err) {
      setToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to archive",
      });
    } finally {
      setArchiveRunning(false);
    }
  };

  const handleHardDelete = async () => {
    if (!hardDeleteTarget) return;
    setHardDeleteRunning(true);
    try {
      const res = await fetch(
        `/api/checklists/${id}/snapshots/${hardDeleteTarget.id}?mode=hard`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete");
      }
      setHardDeleteTarget(null);
      setHardDeleteInput("");
      setToast({ kind: "success", message: "Snapshot permanently deleted" });
      await fetchSnapshots();
    } catch (err) {
      setToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to delete",
      });
    } finally {
      setHardDeleteRunning(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget || !slug) return;
    if (restoreSlugInput.trim() !== slug) return;
    setRestoreRunning(true);
    try {
      const res = await fetch(
        `/api/checklists/${id}/snapshots/${restoreTarget.id}/restore`,
        { method: "POST" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Restore failed");
      }
      setRestoreTarget(null);
      setRestoreSlugInput("");
      setToast({
        kind: "success",
        message: "Snapshot restored. Reloading checklist…",
      });
      // Force a fresh load of the checklist (version bumped, all fields reset)
      setTimeout(() => {
        router.push(`/admin/checklists/${id}/welcome`);
        router.refresh();
      }, 600);
    } catch (err) {
      setToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Restore failed",
      });
    } finally {
      setRestoreRunning(false);
    }
  };

  const labeledCount = useMemo(
    () => snapshots.filter((s) => s.isLabeled && !s.archived).length,
    [snapshots]
  );
  const totalActive = useMemo(
    () => snapshots.filter((s) => !s.archived).length,
    [snapshots]
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-bold text-gray-900">Snapshots</h1>
          <p className="text-sm text-gray-500">
            Backup and restore the full checklist state. Useful before destructive
            changes like replacing the user list.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowArchived((v) => !v)}
            className="h-9"
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </Button>
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="h-9 gap-2 bg-[#1A73E8] hover:bg-[#1765cb]"
          >
            <Plus className="h-4 w-4" />
            New snapshot
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-500">
        <div className="flex flex-wrap items-center gap-3">
          <span>
            <span className="font-semibold tabular-nums text-gray-900">
              {totalActive}
            </span>{" "}
            active
          </span>
          <span className="text-gray-300">·</span>
          <span>
            <span className="font-semibold tabular-nums text-gray-900">
              {labeledCount}
            </span>{" "}
            labeled (sticky)
          </span>
          <span className="text-gray-300">·</span>
          <span>
            Auto-prune cap: <span className="font-semibold tabular-nums text-gray-900">20</span>{" "}
            (unlabeled only)
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-gray-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading snapshots…
        </div>
      ) : snapshots.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white py-16 text-center">
          <Camera className="mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm font-medium text-gray-700">No snapshots yet</p>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            Create one before any destructive change so you can roll back if it
            goes wrong.
          </p>
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="mt-4 gap-2 bg-[#1A73E8] hover:bg-[#1765cb]"
          >
            <Plus className="h-4 w-4" />
            Create first snapshot
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Label</th>
                <th className="px-4 py-3 hidden md:table-cell">Contents</th>
                <th className="px-4 py-3 hidden md:table-cell">Created</th>
                <th className="px-4 py-3">By</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snap) => {
                const isPreRestore = snap.label?.startsWith("Auto: pre-restore");
                return (
                  <tr
                    key={snap.id}
                    className={`border-t border-gray-100 ${snap.archived ? "bg-gray-50/50 text-gray-500" : ""}`}
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-start gap-2">
                        {snap.isLabeled && (
                          <Pin
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500"
                            aria-label="Labeled (sticky)"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {snap.label || (
                                <span className="italic text-gray-400">
                                  Untitled snapshot
                                </span>
                              )}
                            </span>
                            {isPreRestore && (
                              <Badge
                                variant="outline"
                                className="border-amber-200 bg-amber-50 text-[10px] text-amber-700"
                              >
                                pre-restore
                              </Badge>
                            )}
                            {snap.archived && (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-gray-500"
                              >
                                archived
                              </Badge>
                            )}
                          </div>
                          {snap.description && (
                            <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                              {snap.description}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-gray-400 md:hidden">
                            {summaryString(snap.summary)}
                          </p>
                          <p className="mt-0.5 text-[11px] text-gray-400 md:hidden">
                            {fmtDate(snap.createdAt)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 align-top text-xs text-gray-600 md:table-cell">
                      {summaryString(snap.summary)}
                    </td>
                    <td className="hidden px-4 py-3 align-top text-xs text-gray-500 md:table-cell tabular-nums">
                      {fmtDate(snap.createdAt)}
                      <div className="text-[11px] text-gray-400">
                        v{snap.versionAtSnapshot}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-gray-600">
                      {snap.createdByLabel ?? snap.createdBy}
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <div className="inline-flex items-center gap-1">
                        {!snap.archived && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRestoreTarget(snap);
                              setRestoreSlugInput("");
                            }}
                            className="h-8 gap-1.5 text-xs"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Restore
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              aria-label="More actions"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(snap)}>
                              <Edit3 className="h-4 w-4" />
                              Edit label / description
                            </DropdownMenuItem>
                            {snap.archived ? (
                              <DropdownMenuItem onClick={() => handleArchiveToggle(snap)}>
                                <ArchiveRestore className="h-4 w-4" />
                                Unarchive
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => setArchiveTarget(snap)}>
                                <Archive className="h-4 w-4" />
                                Archive (soft delete)
                              </DropdownMenuItem>
                            )}
                            {snap.archived && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-700"
                                  onClick={() => {
                                    setHardDeleteTarget(snap);
                                    setHardDeleteInput("");
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Permanently delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              New snapshot
            </DialogTitle>
            <DialogDescription>
              Captures the entire current checklist state — every tab, config flag,
              and configurator status. Strongly recommended to add a label.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="snap-label" className="text-sm font-medium text-gray-700">
                Label{" "}
                <span className="text-xs font-normal text-gray-500">
                  (recommended — labeled snapshots are never auto-pruned)
                </span>
              </Label>
              <Input
                id="snap-label"
                value={createLabel}
                onChange={(e) => setCreateLabel(e.target.value)}
                placeholder="e.g. Pre user-list replace - Nov 24"
                className="mt-1"
              />
            </div>
            <div>
              <Label
                htmlFor="snap-desc"
                className="text-sm font-medium text-gray-700"
              >
                Description{" "}
                <span className="text-xs font-normal text-gray-500">(optional)</span>
              </Label>
              <Textarea
                id="snap-desc"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="Why are you taking this snapshot?"
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating}
              className="bg-[#1A73E8] hover:bg-[#1765cb]"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                <>Create snapshot</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit snapshot</DialogTitle>
            <DialogDescription>
              Renaming a snapshot to add a label makes it sticky (never
              auto-pruned).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-label" className="text-sm font-medium text-gray-700">
                Label
              </Label>
              <Input
                id="edit-label"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label
                htmlFor="edit-desc"
                className="text-sm font-medium text-gray-700"
              >
                Description
              </Label>
              <Textarea
                id="edit-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditTarget(null)}
              disabled={editSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={editSaving}>
              {editSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore dialog with type-to-confirm */}
      <Dialog
        open={!!restoreTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRestoreTarget(null);
            setRestoreSlugInput("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Restore snapshot
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <span className="block">
                <strong className="text-gray-900">
                  {restoreTarget?.label || "Untitled snapshot"}
                </strong>{" "}
                · {restoreTarget && fmtDate(restoreTarget.createdAt)} · v
                {restoreTarget?.versionAtSnapshot}
              </span>
              <span className="block text-xs text-gray-600">
                Contents:{" "}
                {restoreTarget && summaryString(restoreTarget.summary)}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Restoring will <strong>replace the current state</strong> of this
            checklist. A pre-restore snapshot will be auto-created so you can
            undo. Any unsaved client edits will be discarded on next save.
          </div>
          <div>
            <Label
              htmlFor="restore-confirm"
              className="text-sm font-medium text-gray-700"
            >
              Type the checklist slug{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
                {slug}
              </code>{" "}
              to confirm:
            </Label>
            <Input
              id="restore-confirm"
              value={restoreSlugInput}
              onChange={(e) => setRestoreSlugInput(e.target.value)}
              placeholder={slug}
              className="mt-1 font-mono"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestoreTarget(null)}
              disabled={restoreRunning}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRestore}
              disabled={restoreRunning || restoreSlugInput.trim() !== slug || !slug}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {restoreRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Restoring…
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Restore now
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive confirmation */}
      <Dialog
        open={!!archiveTarget}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive snapshot</DialogTitle>
            <DialogDescription>
              The snapshot will be hidden from the active list but can be
              recovered or permanently deleted later.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-gray-700">
            <strong>{archiveTarget?.label || "Untitled snapshot"}</strong>
            {archiveTarget && (
              <>
                {" "}
                · {fmtDate(archiveTarget.createdAt)}
              </>
            )}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setArchiveTarget(null)}
              disabled={archiveRunning}
            >
              Cancel
            </Button>
            <Button onClick={handleArchiveConfirm} disabled={archiveRunning}>
              {archiveRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Archiving…
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4" />
                  Archive
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hard delete with type-to-confirm */}
      <Dialog
        open={!!hardDeleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setHardDeleteTarget(null);
            setHardDeleteInput("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="h-5 w-5" />
              Permanently delete snapshot
            </DialogTitle>
            <DialogDescription>
              This cannot be undone. The snapshot row will be removed from the
              database.
            </DialogDescription>
          </DialogHeader>
          {hardDeleteTarget && (
            <p className="text-sm text-gray-700">
              <strong>{hardDeleteTarget.label || "Untitled snapshot"}</strong> ·{" "}
              {fmtDate(hardDeleteTarget.createdAt)}
            </p>
          )}
          <div>
            <Label
              htmlFor="hard-delete-confirm"
              className="text-sm font-medium text-gray-700"
            >
              Type{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
                DELETE
              </code>{" "}
              to confirm:
            </Label>
            <Input
              id="hard-delete-confirm"
              value={hardDeleteInput}
              onChange={(e) => setHardDeleteInput(e.target.value)}
              className="mt-1 font-mono"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setHardDeleteTarget(null)}
              disabled={hardDeleteRunning}
            >
              Cancel
            </Button>
            <Button
              onClick={handleHardDelete}
              disabled={hardDeleteRunning || hardDeleteInput !== "DELETE"}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {hardDeleteRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete forever
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${
              toast.kind === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
