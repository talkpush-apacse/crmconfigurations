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
  placeholder?: string;
  example?: string;
}

interface KeyValueFormProps {
  fields: KeyValueField[];
  data: Record<string, string | boolean>;
  onChange: (key: string, value: string | boolean) => void;
}

export function KeyValueForm({ fields, data, onChange }: KeyValueFormProps) {
  // Only add the Sample column when at least one field has an example value
  const hasSamples = fields.some((f) => f.example);

  return (
    <div className="rounded-lg border">
      {/* Column headers — hidden on mobile */}
      <div
        className={cn(
          "hidden lg:grid bg-brand-lavender-darker text-white text-sm font-medium rounded-t-lg",
          hasSamples
            ? "lg:grid-cols-[200px_1fr_280px_200px] xl:grid-cols-[220px_1fr_320px_220px]"
            : "lg:grid-cols-[200px_1fr_280px] xl:grid-cols-[220px_1fr_320px]"
        )}
      >
        <div className="px-4 py-2">Field</div>
        <div className="px-4 py-2">Description</div>
        <div className="px-4 py-2">Client Response</div>
        {hasSamples && <div className="px-4 py-2">Sample</div>}
      </div>
      {fields.map((field, idx) => (
        <div
          key={field.key}
          className={cn(
            "flex flex-col border-b last:border-b-0",
            hasSamples
              ? "lg:grid lg:grid-cols-[200px_1fr_280px_200px] xl:grid-cols-[220px_1fr_320px_220px]"
              : "lg:grid lg:grid-cols-[200px_1fr_280px] xl:grid-cols-[220px_1fr_320px]",
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
          <div className="p-1.5 bg-yellow-50/50">
            {/* Mobile-only sample hint — shown above the response input */}
            {field.example && (
              <p className="lg:hidden px-1 pt-0.5 pb-1 text-xs text-gray-400 italic">
                e.g. {field.example}
              </p>
            )}
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
                placeholder={field.placeholder ?? "Enter response"}
              />
            )}
          </div>
          {/* Sample column — desktop only, read-only */}
          {hasSamples && (
            <div className="hidden lg:flex items-start px-4 py-3 bg-gray-50/60 border-l">
              {field.example ? (
                <span className="text-sm text-gray-400 italic">{field.example}</span>
              ) : (
                <span className="text-sm text-gray-300">—</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
