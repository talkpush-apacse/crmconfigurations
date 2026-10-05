"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, LayoutTemplate, Trash2 } from "lucide-react";
import { toast } from "@/components/workflow/ui/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Template {
  id: string;
  name: string;
  description: string | null;
  industry: string;
  nodeCount: number;
}

const INDUSTRY_TABS = [
  { value: "all", label: "All" },
  { value: "bpo", label: "BPO" },
  { value: "retail", label: "Retail" },
  { value: "general", label: "General" },
];

interface TemplatePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (templateId: string, templateName: string) => void;
}

export default function TemplatePickerModal({
  open,
  onOpenChange,
  onSelect,
}: TemplatePickerModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [industry, setIndustry] = useState("all");

  // 2-click inline confirm delete: first click arms it (red), second click fires
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const deleteTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (industry !== "all") params.set("industry", industry);
      const res = await fetch(`/api/workflows/templates?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.items);
      }
    } finally {
      setLoading(false);
    }
  }, [industry]);

  useEffect(() => {
    if (open) fetchTemplates();
  }, [open, fetchTemplates]);

  // Reset confirm state when modal closes
  useEffect(() => {
    if (!open) {
      setConfirmingDeleteId(null);
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    }
  }, [open]);

  function handleDeleteClick(e: React.MouseEvent, templateId: string) {
    e.stopPropagation();

    if (confirmingDeleteId === templateId) {
      // Second click — execute delete
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      setConfirmingDeleteId(null);
      executeDelete(templateId);
    } else {
      // First click — arm confirm state, auto-reset after 3s
      setConfirmingDeleteId(templateId);
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = setTimeout(() => {
        setConfirmingDeleteId(null);
      }, 3000);
    }
  }

  async function executeDelete(templateId: string) {
    try {
      const res = await fetch(`/api/workflows/templates/${templateId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== templateId));
        toast.success("Template deleted");
      } else {
        toast.error("Failed to delete template");
      }
    } catch {
      toast.error("Failed to delete template");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start from template</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 mb-4">
          {INDUSTRY_TABS.map((tab) => (
            <Button
              key={tab.value}
              variant={industry === tab.value ? "cta" : "outline"}
              size="sm"
              onClick={() => setIndustry(tab.value)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12">
            <LayoutTemplate className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No templates found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {templates.map((t) => {
              const isConfirming = confirmingDeleteId === t.id;
              return (
                <div key={t.id} className="relative group">
                  <button
                    onClick={() => {
                      onSelect(t.id, t.name);
                      onOpenChange(false);
                    }}
                    className="w-full text-left border border-border rounded-lg p-4 hover:border-brand-lavender hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between mb-2 pr-6">
                      <span className="text-sm font-medium text-foreground group-hover:text-foreground">
                        {t.name}
                      </span>
                      <span className="text-[11px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                        {t.industry}
                      </span>
                    </div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {t.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t.nodeCount} nodes
                    </p>
                  </button>

                  {/* Delete button — hover-reveal, 2-click confirm */}
                  <button
                    onClick={(e) => handleDeleteClick(e, t.id)}
                    title={isConfirming ? "Click again to confirm delete" : "Delete template"}
                    className={`absolute top-2.5 right-2.5 w-6 h-6 flex items-center justify-center rounded transition-all ${
                      isConfirming
                        ? "opacity-100 text-destructive scale-110"
                        : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
