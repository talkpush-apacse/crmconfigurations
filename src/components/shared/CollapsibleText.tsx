"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Do I want to read all of this?" is the reader's call, so a page intro shows two lines and a
 * "Show more" toggle. The toggle only appears when the text really is longer than two lines.
 * The choice is remembered on this device: open it once and the other sections open too.
 */
const STORAGE_KEY = "cf-intro-open";

// One shared choice for every intro on the page, kept in memory so the toggle still works
// when the browser refuses storage (private windows).
let remembered: boolean | null = null;
const listeners = new Set<() => void>();

function getOpen(): boolean {
  if (remembered !== null) return remembered;
  try {
    remembered = window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    remembered = false;
  }
  return remembered;
}

function setOpenEverywhere(open: boolean) {
  remembered = open;
  try {
    window.localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
  } catch {
    // Storage refused: the in-memory choice above is enough for this visit.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

export function CollapsibleText({ children, className }: { children: ReactNode; className?: string }) {
  // The server and the first browser render both say "closed"; the saved choice is applied right after.
  const open = useSyncExternalStore(subscribe, getOpen, () => false);
  const [overflows, setOverflows] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Longer than two lines? Works the same open or closed, so a short intro never gets a pointless "Show less".
  const measure = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    const lineHeight = parseFloat(window.getComputedStyle(el).lineHeight);
    const twoLines = Number.isFinite(lineHeight) ? lineHeight * 2 : el.clientHeight;
    setOverflows(el.scrollHeight > twoLines + 2);
  }, []);

  useEffect(() => {
    measure();
    const el = bodyRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, children, open]);

  return (
    <div className={className}>
      <div ref={bodyRef} className={cn(!open && "line-clamp-2")}>
        {children}
      </div>
      {overflows && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpenEverywhere(!open)}
          className="mt-1 inline-flex min-h-8 items-center gap-1 rounded-sm text-[13px] font-semibold text-foreground underline underline-offset-4 outline-none hover:no-underline focus-visible:ring-[3px] focus-visible:ring-ring/70"
        >
          {open ? "Show less" : "Show more"}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
