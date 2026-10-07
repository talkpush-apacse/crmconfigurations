"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { uploadTabFile } from "@/lib/upload-client";
import {
  getCustomFieldKey,
  getCustomTabFormValues,
  isCustomFieldVisible,
  validateCustomFormValues,
} from "@/lib/custom-tab-service";
import type {
  CustomSchema,
  CustomData,
  CustomFieldDef,
  CustomTab,
  ColumnDef,
  CustomFormFileValue,
  RepeaterColumn,
} from "@/lib/types";
import { buildColumnDefs } from "@/lib/custom-tab-columns";

/** A table-field row: `id` stays a string (required by EditableTable's row type), other cells are typed per-column. */
type TableFieldRow = { id: string; [key: string]: unknown };

function TableField({
  field,
  value,
  onChange,
}: {
  field: CustomFieldDef;
  value: TableFieldRow[];
  onChange: (rows: TableFieldRow[]) => void;
}) {
  // Typed columns (from tableColumns) take precedence — they let this table have
  // a real checkbox/select/etc. column instead of every column being plain text.
  // Falls back to the legacy `columns: string[]` (plain header labels, all-text)
  // so a field saved before tableColumns existed keeps rendering unchanged.
  const columns: ColumnDef[] =
    field.tableColumns && field.tableColumns.length > 0
      ? buildColumnDefs(field.tableColumns)
      : (Array.isArray(field.columns) ? field.columns.filter((col): col is string => typeof col === "string") : []).map((col) => ({
          key: col.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
          label: col,
          type: "text" as const,
        }));

  const handleUpdate = (index: number, key: string, val: string | boolean) => {
    const updated = [...value];
    const col = columns.find((c) => c.key === key);
    // Boolean columns keep a real boolean; everything else stays a string, matching
    // how MCP-created table tabs (CustomTabSheet) store their cell values.
    updated[index] = { ...updated[index], [key]: col?.type === "boolean" ? val : String(val) };
    onChange(updated);
  };

  const handleAdd = () => {
    const emptyRow: TableFieldRow = { id: crypto.randomUUID() };
    for (const col of columns) {
      emptyRow[col.key] = col.type === "boolean" ? false : "";
    }
    onChange([...value, emptyRow]);
  };

  const handleDelete = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleReorder = (reordered: TableFieldRow[]) => {
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
      spreadsheetMode
      tableId={`custom-form-${field.id}`}
    />
  );
}

function fileAccept(field: CustomFieldDef): string | undefined {
  const parts = [
    ...(field.allowedExtensions ?? []).map((ext) => `.${ext.replace(/^\./, "")}`),
    ...(field.allowedMimeTypes ?? []),
  ];
  return parts.length > 0 ? parts.join(",") : undefined;
}

