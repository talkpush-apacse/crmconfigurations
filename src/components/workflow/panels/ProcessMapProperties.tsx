"use client";

import { ACTION_TYPES, ACTION_TYPE_KEYS, type EndKind, type NoteKind } from "@/lib/workflow/process-map/tokens";
import { actionTypeOf, personActs } from "@/lib/workflow/process-map/model";
import type { WorkflowNodeData } from "@/lib/workflow/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface StepOption {
  id: string;
  label: string;
  number: string;
}

const FIELD = "w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none";

const END_KINDS: [EndKind, string][] = [
  ["success", "Success (dark green)"],
  ["failure", "Failure or rejected (pink)"],
  ["neutral", "Hand-off or neutral (grey)"],
  ["soft", "Soft success (light green)"],
];

const NOTE_KINDS: [NoteKind, string][] = [
  ["info", "Note (yellow)"],
  ["needs_input", "To confirm with the client (orange)"],
  ["rejection", "Rejection reason (pink)"],
  ["out_of_scope", "Out of scope (grey)"],
];

/** Settings that only exist in the Process Map style: tag, who acts, end state, jump target, note kind. */
export default function ProcessMapProperties({
  nodeId,
  data,
  otherSteps,
  onChange,
}: {
  nodeId: string;
  data: WorkflowNodeData;
  otherSteps: StepOption[];
  onChange: (id: string, updates: Partial<WorkflowNodeData>) => void;
}) {
  const node = { id: nodeId, type: data.type, data };
  const d = data as any;
  const isProcessStep = ["stage", "communication", "integration", "wait", "manual_action", "parallel"].includes(data.type);
  const inferred = actionTypeOf(node);
  const person = personActs(node);

  return (
    <div className="pt-2 border-t border-gray-100 space-y-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Process Map</p>

      {isProcessStep && (
        <>
          <label className="block text-sm font-medium text-gray-700">
            Does a person act in this step?
            <select
              className={`${FIELD} mt-1`}
              value={typeof d.personActs === "boolean" ? String(d.personActs) : "auto"}
              onChange={(e) => onChange(nodeId, { personActs: e.target.value === "auto" ? undefined : e.target.value === "true" } as Partial<WorkflowNodeData>)}
            >
              <option value="auto">Work it out from the actor ({person ? "yes, a person" : "no, the system"})</option>
              <option value="true">Yes: white box, role in brackets</option>
              <option value="false">No: green box, the system does it</option>
            </select>
            <span className="mt-1 block text-xs font-normal text-gray-500">The box colour follows who acts, never the tag. If a person acts and the system then does something, keep one white box and say so in the text.</span>
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Action type (the tag)
            <select
              className={`${FIELD} mt-1`}
              value={d.actionType === null ? "none" : (d.actionType ?? "auto")}
              onChange={(e) => onChange(nodeId, { actionType: e.target.value === "auto" ? undefined : e.target.value === "none" ? null : e.target.value } as Partial<WorkflowNodeData>)}
            >
              <option value="auto">Work it out ({inferred ? ACTION_TYPES[inferred].tag : "no tag"})</option>
              <option value="none">No tag (a genuinely manual step)</option>
              {ACTION_TYPE_KEYS.map((k) => (
                <option key={k} value={k}>{ACTION_TYPES[k].tag} {ACTION_TYPES[k].label}</option>
              ))}
            </select>
            {inferred && <span className="mt-1 block text-xs font-normal text-gray-500">{ACTION_TYPES[inferred].use}</span>}
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Timing or cadence (optional)
            <input className={`${FIELD} mt-1`} value={d.timing ?? ""} maxLength={80} placeholder="For example: Day before the interview" onChange={(e) => onChange(nodeId, { timing: e.target.value } as Partial<WorkflowNodeData>)} />
            <span className="mt-1 block text-xs font-normal text-gray-500">Shown in italics on the last line of the box.</span>
          </label>
        </>
      )}

      {data.type === "terminator" && (
        <label className="block text-sm font-medium text-gray-700">
          What kind of ending is this?
          <select className={`${FIELD} mt-1`} value={d.endKind ?? "neutral"} onChange={(e) => onChange(nodeId, { endKind: e.target.value } as Partial<WorkflowNodeData>)}>
            {END_KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </label>
      )}

      {data.type === "jump" && (
        <label className="block text-sm font-medium text-gray-700">
          Which step does this point to?
          <select className={`${FIELD} mt-1`} value={d.jumpToNodeId ?? ""} onChange={(e) => onChange(nodeId, { jumpToNodeId: e.target.value } as Partial<WorkflowNodeData>)}>
            <option value="">Choose a step…</option>
            {otherSteps.map((s) => <option key={s.id} value={s.id}>{s.number ? `${s.number}. ` : ""}{s.label}</option>)}
          </select>
          <span className="mt-1 block text-xs font-normal text-gray-500">The marker reads “Go to step N” and updates itself when steps are renumbered.</span>
        </label>
      )}

      {data.type === "note" && (
        <>
          <label className="block text-sm font-medium text-gray-700">
            Kind of note
            <select className={`${FIELD} mt-1`} value={d.noteKind ?? "info"} onChange={(e) => onChange(nodeId, { noteKind: e.target.value } as Partial<WorkflowNodeData>)}>
              {NOTE_KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Place it beside
            <select className={`${FIELD} mt-1`} value={d.attachTo ?? ""} onChange={(e) => onChange(nodeId, { attachTo: e.target.value || undefined } as Partial<WorkflowNodeData>)}>
              <option value="">No particular step</option>
              {otherSteps.map((s) => <option key={s.id} value={s.id}>{s.number ? `${s.number}. ` : ""}{s.label}</option>)}
            </select>
            <span className="mt-1 block text-xs font-normal text-gray-500">The heading is the step name above; the text goes in Notes.</span>
          </label>
        </>
      )}
    </div>
  );
}
