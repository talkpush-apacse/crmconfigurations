"use client";

import { useState } from "react";
import { ChevronDown, Eye } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ExampleHintProps {
  children: React.ReactNode;
}

export function ExampleHint({ children }: ExampleHintProps) {
  // Start collapsed — inline sample rows already show the same data on first load
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="mb-4 rounded-lg border border-brand-lavender bg-brand-lavender-lightest">
        <CollapsibleTrigger
          role="button"
          aria-expanded={open}
          className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium text-brand-lavender-darker hover:bg-[#BFDBFE]/40 rounded-t-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-inset"
        >
          <Eye className="h-3.5 w-3.5 shrink-0" />
          <span>View Example</span>
          <ChevronDown
            className={`ml-auto h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-brand-lavender px-3 py-2 text-xs text-brand-lavender-darker">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
