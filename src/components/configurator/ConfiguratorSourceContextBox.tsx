import { ClipboardList } from "lucide-react";
import type { ConfiguratorSourceContext } from "@/lib/configurator-source-context";

interface ConfiguratorSourceContextBoxProps {
  contexts: ConfiguratorSourceContext[];
}

export function ConfiguratorSourceContextBox({ contexts }: ConfiguratorSourceContextBoxProps) {
  if (contexts.length === 0) return null;

  return (
    <div className="space-y-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-950">
      <div className="flex items-center gap-2 font-medium text-sky-900">
        <ClipboardList className="h-4 w-4 text-sky-700" />
        CRM checklist data to configure
      </div>
      {contexts.map((context) => (
        <div key={context.title}>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
            {context.title}
          </p>
          <ul className="space-y-1">
            {context.lines.map((line, index) => (
              <li key={`${context.title}-${index}-${line}`} className="break-words leading-5">
                {line}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
