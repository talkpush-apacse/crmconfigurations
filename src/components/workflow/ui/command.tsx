"use client";

/**
 * A small searchable command list (replacement for the cmdk library, which this app does not install).
 * It supports exactly what the editor's ⌘K palette needs: a search box, groups, items, an empty state,
 * and arrow-key + Enter selection. Items that do not match the search are simply not rendered; the
 * keyboard handler reads the visible options from the DOM when a key is pressed.
 */

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface CommandState {
  query: string;
  setQuery: (q: string) => void;
  active: string | null;
  setActive: (value: string | null) => void;
  focusFirstVisible: () => void;
}

const Ctx = createContext<CommandState | null>(null);

function useCommand() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Command components must be used inside <CommandDialog>");
  return ctx;
}

export function CommandDialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const options = () => Array.from(listRef.current?.querySelectorAll<HTMLElement>("[role=option]") ?? []);

  function focusFirstVisible() {
    // Wait for the filtered list to render, then highlight its first row.
    requestAnimationFrame(() => setActive(options()[0]?.dataset.value ?? null));
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setQuery("");
      setActive(null);
    }
    onOpenChange(next);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const list = options();
    if (list.length === 0) return;
    const values = list.map((el) => el.dataset.value ?? "");
    const idx = Math.max(0, values.indexOf(active ?? values[0]));
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(values[(idx + 1) % values.length]);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(values[(idx - 1 + values.length) % values.length]);
    } else if (e.key === "Enter") {
      e.preventDefault();
      list[idx]?.click();
    }
  }

  return (
    <Ctx.Provider value={{ query, setQuery, active, setActive, focusFirstVisible }}>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-lg" onKeyDown={onKeyDown}>
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <DialogDescription className="sr-only">Search and press Enter to run a command.</DialogDescription>
          <div ref={listRef}>{children}</div>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

export function CommandInput({ placeholder }: { placeholder?: string }) {
  const { query, setQuery, focusFirstVisible } = useCommand();
  return (
    <input
      autoFocus
      value={query}
      onChange={(e) => {
        setQuery(e.target.value);
        focusFirstVisible();
      }}
      placeholder={placeholder}
      aria-label={placeholder ?? "Search"}
      className="w-full border-b border-border bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
    />
  );
}

export function CommandList({ children }: { children: ReactNode }) {
  return (
    <div role="listbox" className="max-h-72 overflow-y-auto p-1">
      {children}
    </div>
  );
}

/** Shown when nothing matches. Hidden by CSS as soon as any option exists (see :has rule below). */
export function CommandEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="hidden py-6 text-center text-sm text-muted-foreground [[role=listbox]:not(:has([role=option]))>&]:block">
      {children}
    </div>
  );
}

export function CommandGroup({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="py-1 [&:not(:has([role=option]))]:hidden">
      <div className="px-2 py-1 text-xs font-medium text-muted-foreground">{heading}</div>
      {children}
    </div>
  );
}

export function CommandItem({
  value,
  onSelect,
  children,
}: {
  value: string;
  onSelect: () => void;
  children: ReactNode;
}) {
  const { query, active, setActive } = useCommand();
  const q = query.trim().toLowerCase();
  if (q && !value.toLowerCase().includes(q)) return null;
  return (
    <div
      role="option"
      data-value={value}
      aria-selected={active === value}
      onClick={onSelect}
      onMouseMove={() => active !== value && setActive(value)}
      className={cn(
        "cursor-pointer rounded-md px-2 py-1.5 text-sm",
        active === value ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
      )}
    >
      {children}
    </div>
  );
}
