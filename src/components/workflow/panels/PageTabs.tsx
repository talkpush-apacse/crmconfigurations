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
    <div className="flex items-center gap-1 bg-white border-t border-gray-200 px-2 py-1.5 shrink-0 overflow-x-auto">
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
              "group flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs cursor-pointer transition-colors shrink-0 max-w-[200px]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-inset",
              isActive
                ? "bg-teal-100 border-teal-400 text-teal-900"
                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"
            )}
            title={isEditing ? undefined : `${page.name} — ${page.nodeCount} node${page.nodeCount === 1 ? "" : "s"}`}
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
                  className="bg-white border border-teal-300 rounded px-1.5 py-0.5 text-xs outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 max-w-[140px]"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    commitEdit();
                  }}
                  className="text-teal-600 hover:text-teal-800"
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
                  className="text-gray-400 hover:text-gray-600"
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
                <span className="text-[10px] text-gray-400 tabular-nums shrink-0">
                  {page.nodeCount}
                </span>
                {isActive && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(page);
                    }}
                    className="text-gray-400 hover:text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Rename page"
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
                      "transition-all rounded p-0.5",
                      isConfirming
                        ? "text-red-600 bg-red-50 scale-110 opacity-100"
                        : "text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"
                    )}
                    title={isConfirming ? "Click again to confirm delete" : "Delete page"}
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
        className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:text-teal-700 hover:border-teal-300 hover:bg-teal-50 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        title="Add new page"
      >
        <Plus className="w-3 h-3" />
        Add page
      </button>
    </div>
  );
}
