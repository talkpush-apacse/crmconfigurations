/**
 * Light text formatting for step Notes: **bold**, *italic* and __underline__, stored inside the same plain string
 * the Notes field has always been. No schema change; old notes, search, the connector and version history keep
 * working. A marker only counts when it is closed on both sides by a real character (so "5 * 3 * 2" and a lone
 * "*" stay as typed), and a backslash (\* or \_) types a marker character literally.
 */

export interface Style {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}
export interface RichSegment extends Style {
  text: string;
}

/** An invisible separator the editor drops between two markers that would otherwise touch (such as `*` then `**`). */
const SEP = "\u2060";
const KEY: Record<string, keyof Style> = { "**": "bold", "__": "underline", "*": "italic" };
const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c);

function findClose(text: string, marker: string, from: number): number {
  if (from >= text.length || isSpace(text[from])) return -1;
  for (let j = from; j < text.length; j++) {
    if (text[j] === "\\") {
      j++;
      continue;
    }
    if (!text.startsWith(marker, j) || isSpace(text[j - 1]) || j === from) continue;
    if (marker === "*" && (text[j + 1] === "*" || text[j - 1] === "*")) continue;
    return j;
  }
  return -1;
}

function sameStyle(a: Style, b: Style) {
  return !!a.bold === !!b.bold && !!a.italic === !!b.italic && !!a.underline === !!b.underline;
}

function push(out: RichSegment[], text: string, style: Style) {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && sameStyle(last, style)) last.text += text;
  else out.push({ text, ...(style.bold ? { bold: true } : {}), ...(style.italic ? { italic: true } : {}), ...(style.underline ? { underline: true } : {}) });
}

function parseInto(text: string, style: Style, out: RichSegment[]) {
  let buf = "";
  let i = 0;
  const flush = () => {
    push(out, buf, style);
    buf = "";
  };
  while (i < text.length) {
    const c = text[i];
    if (c === SEP) {
      i++;
      continue;
    }
    if (c === "\\" && (text[i + 1] === "*" || text[i + 1] === "_" || text[i + 1] === "\\")) {
      buf += text[i + 1];
      i += 2;
      continue;
    }
    const marker = text.startsWith("**", i) ? "**" : text.startsWith("__", i) ? "__" : c === "*" ? "*" : null;
    if (marker) {
      const close = findClose(text, marker, i + marker.length);
      if (close >= 0) {
        flush();
        parseInto(text.slice(i + marker.length, close), { ...style, [KEY[marker]]: true }, out);
        i = close + marker.length;
        continue;
      }
      // An unclosed marker stays as typed.
      buf += marker;
      i += marker.length;
      continue;
    }
    buf += c;
    i++;
  }
  flush();
}

/** Splits a note into runs of text, each with its own bold / italic / underline. Plain text gives one run. */
export function parseRich(input: string | null | undefined): RichSegment[] {
  const out: RichSegment[] = [];
  parseInto(String(input ?? ""), {}, out);
  return out;
}

/** The note as plain words, with the formatting markers removed. Use for search, spreadsheets and text summaries. */
export function stripRich(input: string | null | undefined): string {
  return parseRich(input)
    .map((s) => s.text)
    .join("");
}

function escapeLiteral(text: string): string {
  return text.replace(/\\(?=[*_\\])/g, "\\\\").replace(/\*/g, "\\*").replace(/__+/g, (m) => m.replace(/_/g, "\\_"));
}

/** The reverse of parseRich: turns styled runs back into the stored text. Edge spaces are kept outside the markers. */
export function serializeRich(segments: RichSegment[]): string {
  const merged: RichSegment[] = [];
  for (const s of segments) push(merged, s.text, s);

  // A marker must touch a real character, so spaces at the edge of a styled run become unstyled.
  const pieces: RichSegment[] = [];
  for (const s of merged) {
    if (!s.bold && !s.italic && !s.underline) {
      push(pieces, s.text, {});
      continue;
    }
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s.text) as RegExpExecArray;
    push(pieces, m[1], {});
    push(pieces, m[2], s);
    push(pieces, m[3], {});
  }

  const MARK = { underline: "__", bold: "**", italic: "*" } as const;
  const stack: (keyof typeof MARK)[] = [];
  let out = "";
  const mark = (k: keyof typeof MARK) => {
    if (out.endsWith(MARK[k][0])) out += SEP;
    out += MARK[k];
  };
  for (const seg of pieces) {
    const want = (["underline", "bold", "italic"] as const).filter((k) => seg[k]);
    const cut = stack.findIndex((k) => !want.includes(k));
    if (cut >= 0) {
      const reopen = stack.slice(cut).filter((k) => want.includes(k));
      while (stack.length > cut) mark(stack.pop() as keyof typeof MARK);
      for (const k of reopen) {
        mark(k);
        stack.push(k);
      }
    }
    for (const k of want) {
      if (!stack.includes(k)) {
        mark(k);
        stack.push(k);
      }
    }
    out += escapeLiteral(seg.text);
  }
  while (stack.length) mark(stack.pop() as keyof typeof MARK);
  return out;
}

/** One character with its style, used to wrap formatted text into lines. */
interface StyledChar {
  ch: string;
  s: Style;
}
export type RichRun = RichSegment;

/**
 * Wraps a formatted note into lines of at most `max` characters, the same way plain text wraps (breaks on spaces,
 * hard-breaks very long words, keeps blank lines), and returns each line as styled runs.
 */
export function wrapRich(input: string | null | undefined, max: number): RichRun[][] {
  const lines: StyledChar[][] = [];
  let cur: StyledChar[] = [];
  let word: StyledChar[] = [];

  const addWord = () => {
    let w = word;
    word = [];
    if (w.length === 0) return;
    while (w.length > max) {
      if (cur.length) {
        lines.push(cur);
        cur = [];
      }
      lines.push(w.slice(0, max));
      w = w.slice(max);
    }
    if (cur.length === 0) cur = w;
    else if (cur.length + 1 + w.length <= max) {
      const a = cur[cur.length - 1].s;
      const b = w[0].s;
      // The space between two words carries the style both words share, so bold or underline runs on unbroken.
      const shared: Style = { ...(a.bold && b.bold ? { bold: true } : {}), ...(a.italic && b.italic ? { italic: true } : {}), ...(a.underline && b.underline ? { underline: true } : {}) };
      cur = [...cur, { ch: " ", s: shared }, ...w];
    } else {
      lines.push(cur);
      cur = w;
    }
  };

  for (const seg of parseRich(input)) {
    for (const ch of seg.text) {
      if (ch === "\n" || ch === "\r") {
        if (ch === "\r") continue;
        addWord();
        lines.push(cur);
        cur = [];
      } else if (/\s/.test(ch)) addWord();
      else word.push({ ch, s: seg });
    }
  }
  addWord();
  if (cur.length) lines.push(cur);

  if (lines.length === 0) return [[{ text: "" }]];
  return lines.map((line) => {
    const runs: RichRun[] = [];
    for (const c of line) push(runs, c.ch, c.s);
    return runs.length ? runs : [{ text: "" }];
  });
}
