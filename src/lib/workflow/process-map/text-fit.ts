import { PM, circled } from "./tokens";
import { actionTypeOf, personActs, roleBracket, shapeKindOf, tagOf, type ShapeKind } from "./model";

/**
 * Text and box sizes, worked out from a formula instead of measuring the screen. That is what keeps a diagram
 * identical on the server, on every screen and in every export (the Lucid skill's rule: boxes of one kind share one
 * size; text never shrinks to fit).
 *   characters per line = floor((width - 32) / 7)        box height = 32 + 18 x lines
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  muted?: boolean;
  size?: number;
}
export interface TextLine {
  runs: Run[];
}

export interface NodeNumbers {
  /** Main-path number, drawn circled. */
  spine?: number;
  /** Branch number such as "5.1", drawn small and muted after the tag. */
  branch?: string;
  /** For a jump marker: the number of the step it points at ("9" or "9.1"). */
  jumpTarget?: string;
}

export interface BoxSpec {
  kind: ShapeKind;
  width: number;
  height: number;
  lines: TextLine[];
  /** Vertical alignment of the text block. */
  align: "top" | "center";
  /** Space above the box taken by the icon badge. */
  badgeSpace: number;
  badge: { icon: string; color: string } | null;
  people: boolean;
}

/** Splits text into lines of at most `max` characters, breaking on spaces and hard-breaking very long words. */
export function wrapText(text: string, max: number): string[] {
  const out: string[] = [];
  for (const paragraph of String(text ?? "").split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (let word of words) {
      while (word.length > max) {
        if (line) {
          out.push(line);
          line = "";
        }
        out.push(word.slice(0, max));
        word = word.slice(max);
      }
      if (!line) line = word;
      else if (line.length + 1 + word.length <= max) line += ` ${word}`;
      else {
        out.push(line);
        line = word;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

export const charsPerLine = (width: number, pad: number = PM.type.pad) => Math.max(8, Math.floor((width - 2 * pad) / PM.type.charW));

function numberRuns(numbers: NodeNumbers, lead: string | null): Run[] {
  const runs: Run[] = [];
  if (numbers.spine !== undefined) runs.push({ text: circled(numbers.spine), bold: true, size: 15 });
  if (lead) runs.push({ text: runs.length ? ` ${lead}` : lead, bold: true });
  if (numbers.branch) runs.push({ text: runs.length ? ` ${numbers.branch}` : numbers.branch, muted: true, size: 9 });
  return runs;
}

const plain = (text: string, extra: Partial<Run> = {}): TextLine => ({ runs: [{ text, ...extra }] });

/** The size and content of one step in the Process Map style. */
export function boxFor(node: any, numbers: NodeNumbers = {}): BoxSpec {
  const kind = shapeKindOf(node);
  const d = node?.data ?? {};
  const label = String(d.label ?? "").trim();
  const notes = String(d.notes ?? "").trim();
  const actionType = actionTypeOf(node);
  const people = kind === "process" && personActs(node);
  const lines: TextLine[] = [];
  const S = PM.size;

  if (kind === "decision") {
    const width = label.length > 70 ? 300 : S.decisionW;
    const max = Math.max(10, Math.floor((width * 0.56) / PM.type.charW));
    const text = wrapText(label, max);
    const head = numberRuns(numbers, null);
    if (head.length) lines.push({ runs: head });
    for (const t of text) lines.push(plain(t));
    const count = lines.length;
    return { kind, width, height: Math.max(S.decisionH, 50 + count * PM.type.lineH * 1.25), lines, align: "center", badgeSpace: 0, badge: null, people: false };
  }

  if (kind === "start" || kind === "end") {
    const width = S.terminatorW;
    const text = wrapText(label, charsPerLine(width));
    for (const t of text) lines.push(plain(t, { bold: kind === "end" }));
    return { kind, width, height: Math.max(S.terminatorH, 24 + text.length * PM.type.lineH), lines, align: "center", badgeSpace: 0, badge: null, people: false };
  }

  if (kind === "jump") {
    const text = d.jumpText ? String(d.jumpText) : numbers.jumpTarget ? `→ Go to step ${numbers.jumpTarget.includes(".") ? numbers.jumpTarget : circled(Number(numbers.jumpTarget))}` : "→ Go to step";
    return { kind, width: S.jumpD, height: S.jumpD, lines: wrapText(text, 10).map((t) => plain(t, { size: 10 })), align: "center", badgeSpace: 0, badge: null, people: false };
  }

  if (kind === "note") {
    const width = S.noteW;
    const max = charsPerLine(width);
    if (label) for (const t of wrapText(label, max)) lines.push(plain(t, { bold: true }));
    if (notes) for (const t of wrapText(notes, max)) lines.push(plain(t));
    return { kind, width, height: Math.max(56, 32 + lines.length * PM.type.lineH), lines, align: "top", badgeSpace: 0, badge: null, people: false };
  }

  // process boxes
  const width = S.processW;
  const max = charsPerLine(width);
  const lead = people ? roleBracket(node) : tagOf(node);
  const head = numberRuns(numbers, lead);
  if (head.length) lines.push({ runs: head });
  if (label) for (const t of wrapText(label, max)) lines.push(plain(t));
  if (notes && notes !== label) for (const t of wrapText(notes, max)) lines.push(plain(t, { size: 11 }));
  if (d.timing) for (const t of wrapText(String(d.timing), max)) lines.push(plain(t, { italic: true }));
  const height = Math.max(S.processMinH, 32 + lines.length * PM.type.lineH);
  const badge = people
    ? { icon: "Users", color: PM.colors.badgeSystem }
    : actionType
      ? { icon: ACTION_BADGE(actionType).icon, color: ACTION_BADGE(actionType).color }
      : null;
  return { kind, width, height, lines, align: "top", badgeSpace: badge ? S.badgeH + 6 : 0, badge, people };
}

import { ACTION_TYPES, type ActionType } from "./tokens";
function ACTION_BADGE(t: ActionType) {
  const a = ACTION_TYPES[t];
  return { icon: a.icon, color: a.group === "data" ? PM.colors.badgeData : PM.colors.badgeSystem };
}