function CustomFormFileField({
  field,
  customTab,
  value,
  onChange,
  readOnly,
}: {
  field: CustomFieldDef;
  customTab: CustomTab;
  value: unknown;
  onChange: (value: CustomFormFileValue | CustomFormFileValue[] | null) => void;
  readOnly: boolean;
}) {
  const { data } = useChecklistContext();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const files: CustomFormFileValue[] = Array.isArray(value)
    ? (value as CustomFormFileValue[])
    : value && typeof value === "object"
      ? [value as CustomFormFileValue]
      : [];

  const uploadFiles = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    const selected = Array.from(selectedFiles);
    if (!field.multiple && selected.length > 1) {
      setError("Only one file is allowed.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const uploaded: CustomFormFileValue[] = [];
      for (const file of selected) {
        const body = await uploadTabFile(file, {
          slug: data.slug,
          tabKey: `custom-${customTab.slug}`,
          customTabId: customTab.id,
          fieldKey: getCustomFieldKey(field),
        });
        uploaded.push({
          fileName: body.fileName || file.name,
          url: body.url,
          mimeType: body.mimeType || file.type || null,
          size: body.size ?? file.size,
          uploadedAt: body.uploadedAt || new Date().toISOString(),
        });
      }
      const next = field.multiple ? [...files, ...uploaded] : uploaded[0] ?? null;
      onChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    if (field.multiple) {
      onChange(files.filter((_, i) => i !== index));
    } else {
      onChange(null);
    }
  };

  return (
    <div className="space-y-2">
      {files.map((file, index) => (
        <div key={`${file.url}-${index}`} className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
          <a href={file.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-brand-lavender-darker hover:underline">
            {file.fileName}
          </a>
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="max-md:min-h-11 max-md:min-w-11 h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => removeFile(index)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ))}

      {!readOnly && (field.multiple || files.length === 0) && (
        <>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={fileAccept(field)}
            multiple={!!field.multiple}
            onChange={(event) => uploadFiles(event.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="max-md:min-h-11 gap-2"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : files.length > 0 ? "Add File" : "Choose File"}
          </Button>
        </>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function RepeaterField({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: CustomFieldDef;
  value: Record<string, unknown>[];
  onChange: (rows: Record<string, unknown>[]) => void;
  readOnly: boolean;
}) {
  const columns = Array.isArray(field.columns)
    ? (field.columns.filter((column): column is RepeaterColumn => typeof column !== "string"))
    : [];

  const addRow = () => {
    const row: Record<string, unknown> = { id: crypto.randomUUID() };
    for (const column of columns) row[column.key] = column.type === "checkbox" ? false : "";
    onChange([...value, row]);
  };

  const updateCell = (rowIndex: number, column: RepeaterColumn, nextValue: unknown) => {
    const next = [...value];
    next[rowIndex] = { ...next[rowIndex], [column.key]: nextValue };
    onChange(next);
  };

  const deleteRow = (rowIndex: number) => {
    onChange(value.filter((_, index) => index !== rowIndex));
  };

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b text-left">
              {columns.map((column) => (
                <th key={column.key} className="px-2 py-2 font-medium">
                  {column.label}
                  {column.required && <span className="ml-1 text-red-500">*</span>}
                </th>
              ))}
              {!readOnly && <th className="w-10 px-2 py-2" />}
            </tr>
          </thead>
          <tbody>
            {value.map((row, rowIndex) => (
              <tr key={String(row.id ?? rowIndex)} className="border-b last:border-b-0">
                {columns.map((column) => (
                  <td key={column.key} className="px-2 py-2 align-top">
                    <RepeaterCell
                      column={column}
                      value={row[column.key]}
                      onChange={(next) => updateCell(rowIndex, column, next)}
                      readOnly={readOnly}
                    />
                  </td>
                ))}
                {!readOnly && (
                  <td className="px-2 py-2 align-top">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="max-md:min-h-11 max-md:min-w-11 h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteRow(rowIndex)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {value.length === 0 && (
        <p className="text-sm text-muted-foreground">No rows yet.</p>
      )}

      {!readOnly && (
        <Button type="button" variant="outline" size="sm" className="max-md:min-h-11 gap-2" onClick={addRow}>
          <Plus className="h-4 w-4" />
          Add Row
        </Button>
      )}
    </div>
  );
}

function RepeaterCell({
  column,
  value,
  onChange,
  readOnly,
}: {
  column: RepeaterColumn;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly: boolean;
}) {
  const stringValue = typeof value === "string" ? value : value == null ? "" : String(value);
  const boolValue = typeof value === "boolean" ? value : false;

  if (column.type === "textarea") {
    return (
      <Textarea
        value={stringValue}
        onChange={(event) => onChange(event.target.value)}
        placeholder={column.placeholder}
        rows={2}
        disabled={readOnly}
      />
    );
  }

  if (column.type === "select") {
    return (
      <Select value={stringValue || undefined} onValueChange={onChange} disabled={readOnly}>
        <SelectTrigger className="max-md:min-h-11">
          <SelectValue placeholder={column.placeholder ?? "Select"} />
        </SelectTrigger>
        <SelectContent>
          {(column.options ?? []).map((option) => (
            <SelectItem key={option} value={option}>{option}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (column.type === "checkbox") {
    return (
      <Checkbox
        checked={boolValue}
        onCheckedChange={(checked) => onChange(checked === true)}
        disabled={readOnly}
      />
    );
  }

  return (
    <Input className="max-md:min-h-11"
      type={column.type === "number" ? "number" : column.type === "email" ? "email" : column.type === "url" ? "url" : column.type === "date" ? "date" : "text"}
      value={stringValue}
      onChange={(event) => onChange(column.type === "number" && event.target.value !== "" ? Number(event.target.value) : event.target.value)}
      placeholder={column.placeholder}
      min={column.min}
      max={column.max}
      step={column.integerOnly ? 1 : undefined}
      disabled={readOnly}
    />
  );
}

interface CustomChecklistFormProps {
  /** When provided, renders fields from a specific custom tab instead of the top-level customSchema */
  customTabId?: string;
}

export function CustomChecklistForm({ customTabId }: CustomChecklistFormProps = {}) {
  const { data, updateField, isReadOnly } = useChecklistContext();
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Determine which schema to use: custom tab fields or top-level customSchema
  const customTab = customTabId
    ? (((data?.customTabs as CustomTab[] | null) ?? []).find((t) => t.id === customTabId) ?? null)
    : null;
  const schema = useMemo(
    () => customTab
      ? customTab.fields
      : ((data?.customSchema ?? []) as CustomSchema),
    [customTab, data?.customSchema]
  );
  const customData = useMemo(
    () => (data?.customData ?? {}) as CustomData,
    [data?.customData]
  );
  const formValues = useMemo(
    () => customTab ? getCustomTabFormValues(customTab, customData) : customData,
    [customTab, customData]
  );
  const validation = useMemo(
    () => customTab ? validateCustomFormValues(customTab, formValues) : { valid: true, errors: {} },
    [customTab, formValues]
  );
  const visibleSchema = useMemo(
    () => customTab ? schema.filter((field) => isCustomFieldVisible(field, formValues)) : schema,
    [customTab, schema, formValues]
  );

  const handleChange = useCallback(
    (field: CustomFieldDef, value: unknown) => {
      const key = customTab ? getCustomFieldKey(field) : field.id;
      const updated = customTab
        ? {
            ...customData,
            [customTab.id]: {
              values: {
                ...formValues,
                [key]: value,
              },
              updatedAt: new Date().toISOString(),
            },
          }
        : { ...customData, [field.id]: value };
      updateField("customData", updated);
    },
    [customTab, customData, formValues, updateField]
  );

  const markTouched = useCallback(
    (field: CustomFieldDef) => {
      const key = customTab ? getCustomFieldKey(field) : field.id;
      setTouched((prev) => ({ ...prev, [key]: true }));
    },
    [customTab]
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
    <div className={customTab ? "w-full max-w-none space-y-6" : "mx-auto max-w-3xl space-y-6"}>
      <div>
        <h2 className="text-lg font-semibold">{customTab ? customTab.label : data?.clientName}</h2>
        <p className="text-sm text-muted-foreground">
          Fill out the fields below to complete {customTab ? "this section" : "this checklist"}.
        </p>
      </div>

      {visibleSchema.map((field) => {
        const key = customTab ? getCustomFieldKey(field) : field.id;
        const errors = touched[key] ? validation.errors[key] : undefined;
        return (
        <CustomField
          key={field.id}
          field={field}
          customTab={customTab}
          value={formValues[key]}
          onChange={(val) => handleChange(field, val)}
          onTouched={() => markTouched(field)}
          readOnly={isReadOnly}
          errors={errors}
        />
        );
      })}

      {customTab && Object.entries(validation.errors)
        .filter(([key]) => key.startsWith("validationGroup:"))
        .map(([key, messages]) => (
          <div key={key} className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {messages.join(" ")}
          </div>
        ))}
    </div>
  );
}

function CustomField({
  field,
  customTab,
  value,
  onChange,
  onTouched,
  readOnly,
  errors,
}: {
  field: CustomFieldDef;
  customTab: CustomTab | null;
  value: unknown;
  onChange: (val: unknown) => void;
  onTouched: () => void;
  readOnly: boolean;
  errors?: string[];
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
        <Input className="max-md:min-h-11"
          value={stringVal}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onTouched}
          placeholder={field.placeholder}
          disabled={readOnly}
        />
      )}

      {field.type === "textarea" && (
        <Textarea
          value={stringVal}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onTouched}
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
            onBlur={onTouched}
            placeholder={field.placeholder}
            rows={6}
            disabled={readOnly}
          />
          <p className="mt-1 text-xs text-muted-foreground">Rich text (plain text for now)</p>
        </div>
      )}

      {field.type === "number" && (
        <Input className="max-md:min-h-11"
          type="number"
          min={field.min}
          max={field.max}
          step={field.integerOnly ? 1 : undefined}
          value={numberVal ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
          onBlur={onTouched}
          placeholder={field.placeholder}
          disabled={readOnly}
        />
      )}

      {field.type === "date" && (
        <Input className="max-md:min-h-11"
          type="date"
          value={stringVal}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onTouched}
          disabled={readOnly}
        />
      )}

      {field.type === "email" && (
        <Input className="max-md:min-h-11"
          type="email"
          value={stringVal}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onTouched}
          placeholder={field.placeholder}
          disabled={readOnly}
        />
      )}

      {field.type === "url" && (
        <Input className="max-md:min-h-11"
          type="url"
          value={stringVal}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onTouched}
          placeholder={field.placeholder}
          disabled={readOnly}
        />
      )}

      {field.type === "select" && (
        <Select
          value={stringVal || undefined}
          onValueChange={(v) => {
            onChange(v);
            onTouched();
          }}
          disabled={readOnly}
        >
          <SelectTrigger className="max-md:min-h-11">
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
            onCheckedChange={(checked) => {
              onChange(checked === true);
              onTouched();
            }}
            disabled={readOnly}
          />
          {field.placeholder && (
            <span className="text-sm text-muted-foreground">{field.placeholder}</span>
          )}
        </div>
      )}

      {field.type === "file" && (
        customTab ? (
          <CustomFormFileField
            field={field}
            customTab={customTab}
            value={value}
            onChange={(next) => {
              onChange(next);
              onTouched();
            }}
            readOnly={readOnly}
          />
        ) : (
          <FileUploadCell
            value={stringVal}
            onChange={(url) => {
              onChange(url);
              onTouched();
            }}
            placeholder={field.placeholder}
          />
        )
      )}

      {field.type === "table" && (
        <TableField
          field={field}
          value={Array.isArray(value) ? (value as TableFieldRow[]) : []}
          onChange={(rows) => {
            onChange(rows);
            onTouched();
          }}
        />
      )}

      {field.type === "repeater" && (
        <RepeaterField
          field={field}
          value={Array.isArray(value) ? (value as Record<string, unknown>[]) : []}
          onChange={(rows) => {
            onChange(rows);
            onTouched();
          }}
          readOnly={readOnly}
        />
      )}

      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}

      {errors && errors.length > 0 && (
        <div className="space-y-1">
          {errors.map((error) => (
            <p key={error} className="text-xs text-red-600">{error}</p>
          ))}
        </div>
      )}
    </div>
  );
}
