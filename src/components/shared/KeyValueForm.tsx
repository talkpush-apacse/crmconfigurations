"use client";

import { EditableCell } from "./EditableCell";
import { FileUploadCell } from "./FileUploadCell";
import { HelpTip } from "./HelpTip";
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
  validation?: "email" | "url" | "phone";
  helperText?: string;
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
    <div className="rounded-lg border overflow-hidden">
      {/* Column headers — hidden on mobile */}
      {/*
        Light header, matching EditableTable. This was `bg-primary` with white
        uppercase labels; once the data grids went light it was the only dark
        header left in the app, so a form-shaped tab and a table-shaped tab no
        longer looked like the same product.
      */}
      <div
        className={cn(
          "hidden border-b border-grid-line-strong bg-grid-header lg:grid",
          hasSamples
            ? "lg:grid-cols-[180px_minmax(200px,1fr)_200px] xl:grid-cols-[200px_minmax(220px,1fr)_220px]"
            : "lg:grid-cols-[180px_minmax(200px,1fr)] xl:grid-cols-[200px_minmax(220px,1fr)]"
        )}
      >
        <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-700">Field</div>
        <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-700">Client Response</div>
        {hasSamples && (
          <div className="border-l border-grid-line px-4 py-2 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
            Sample
          </div>
        )}
      </div>
      {fields.map((field, idx) => (
        <div
          key={field.key}
          className={cn(
            "flex flex-col border-b last:border-b-0",
            hasSamples
              ? "lg:grid lg:grid-cols-[180px_minmax(200px,1fr)_200px] xl:grid-cols-[200px_minmax(220px,1fr)_220px]"
              : "lg:grid lg:grid-cols-[180px_minmax(200px,1fr)] xl:grid-cols-[200px_minmax(220px,1fr)]",
            idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"
          )}
        >
          {/* Field label with ⓘ description tooltip */}
          <div className="flex flex-col justify-center px-4 py-3 min-h-[52px]">
            <div className="flex items-center gap-1.5">
            <span className="text-[14px] font-medium text-gray-700 leading-snug">{field.label}</span>
            {field.description && (
              <HelpTip label={field.label} side="top" size={13}>
                <p>{field.description}</p>
                {field.link && (
                  <a
                    href={field.link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block text-xs underline-offset-2 hover:underline"
                  >
                    {field.link.label}
                  </a>
                )}
              </HelpTip>
            )}
            </div>
            {field.helperText && (
              <p className="mt-1 text-[11px] text-gray-400 leading-tight">{field.helperText}</p>
            )}
          </div>
          {/* Client response input */}
          <div className={cn("p-1.5", field.type === "textarea" ? "" : "lg:py-1.5")}>
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
                validation={field.validation}
              />
            )}
          </div>
          {/* Sample column — desktop only, read-only */}
          {hasSamples && (
            <div className="hidden lg:flex items-start px-4 py-3 border-l">
              {field.example ? (
                <span className="text-[13px] text-gray-400 italic">{field.example}</span>
              ) : (
                <span className="text-[13px] text-gray-300">—</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
