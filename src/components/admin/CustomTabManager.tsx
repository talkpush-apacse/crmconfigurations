"use client";

import { useMemo, useState } from "react";
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
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, FileText, FileSpreadsheet, Table2 } from "lucide-react";
import { CustomFieldBuilder } from "./CustomFieldBuilder";
import { CustomTabImportDialog } from "./CustomTabImportDialog";
import { customTabSlugConflict, customTabSlugFromLabel } from "@/lib/tab-config";
import type { CustomTab, CustomFieldDef } from "@/lib/types";

interface CustomTabManagerProps {
  value: CustomTab[];
  onChange: (tabs: CustomTab[]) => void;
  /**
   * Checklist id, required by the spreadsheet importer. When absent the
   * import button is hidden and manual field building still works.
   */
  checklistId?: string;
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

/** A table-based tab stores its shape in `columns`; a form-based tab in `fields`. */
function isTableTab(tab: CustomTab): boolean {
  return tab.columns !== undefined;
}

export function CustomTabManager({ value, onChange, checklistId }: CustomTabManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form, setForm] = useState<TabFormState>(emptyForm);

  const editingTab = editingIndex !== null ? value[editingIndex] : null;
  const editingTableTab = !!editingTab && isTableTab(editingTab);

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

  // Slug is only derived on create — an existing tab keeps its slug so that
  // bookmarked tab URLs stay valid across renames.
  const newSlug = useMemo(
    () => (editingIndex === null ? customTabSlugFromLabel(form.label) : null),
    [editingIndex, form.label]
  );

  const slugError = useMemo(() => {
    if (newSlug === null) return null;
    return customTabSlugConflict(newSlug, value);
  }, [newSlug, value]);

  const handleSave = () => {
    if (!form.label.trim() || slugError) return;

    const existing = editingIndex !== null ? value[editingIndex] : null;

    // Spread the existing tab so table-only data (columns, rows, uploadedFile,
    // sortOrder, createdAt) survives an edit made through this form.
    const tab: CustomTab = existing
      ? {
          ...existing,
          label: form.label.trim(),
          icon: form.icon || "FileText",
          // A table-based tab has no editable fields here — leave them untouched.
          fields: isTableTab(existing) ? existing.fields : form.fields,
        }
      : {
          id: crypto.randomUUID(),
          slug: customTabSlugFromLabel(form.label),
          label: form.label.trim(),
          icon: form.icon || "FileText",
          fields: form.fields,
          sortOrder: value.length,
          createdAt: new Date().toISOString(),
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

  const canSave =
    !!form.label.trim() &&
    !slugError &&
    // A new tab built here is form-based, so it needs at least one field.
    // An existing table-based tab is renameable without touching its columns.
    (editingTableTab || form.fields.length > 0);

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
          {value.map((tab, index) => {
            const tableTab = isTableTab(tab);
            const columnCount = tab.columns?.length ?? 0;
            const rowCount = tab.rows?.length ?? 0;
            return (
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

              {tableTab ? (
                <Table2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}

              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium truncate block">
                  {tab.label}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {tableTab ? (
                    <>
                      <Badge variant="outline" className="text-xs">
                        Table
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {columnCount} column{columnCount !== 1 ? "s" : ""} &middot;{" "}
                        {rowCount} row{rowCount !== 1 ? "s" : ""}
                      </span>
                    </>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      {tab.fields.length} field{tab.fields.length !== 1 ? "s" : ""}
                    </Badge>
                  )}
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
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Custom Tab
        </Button>
        {checklistId && (
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setImportOpen(true)}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Import from Spreadsheet
          </Button>
        )}
      </div>

      {checklistId && (
        <CustomTabImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          checklistId={checklistId}
          existingTabs={value}
          onCreate={(tabs) => onChange([...value, ...tabs])}
        />
      )}

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
                aria-invalid={!!slugError}
              />
              {slugError ? (
                <p className="mt-1 text-xs text-red-600">{slugError}</p>
              ) : newSlug ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Slug: <span className="font-mono">custom-{newSlug}</span>
                </p>
              ) : editingTab ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Slug: <span className="font-mono">custom-{editingTab.slug}</span>{" "}
                  (unchanged, so existing links keep working)
                </p>
              ) : null}
            </div>

            {editingTableTab && editingTab ? (
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Table Columns</Label>
                  <span className="text-xs text-muted-foreground">
                    {editingTab.columns?.length ?? 0} column
                    {(editingTab.columns?.length ?? 0) !== 1 ? "s" : ""} &middot;{" "}
                    {editingTab.rows?.length ?? 0} row
                    {(editingTab.rows?.length ?? 0) !== 1 ? "s" : ""}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  This is a table tab. Renaming it here is safe — its columns and
                  data are left untouched.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(editingTab.columns ?? []).map((col) => (
                    <Badge key={col.key} variant="outline" className="text-xs">
                      {col.label}
                      <span className="ml-1 text-muted-foreground">{col.type}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <CustomFieldBuilder
                value={form.fields}
                onChange={(fields) => setForm({ ...form, fields })}
              />
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!canSave}>
                {editingIndex !== null ? "Save Tab" : "Add Tab"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
