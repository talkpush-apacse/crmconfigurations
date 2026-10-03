"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { filterOutline, type OutlineItem } from "@/lib/workflow/outline";

/** The diagram as a numbered, searchable list: the way to read it on a phone or with a screen reader. */
export default function OutlinePanel({
  items,
  selectedId,
  commentCounts,
  onSelect,
}: {
  items: OutlineItem[];
  selectedId: string | null;
  commentCounts: Map<string, number>;
  onSelect: (nodeId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => filterOutline(items, query), [items, query]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative border-b border-border p-3">
        <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a step" aria-label="Find a step" className="pl-8" />
      </div>
      <nav aria-label="Steps" className="min-h-0 flex-1 overflow-y-auto p-2">
        {shown.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No step matches “{query}”.</p>
        ) : (
          <ol className="space-y-0.5">
            {shown.map((item) => {
              const comments = commentCounts.get(item.nodeId) ?? 0;
              return (
                <li key={item.nodeId}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.nodeId)}
                    aria-current={selectedId === item.nodeId ? "true" : undefined}
                    style={{ paddingLeft: 8 + Math.min(item.depth, 3) * 14 }}
                    className={cn(
                      "flex min-h-11 w-full items-start gap-2 rounded-md py-2 pr-2 text-left text-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      selectedId === item.nodeId ? "bg-primary/10 text-foreground" : "hover:bg-muted"
                    )}
                  >
                    <span className="mt-0.5 w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">{item.number || "•"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">{item.label || "Untitled step"}</span>
                      {item.actorLabel && <span className="block truncate text-xs text-muted-foreground">{item.actorLabel}</span>}
                    </span>
                    {comments > 0 && (
                      <span className="mt-0.5 shrink-0 rounded-full bg-secondary px-1.5 text-[11px] font-medium text-foreground" aria-label={`${comments} comments`}>
                        {comments}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </nav>
    </div>
  );
}
