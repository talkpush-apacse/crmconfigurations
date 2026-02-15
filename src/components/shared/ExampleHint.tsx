"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Lightbulb } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ExampleHintProps {
  children: React.ReactNode;
}

export function ExampleHint({ children }: ExampleHintProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="mb-4 rounded-lg border border-purple-200 bg-purple-50">
        <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-100 rounded-lg transition-colors">
          <Lightbulb className="h-3.5 w-3.5" />
          <span>View Example</span>
          {open ? (
            <ChevronDown className="ml-auto h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="ml-auto h-3.5 w-3.5" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-purple-200 px-3 py-2 text-xs text-purple-700">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
