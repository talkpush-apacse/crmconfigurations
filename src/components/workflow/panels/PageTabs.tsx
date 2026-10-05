"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageTabsItem {
  id: string;
  name: string;
  nodeCount: number;
}

interface PageTabsProps {
  pages: PageTabsItem[];
  activePageId: string;
  onSwitch: (pageId: string) => void;
  onAdd: () => void;
  onRename: (pageId: string, name: string) => void;
  onDelete: (pageId: string) => void;
}

// Excel-style page tab bar that lives at the bottom of the workflow editor.
// Click a tab to switch, double-click to rename inline, hover to reveal the
// trash icon. Delete uses 2-click inline confirm (per CLAUDE.md UX patterns).
export default function PageTabs({
  pages,
  activePageId,
  onSwitch,
  onAdd,
  onRename,
  onDelete,
}: PageTabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-focus & select on edit
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  // Auto-clear pending delete confirm after 3s
  useEffect(() => {
    if (!confirmingId) return;
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => setConfirmingId(null), 3000);
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, [confirmingId]);

  function startEdit(page: PageTabsItem) {
    setEditingId(page.id);
    setDraftName(page.name);
  }

  function commitEdit() {
    if (editingId && draftName.trim()) {
      onRename(editingId, draftName.trim());
    }
    setEditingId(null);
    setDraftName("");
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftName("");
  }

  function handleDeleteClick(pageId: string) {
    if (pages.length <= 1) return;
    if (confirmingId === pageId) {
      onDelete(pageId);
      setConfirmingId(null);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    } else {
      setConfirmingId(pageId);
    }
  }

  return (
    <div className="flex items-center gap-1 bg-card border-t border-border px-2 py-1.5 shrink-0 overflow-x-auto">
      {pages.map((page) => {
        const isActive = page.id === activePageId;
        const isEditing = editingId === page.id;
        const isConfirming = confirmingId === page.id;

        return (
          <div
            key={page.id}
            role="button"
            tabIndex={0}
            onClick={() => {
              if (!isEditing) onSwitch(page.id);
            }}
            onDoubleClick={() => startEdit(page)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                if (!isEditing) {
                  e.preventDefault();
                  onSwitch(page.id);
                }
              }
            }}
            className={cn(
              "group flex min-h-11 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs cursor-pointer transition-colors shrink-0 max-w-[200px] md:min-h-0",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              isActive
                ? "bg-brand-lavender-lighter border-ring text-foreground"
                : "bg-card border-border text-foreground/70 hover:bg-secondary hover:border-input"
            )}
            title={isEditing ? undefined : `${page.name} (${page.nodeCount} node${page.nodeCount === 1 ? "" : "s"})`}
          >
            {isEditing ? (
              <>
                <input
                  ref={inputRef}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitEdit();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      cancelEdit();
                    }
                  }}
                  className="bg-card border border-brand-lavender rounded px-1.5 py-0.5 text-xs outline-none focus:ring-2 focus:ring-ring focus:border-ring max-w-[140px]"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    commitEdit();
                  }}
                  className="text-foreground hover:text-foreground"
                  title="Save"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    cancelEdit();
                  }}
                  className="text-muted-foreground hover:text-foreground/70"
                  title="Cancel"
                >
                  <X className="w-3 h-3" />
                </button>
              </>
            ) : (
              <>
                <span className={cn("truncate font-medium", isActive && "font-semibold")}>
                  {page.name}
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                  {page.nodeCount}
                </span>
                {isActive && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(page);
                    }}
                    className="flex min-h-11 min-w-11 items-center justify-center text-muted-foreground transition-opacity hover:text-foreground focus-visible:opacity-100 max-md:opacity-100 md:min-h-0 md:min-w-0 md:opacity-0 md:group-hover:opacity-100"
                    title="Rename page"
                    aria-label={`Rename ${page.name}`}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
                {pages.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(page.id);
                    }}
                    className={cn(
                      "flex min-h-11 min-w-11 items-center justify-center rounded p-0.5 transition-all md:min-h-0 md:min-w-0",
                      isConfirming
                        ? "text-destructive bg-destructive/10 scale-110 opacity-100"
                        : "text-muted-foreground hover:text-destructive focus-visible:opacity-100 max-md:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                    )}
                    title={isConfirming ? "Click again to confirm delete" : "Delete page"}
                    aria-label={isConfirming ? `Confirm delete ${page.name}` : `Delete ${page.name}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={onAdd}
        className="flex min-h-11 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground md:min-h-0 hover:text-foreground hover:border-brand-lavender hover:bg-brand-lavender-lightest transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title="Add new page"
      >
        <Plus className="w-3 h-3" aria-hidden="true" />
        Add page
      </button>
    </div>
  );
}
