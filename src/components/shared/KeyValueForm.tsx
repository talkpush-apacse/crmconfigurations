"use client";

import { EditableCell } from "./EditableCell";
import { FileUploadCell } from "./FileUploadCell";
import { cn } from "@/lib/utils";

export interface KeyValueField {
  key: string;
  label: string;
  description: string;
  type: "text" | "textarea" | "dropdown" | "boolean" | "file";
  options?: string[];
  link?: { url: string; label: string };
}

interface KeyValueFormProps {
  fields: KeyValueField[];
  data: Record<string, string | boolean>;
  onChange: (key: string, value: string | boolean) => void;
}

export function KeyValueForm({ fields, data, onChange }: KeyValueFormProps) {
  return (
    <div className="rounded-lg border">
      {/* Column headers — hidden on mobile, 3-col on lg+ */}
      <div className="hidden lg:grid lg:grid-cols-[200px_1fr_280px] xl:grid-cols-[220px_1fr_320px] bg-brand-lavender-darker text-white text-sm font-medium rounded-t-lg">
        <div className="px-4 py-2">Field</div>
        <div className="px-4 py-2">Description</div>
        <div className="px-4 py-2">Client Response</div>
      </div>
      {fields.map((field, idx) => (
        <div
          key={field.key}
          className={cn(
            "flex flex-col lg:grid lg:grid-cols-[200px_1fr_280px] xl:grid-cols-[220px_1fr_320px] border-b last:border-b-0",
            idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
          )}
        >
          <div className="px-4 pt-3 pb-0 lg:py-3 text-sm font-medium">{field.label}</div>
          <div className="lg:border-x px-4 py-2 lg:py-3 text-sm text-muted-foreground">
            {field.description}
            {field.link && (
              <a
                href={field.link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-xs text-blue-600 hover:underline"
              >
                {field.link.label}
              </a>
            )}
          </div>
          <div className="px-2 py-2 bg-yellow-50/50">
            {field.type === "file" ? (
              <FileUploadCell
                value={String(data[field.key] ?? "")}
                onChange={(val) => onChange(field.key, val)}
                placeholder="Upload file or paste URL"
              />
            ) : (
              <EditableCell
                value={data[field.key] ?? ""}
                type={field.type}
                options={field.options}
                onChange={(val) => onChange(field.key, val)}
                placeholder="Enter response"
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
