"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import type { CustomFieldDef, CustomFieldType } from "@/lib/types";

const FIELD_TYPE_OPTIONS: { value: CustomFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Textarea" },
  { value: "richtext", label: "Rich Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Select (Dropdown)" },
  { value: "checkbox", label: "Checkbox" },
  { value: "file", label: "File Upload" },
  { value: "table", label: "Table" },
];

interface CustomFieldBuilderProps {
  value: CustomFieldDef[];
  onChange: (fields: CustomFieldDef[]) => void;
}

interface FieldFormState {
  label: string;
  type: CustomFieldType;
  required: boolean;
  placeholder: string;
  options: string;
  columns: string;
}

const emptyForm: FieldFormState = {
  label: "",
  type: "text",
  required: false,
  placeholder: "",
  options: "",
  columns: "",
};

export function CustomFieldBuilder({ value, onChange }: CustomFieldBuilderProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form, setForm] = useState<FieldFormState>(emptyForm);

  const openAdd = () => {
    setForm(emptyForm);
    setEditingIndex(null);
    setDialogOpen(true);
  };

  const openEdit = (index: number) => {
    const field = value[index];
    setForm({
      label: field.label,
      type: field.type,
      required: field.required,
      placeholder: field.placeholder ?? "",
      options: field.options?.join(", ") ?? "",
      columns: field.columns?.join(", ") ?? "",
    });
    setEditingIndex(index);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.label.trim()) return;

    const field: CustomFieldDef = {
      id: editingIndex !== null ? value[editingIndex].id : crypto.randomUUID(),
      label: form.label.trim(),
      type: form.type,
      required: form.required,
      ...(form.placeholder.trim() ? { placeholder: form.placeholder.trim() } : {}),
      ...(form.type === "select" && form.options.trim()
        ? { options: form.options.split(",").map((o) => o.trim()).filter(Boolean) }
        : {}),
      ...(form.type === "table" && form.columns.trim()
        ? { columns: form.columns.split(",").map((c) => c.trim()).filter(Boolean) }
        : {}),
    };

    if (editingIndex !== null) {
      const updated = [...value];
      updated[editingIndex] = field;
      onChange(updated);
    } else {
      onChange([...value, field]);
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
        <Label className="text-sm font-medium">Custom Fields</Label>
        <span className="text-xs text-muted-foreground">{value.length} field{value.length !== 1 ? "s" : ""}</span>
      </div>

      {value.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">No fields defined yet. Add your first field to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {value.map((field, index) => (
            <div
              key={field.id}
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

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{field.label}</span>
                  {field.required && (
                    <span className="text-xs text-red-500">*</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="outline" className="text-xs">
                    {FIELD_TYPE_OPTIONS.find((o) => o.value === field.type)?.label ?? field.type}
                  </Badge>
                  {field.placeholder && (
                    <span className="text-xs text-muted-foreground truncate">"{field.placeholder}"</span>
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
          ))}
        </div>
      )}

      <Button variant="outline" className="w-full" onClick={openAdd}>
        <Plus className="mr-2 h-4 w-4" />
        Add Field
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? "Edit Field" : "Add Field"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="field-label">Label</Label>
              <Input
                id="field-label"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="e.g., Company Name"
              />
            </div>

            <div>
              <Label htmlFor="field-type">Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as CustomFieldType })}
              >
                <SelectTrigger id="field-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="field-required"
                checked={form.required}
                onCheckedChange={(checked) =>
                  setForm({ ...form, required: checked === true })
                }
              />
              <Label htmlFor="field-required" className="text-sm">
                Required
              </Label>
            </div>

            <div>
              <Label htmlFor="field-placeholder">Placeholder (optional)</Label>
              <Input
                id="field-placeholder"
                value={form.placeholder}
                onChange={(e) =>
                  setForm({ ...form, placeholder: e.target.value })
                }
                placeholder="e.g., Enter your company name"
              />
            </div>

            {form.type === "select" && (
              <div>
                <Label htmlFor="field-options">
                  Options (comma-separated)
                </Label>
                <Input
                  id="field-options"
                  value={form.options}
                  onChange={(e) =>
                    setForm({ ...form, options: e.target.value })
                  }
                  placeholder="e.g., Option A, Option B, Option C"
                />
              </div>
            )}

            {form.type === "table" && (
              <div>
                <Label htmlFor="field-columns">
                  Column Headers (comma-separated)
                </Label>
                <Input
                  id="field-columns"
                  value={form.columns}
                  onChange={(e) =>
                    setForm({ ...form, columns: e.target.value })
                  }
                  placeholder="e.g., Name, Email, Phone"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!form.label.trim()}>
                {editingIndex !== null ? "Save Changes" : "Add Field"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
