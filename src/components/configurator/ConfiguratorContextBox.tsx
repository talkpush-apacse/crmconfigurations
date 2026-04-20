import { Info } from "lucide-react";
import { resolveContextPath } from "@/lib/configurator-filter";
import type { ConfiguratorTemplateItem } from "@/lib/configurator-template";

interface ConfiguratorContextBoxProps {
  fields: NonNullable<ConfiguratorTemplateItem["contextFields"]>;
  sourceData: unknown;
}

export function ConfiguratorContextBox({ fields, sourceData }: ConfiguratorContextBoxProps) {
  return (
    <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-950">
      <div className="mb-2 flex items-center gap-2 font-medium text-orange-900">
        <Info className="h-4 w-4 text-orange-600" />
        Client-provided context
      </div>
      <dl className="grid gap-2 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={`${field.label}-${field.path}`}>
            <dt className="text-xs font-medium text-orange-700">{field.label}</dt>
            <dd className="break-words tabular-nums">{resolveContextPath(sourceData, field.path)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
