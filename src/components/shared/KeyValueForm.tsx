"use client";

import { EditableCell } from "./EditableCell";
import { cn } from "@/lib/utils";

export interface KeyValueField {
  key: string;
  label: string;
  description: string;
  type: "text" | "textarea" | "dropdown" | "boolean";
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
      <div className="grid grid-cols-[200px_1fr_200px] bg-[#535FC1] text-white text-sm font-medium">
        <div className="px-4 py-2">Field</div>
        <div className="px-4 py-2">Description</div>
        <div className="px-4 py-2">Client Response</div>
      </div>
      {fields.map((field, idx) => (
        <div
          key={field.key}
          className={cn(
            "grid grid-cols-[200px_1fr_200px] border-b last:border-b-0",
            idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
          )}
        >
          <div className="px-4 py-3 text-sm font-medium">{field.label}</div>
          <div className="border-x px-4 py-3 text-sm text-muted-foreground">
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
            <EditableCell
              value={data[field.key] ?? ""}
              type={field.type}
              options={field.options}
              onChange={(val) => onChange(field.key, val)}
              placeholder="Enter response"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
