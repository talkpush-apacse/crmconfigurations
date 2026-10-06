/**
 * Bold inside a step's text. A label can mark part of itself bold with **double asterisks**, for example
 * "Moves to **Expected to Show Up** Folder/Stage". The Process Map draws that part bold; every plain-text place
 * (flow table, CSV, outline, Mermaid, comparison) strips the markers so nobody sees stray asterisks.
 */

export interface RichWord {
  text: string;
  bold: boolean;
}

const BOLD = /\*\*([^*]+)\*\*/g;

/** The text with the bold markers removed. */
export function stripInline(text: string): string {
  return String(text ?? "").replace(BOLD, "$1");
}

export function hasInline(text: string): boolean {
  return /\*\*[^*]+\*\*/.test(String(text ?? ""));
}

/** Splits text into words, each remembering whether it sat inside ** **. A bold phrase of several words stays bold per word. */
export function richWords(text: string): RichWord[] {
  const words: RichWord[] = [];
  let last = 0;
  const source = String(text ?? "");
  const push = (chunk: string, bold: boolean) => {
    for (const word of chunk.split(/\s+/).filter(Boolean)) words.push({ text: word, bold });
  };
  for (const m of source.matchAll(BOLD)) {
    push(source.slice(last, m.index), false);
    push(m[1], true);
    last = (m.index ?? 0) + m[0].length;
  }
  push(source.slice(last), false);
  return words;
}

/** Folder/Stage wording for a step that moves a candidate. */
const MOVE_LABEL = /^(Moves?|Moved|Auto-?moves?|Automatically moves?)\s+to\s+(.+?)(?:\s+Folder\/Stage)?$/i;
/** A destination that runs on into something else ("...; sends the link", "... and notifies") is left alone. */
const MORE_THAN_A_NAME = /[;,.:()]|\s(?:and|then|with|while|after|when|if)\s/i;

/**
 * The default wording for a Move step: "Moves to **Expected to Show Up** Folder/Stage". Only a plain "Moves to <name>"
 * is rewritten; anything with more in it (a reminder cadence, "and sends ...") or already marked bold is returned as it is.
 */
export function moveStepLabel(label: string): string {
  const text = String(label ?? "").trim();
  if (!text || hasInline(text)) return text;
  const m = text.match(MOVE_LABEL);
  if (!m) return text;
  const name = m[2].trim();
  if (!name || MORE_THAN_A_NAME.test(name)) return text;
  return `${m[1]} to **${name}** Folder/Stage`;
}

/** True when a Move step's text names a destination but does not say Folder/Stage or does not bold the name. */
export function moveStepNeedsWording(label: string): boolean {
  const text = String(label ?? "").trim();
  if (!text) return false;
  if (!/^(Moves?|Moved|Auto-?moves?|Automatically moves?)\s+to\s+/i.test(text)) return false;
  return !(hasInline(text) && /Folder\/Stage/i.test(text));
}
