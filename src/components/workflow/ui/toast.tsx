"use client";

/**
 * A tiny toast system with the same call shape the editor already uses (toast.success / toast.error),
 * so the module needs no extra library. Mount <WorkflowToaster /> once on every page that toasts.
 */

import { useEffect, useState } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

let nextId = 1;
let items: ToastItem[] = [];
const listeners = new Set<(items: ToastItem[]) => void>();

function publish() {
  for (const listener of listeners) listener(items);
}

function push(kind: ToastKind, message: string, durationMs = 4000) {
  const id = nextId++;
  items = [...items, { id, kind, message }].slice(-4);
  publish();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    publish();
  }, durationMs);
}

export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message, 6000),
  info: (message: string) => push("info", message),
};

export function WorkflowToaster() {
  const [list, setList] = useState<ToastItem[]>(items);
  useEffect(() => {
    listeners.add(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);

  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {list.map((t) => {
        const Icon = t.kind === "success" ? CheckCircle2 : t.kind === "error" ? XCircle : Info;
        const tone =
          t.kind === "success" ? "text-emerald-600" : t.kind === "error" ? "text-red-600" : "text-slate-600";
        return (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className="pointer-events-auto flex max-w-sm items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-lg"
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
