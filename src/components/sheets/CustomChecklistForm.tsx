"use client";

import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUploadCell } from "@/components/shared/FileUploadCell";
import { EditableTable } from "@/components/shared/EditableTable";
import { useChecklistContext } from "@/lib/checklist-context";
import type { CustomSchema, CustomData, CustomFieldDef, ColumnDef } from "@/lib/types";

function TableField({
  field,
  value,
  onChange,
}: {
  field: CustomFieldDef;
  value: Record<string, string>[];
  onChange: (rows: Record<string, string>[]) => void;
}) {
  const columns: ColumnDef[] = (field.columns ?? []).map((col) => ({
    key: col.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    label: col,
    type: "text" as const,
  }));

  const handleUpdate = (index: number, key: string, val: string | boolean) => {
    const updated = [...value];
    updated[index] = { ...updated[index], [key]: String(val) };
    onChange(updated);
  };

  const handleAdd = () => {
    const emptyRow: Record<string, string> = { id: crypto.randomUUID() };
    for (const col of columns) {
      emptyRow[col.key] = "";
    }
    onChange([...value, emptyRow]);
  };

  const handleDelete = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleReorder = (reordered: Record<string, string>[]) => {
    onChange(reordered);
  };

  return (
    <EditableTable
      columns={columns}
      data={value}
      onUpdate={handleUpdate}
      onAdd={handleAdd}
      onDelete={handleDelete}
      onReorder={handleReorder}
      addLabel="Add Row"
    />
  );
}

export function CustomChecklistForm() {
  const { data, updateField, isReadOnly } = useChecklistContext();
  const schema = (data?.customSchema ?? []) as CustomSchema;
  const customData = (data?.customData ?? {}) as CustomData;

  const handleChange = useCallback(
    (fieldId: string, value: unknown) => {
      const updated = { ...customData, [fieldId]: value };
      updateField("customData", updated);
    },
    [customData, updateField]
  );

  if (schema.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">
          No fields have been defined for this checklist yet.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{data?.clientName}</h2>
        <p className="text-sm text-muted-foreground">
          Fill out the fields below to complete this checklist.
        </p>
      </div>

      {schema.map((field) => (
        <CustomField
          key={field.id}
          field={field}
          value={customData[field.id]}
          onChange={(val) => handleChange(field.id, val)}
          readOnly={isReadOnly}
        />
      ))}
    </div>
  );
}

function CustomField({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: CustomFieldDef;
  value: unknown;
  onChange: (val: unknown) => void;
  readOnly: boolean;
}) {
  const stringVal = typeof value === "string" ? value : (value != null ? String(value) : "");
  const numberVal = typeof value === "number" ? value : (value ? Number(value) : undefined);
  const boolVal = typeof value === "boolean" ? value : false;

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {field.label}
        {field.required && <span className="ml-1 text-red-500">*</span>}
      </Label>

      {field.type === "text" && (
        <Input
          value={stringVal}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={readOnly}
        />
      )}

      {field.type === "textarea" && (
        <Textarea
          value={stringVal}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
          disabled={readOnly}
        />
      )}

      {field.type === "richtext" && (
        <div>
          <Textarea
            value={stringVal}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={6}
            disabled={readOnly}
          />
          <p className="mt-1 text-xs text-muted-foreground">Rich text (plain text for now)</p>
        </div>
      )}

      {field.type === "number" && (
        <Input
          type="number"
          value={numberVal ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
          placeholder={field.placeholder}
          disabled={readOnly}
        />
      )}

      {field.type === "date" && (
        <Input
          type="date"
          value={stringVal}
          onChange={(e) => onChange(e.target.value)}
          disabled={readOnly}
        />
      )}

      {field.type === "select" && (
        <Select
          value={stringVal || undefined}
          onValueChange={(v) => onChange(v)}
          disabled={readOnly}
        >
          <SelectTrigger>
            <SelectValue placeholder={field.placeholder ?? "Select an option"} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.type === "checkbox" && (
        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            checked={boolVal}
            onCheckedChange={(checked) => onChange(checked === true)}
            disabled={readOnly}
          />
          {field.placeholder && (
            <span className="text-sm text-muted-foreground">{field.placeholder}</span>
          )}
        </div>
      )}

      {field.type === "file" && (
        <FileUploadCell
          value={stringVal}
          onChange={(url) => onChange(url)}
          placeholder={field.placeholder}
        />
      )}

      {field.type === "table" && (
        <TableField
          field={field}
          value={Array.isArray(value) ? (value as Record<string, string>[]) : []}
          onChange={(rows) => onChange(rows)}
        />
      )}
    </div>
  );
}
