"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import changelog from "../../../CHANGELOG.json";

interface ChangelogEntry {
  version: string;
  codename: string;
  changes: string[];
  deployed_at: string;
}

const entries = changelog as ChangelogEntry[];

export function ChangelogSection() {
  const [expandedIndex, setExpandedIndex] = useState(0);

  return (
    <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
      {entries.map((entry, i) => {
        const isExpanded = expandedIndex === i;
        const isLatest = i === 0;

        return (
          <div
            key={entry.version}
            className="rounded-lg border border-gray-200 bg-white"
          >
            <button
              type="button"
              onClick={() => setExpandedIndex(isExpanded ? -1 : i)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 font-mono text-xs font-medium text-teal-700">
                v{entry.version}
              </span>
              <span className="text-sm font-medium text-gray-800">
                {entry.codename}
              </span>
              {isLatest && (
                <span className="rounded-full bg-teal-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Latest
                </span>
              )}
              <span className="ml-auto text-xs text-gray-500">
                {entry.deployed_at}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-gray-400 transition-transform",
                  isExpanded && "rotate-180"
                )}
              />
            </button>

            {isExpanded && (
              <div className="border-t border-gray-100 px-4 pb-3 pt-2">
                <ul className="space-y-1">
                  {entry.changes.map((change) => (
                    <li
                      key={change}
                      className="flex items-start gap-2 text-sm text-gray-600"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
