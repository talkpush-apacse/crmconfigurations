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
      <div className="mb-4 rounded-lg border border-brand-lavender bg-brand-lavender-lightest">
        <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-brand-lavender-darker hover:bg-brand-lavender-lighter rounded-lg transition-colors">
          <Lightbulb className="h-3.5 w-3.5" />
          <span>View Example</span>
          {open ? (
            <ChevronDown className="ml-auto h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="ml-auto h-3.5 w-3.5" />
          )}
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
