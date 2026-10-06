import { stripInline } from "@/lib/workflow/process-map/inline-text";
"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACTOR_CONFIG, NODE_TYPE_CONFIG } from "@/lib/workflow/types";
import type { CommentView } from "@/lib/workflow/access/comments-service";
import { CommentThread, NewComment } from "./CommentsPanel";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type EditMode = "view" | "edit" | "suggest";

/** Details of the selected step: what it is, notes, comments, and (for editors) fields to change. */
export default function StepDetail({
  node,
  stepNumber,
  comments,
  canComment,
  editMode,
  textChanges,
  onClose,
  onEditField,
  onAddAfter,
  onDelete,
  onComment,
  onReply,
  onSetStatus,
}: {
  node: any;
  stepNumber?: string;
  comments: CommentView[];
  canComment: boolean;
  editMode: EditMode;
  /** For a pending suggestion on this step: field -> [old, new]. */
  textChanges?: Record<string, [unknown, unknown]>;
  onClose: () => void;
  onEditField: (field: "label" | "notes" | "actorLabel", value: string) => void;
  onAddAfter: () => void;
  onDelete: () => void;
  onComment: (body: string) => Promise<void>;
  onReply: (parentId: string, body: string) => Promise<void>;
  onSetStatus: (id: string, status: "open" | "resolved") => Promise<void>;
}) {
  const data = node.data ?? {};
  const typeLabel = NODE_TYPE_CONFIG[data.type as keyof typeof NODE_TYPE_CONFIG]?.label ?? data.type;
  const actorLabel = data.actor ? ACTOR_CONFIG[data.actor as keyof typeof ACTOR_CONFIG]?.label : null;
  const editing = editMode !== "view";
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <aside aria-label="Step details" className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          {stepNumber && <p className="text-xs font-semibold tabular-nums text-muted-foreground">Step {stepNumber}</p>}
          <h2 className="break-words text-base font-semibold text-foreground">{stripInline(data.label ?? "") || "Untitled step"}</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground">{typeLabel}</span>
            {actorLabel && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">{actorLabel}</span>}
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close step details"><X className="h-4 w-4" /></Button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 text-sm">
        {textChanges && Object.keys(textChanges).length > 0 && (
          <div className="rounded-md border border-dashed border-amber-500/70 bg-amber-50 p-3 text-xs text-amber-900" role="note">
            <p className="font-semibold">A suggestion changes this step</p>
            <ul className="mt-1 space-y-1">
              {Object.entries(textChanges).map(([field, [from, to]]) => (
                <li key={field}>
                  <span className="capitalize">{field}</span>: <s className="opacity-70">{String(from ?? "") || "(empty)"}</s> → <strong>{String(to ?? "") || "(empty)"}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}

        {editing ? (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">{editMode === "suggest" ? "Suggesting: your changes are sent to the owner to accept." : "Editing: your changes are saved as you go."}</p>
            <Field label="Step name" value={data.label ?? ""} maxLength={80} onCommit={(v) => onEditField("label", v)} />
            <Field label="Who does it" value={data.actorLabel ?? ""} maxLength={80} onCommit={(v) => onEditField("actorLabel", v)} />
            <Field label="Notes" value={data.notes ?? ""} multiline maxLength={2000} onCommit={(v) => onEditField("notes", v)} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={onAddAfter}><Plus className="h-3.5 w-3.5" />Add a step after this</Button>
              {!confirmDelete ? (
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}><Trash2 className="h-3.5 w-3.5" />Remove step</Button>
              ) : (
                <Button size="sm" variant="destructive" onClick={() => { setConfirmDelete(false); onDelete(); }}>Really remove?</Button>
              )}
            </div>
          </div>
        ) : (
          <>
            <Info label="Who does it" value={data.actorLabel || "Not specified"} />
            <Info label="Notes" value={data.notes || "No notes provided."} />
            {data.feasibility && (
              <Info
                label="Feasibility"
                value={data.feasibility === "needs_review" ? "Needs review" : data.feasibility === "likely" ? "Likely" : "Confirmed"}
                extra={data.feasibilityNote}
              />
            )}
          </>
        )}

        <section aria-label="Comments on this step">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comments</h3>
          <CommentThread comments={comments} canComment={canComment} onReply={onReply} onSetStatus={onSetStatus} />
          {canComment && <div className="mt-3"><NewComment placeholder="Comment on this step" onSend={onComment} /></div>}
        </section>
      </div>
    </aside>
  );
}

function Info({ label, value, extra }: { label: string; value: string; extra?: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-foreground">{value}</p>
      {extra && <p className="mt-1 text-amber-700">{extra}</p>}
    </div>
  );
}

function Field({ label, value, multiline, maxLength, onCommit }: { label: string; value: string; multiline?: boolean; maxLength: number; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  // Follow the step when a different one is selected or the value changes from outside.
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  const commit = () => draft !== value && onCommit(draft);
  const common = {
    value: draft,
    maxLength,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: commit,
    className: "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/70",
  };
  return (
    <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {label}
      {multiline ? <textarea rows={4} {...common} /> : <input {...common} />}
    </label>
  );
}
