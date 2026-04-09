"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, FileText } from "lucide-react";
import { CustomFieldBuilder } from "./CustomFieldBuilder";
import type { CustomTab, CustomFieldDef } from "@/lib/types";

interface CustomTabManagerProps {
  value: CustomTab[];
  onChange: (tabs: CustomTab[]) => void;
}

interface TabFormState {
  label: string;
  icon: string;
  fields: CustomFieldDef[];
}

const emptyForm: TabFormState = {
  label: "",
  icon: "FileText",
  fields: [],
};

function generateSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CustomTabManager({ value, onChange }: CustomTabManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form, setForm] = useState<TabFormState>(emptyForm);

  const openAdd = () => {
    setForm(emptyForm);
    setEditingIndex(null);
    setDialogOpen(true);
  };

  const openEdit = (index: number) => {
    const tab = value[index];
    setForm({
      label: tab.label,
      icon: tab.icon || "FileText",
      fields: tab.fields || [],
    });
    setEditingIndex(index);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.label.trim()) return;

    const tab: CustomTab = {
      id: editingIndex !== null ? value[editingIndex].id : crypto.randomUUID(),
      slug: editingIndex !== null ? value[editingIndex].slug : generateSlug(form.label),
      label: form.label.trim(),
      icon: form.icon || "FileText",
      fields: form.fields,
    };

    if (editingIndex !== null) {
      const updated = [...value];
      updated[editingIndex] = tab;
      onChange(updated);
    } else {
      onChange([...value, tab]);
    }
    setDialogOpen(false);
  };

  const handleDelete = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...value];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    onChange(updated);
  };

  const moveDown = (index: number) => {
    if (index === value.length - 1) return;
    const updated = [...value];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Custom Tabs</Label>
        <span className="text-xs text-muted-foreground">
          {value.length} tab{value.length !== 1 ? "s" : ""}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Add extra tabs with custom fields alongside the standard CRM tabs.
      </p>

      {value.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <p className="text-sm text-muted-foreground">
            No custom tabs yet. Add one to extend this checklist.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {value.map((tab, index) => (
            <div
              key={tab.id}
              className="flex items-center gap-2 rounded-lg border bg-white p-3"
            >
              <div className="flex flex-col gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => moveDown(index)}
                  disabled={index === value.length - 1}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>

              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />

              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium truncate block">
                  {tab.label}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="outline" className="text-xs">
                    {tab.fields.length} field{tab.fields.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => openEdit(index)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                onClick={() => handleDelete(index)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" className="w-full" onClick={openAdd}>
        <Plus className="mr-2 h-4 w-4" />
        Add Custom Tab
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[80vh] w-full max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? "Edit Custom Tab" : "Add Custom Tab"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="tab-label">Tab Name</Label>
              <Input
                id="tab-label"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="e.g., Client Onboarding Notes"
              />
              {form.label.trim() && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Slug: <span className="font-mono">custom-{generateSlug(form.label)}</span>
                </p>
              )}
            </div>

            <CustomFieldBuilder
              value={form.fields}
              onChange={(fields) => setForm({ ...form, fields })}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!form.label.trim() || form.fields.length === 0}
              >
                {editingIndex !== null ? "Save Tab" : "Add Tab"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
