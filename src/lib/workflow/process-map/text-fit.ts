import { PM, circled } from "./tokens";
import { actionTypeOf, personActs, roleBracket, shapeKindOf, tagOf, type ShapeKind } from "./model";
import { channelWhen } from "./channel";
import { hasInline, richWords, stripInline } from "./inline-text";

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

/**
 * Like wrapText, but keeps **bold** words bold. Text with no bold in it takes the plain path, so every existing diagram
 * wraps exactly as before. Words are placed with the same rule: as many per line as fit, long words hard-broken.
 */
export function wrapRuns(text: string, max: number, extra: Partial<Run> = {}): TextLine[] {
  if (!hasInline(text)) return wrapText(stripInline(text), max).map((t) => ({ runs: [{ text: t, ...extra }] }));
  const lines: { text: string; bold: boolean }[][] = [];
  let line: { text: string; bold: boolean }[] = [];
  let len = 0;
  const flush = () => {
    if (line.length) lines.push(line);
    line = [];
    len = 0;
  };
  for (const w of richWords(text)) {
    let word = w.text;
    while (word.length > max) {
      flush();
      lines.push([{ text: word.slice(0, max), bold: w.bold }]);
      word = word.slice(max);
    }
    if (len && len + 1 + word.length > max) flush();
    line.push({ text: word, bold: w.bold });
    len += (len ? 1 : 0) + word.length;
  }
  flush();
  return lines.map((words) => {
    const runs: Run[] = [];
    for (const w of words) {
      const last = runs[runs.length - 1];
      if (last && !!last.bold === w.bold) last.text += ` ${w.text}`;
      else runs.push({ text: last ? ` ${w.text}` : w.text, ...extra, ...(w.bold ? { bold: true } : {}) });
    }
    return { runs };
  });
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
    const width = stripInline(label).length > 70 ? 300 : S.decisionW;
    const max = Math.max(10, Math.floor((width * 0.56) / PM.type.charW));
    const text = wrapRuns(label, max);
    const head = numberRuns(numbers, null);
    if (head.length) lines.push({ runs: head });
    for (const t of text) lines.push(t);
    const count = lines.length;
    return { kind, width, height: Math.max(S.decisionH, 50 + count * PM.type.lineH * 1.25), lines, align: "center", badgeSpace: 0, badge: null, people: false };
  }

  if (kind === "start" || kind === "end") {
    const width = S.terminatorW;
    const text = wrapText(stripInline(label), charsPerLine(width));
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
    if (label) for (const t of wrapText(stripInline(label), max)) lines.push(plain(t, { bold: true }));
    if (notes) for (const t of wrapText(stripInline(notes), max)) lines.push(plain(t));
    return { kind, width, height: Math.max(56, 32 + lines.length * PM.type.lineH), lines, align: "center", badgeSpace: 0, badge: null, people: false };
  }

  // process boxes
  const width = S.processW;
  const max = charsPerLine(width);
  const lead = people ? roleBracket(node) : tagOf(node);
  const head = numberRuns(numbers, lead);
  if (head.length) lines.push({ runs: head });
  if (label) for (const t of wrapRuns(label, max)) lines.push(t);
  if (notes && notes !== label) for (const t of wrapText(stripInline(notes), max)) lines.push(plain(t, { size: 11 }));
  // "Channel · When" for automated messages, calls and alerts; for any other step, just its timing.
  const when = channelWhen(node);
  if (when) for (const t of wrapText(when, max)) lines.push(plain(t, { italic: true }));
  const height = Math.max(S.processMinH, 32 + lines.length * PM.type.lineH);
  const badge = people
    ? { icon: "Users", color: PM.colors.badgeSystem }
    : actionType
      ? { icon: ACTION_BADGE(actionType).icon, color: ACTION_BADGE(actionType).color }
      : null;
  return { kind, width, height, lines, align: "center", badgeSpace: badge ? S.badgeH + 6 : 0, badge, people };
}

import { ACTION_TYPES, type ActionType } from "./tokens";
function ACTION_BADGE(t: ActionType) {
  const a = ACTION_TYPES[t];
  return { icon: a.icon, color: a.group === "data" ? PM.colors.badgeData : PM.colors.badgeSystem };
}
