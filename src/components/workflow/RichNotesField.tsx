"use client";

import { useEffect, useRef } from "react";
import { Bold, Italic, Underline } from "lucide-react";
import { parseRich, serializeRich, type RichSegment } from "@/lib/workflow/rich-text";

/**
 * A notes box with Bold / Italic / Underline (buttons, or Cmd/Ctrl + B, I, U). What you see is what readers see;
 * underneath it is saved as plain text with light markers (see lib/workflow/rich-text.ts).
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function toHtml(value: string): string {
  return parseRich(value)
    .map((s) => {
      let h = esc(s.text).replace(/\n/g, "<br>");
      if (s.bold) h = `<b>${h}</b>`;
      if (s.italic) h = `<i>${h}</i>`;
      if (s.underline) h = `<u>${h}</u>`;
      return h;
    })
    .join("");
}

/** Reads the box back into styled runs. Handles <b>/<i>/<u>, their CSS forms, <br> and the <div> lines some browsers add. */
function fromDom(root: HTMLElement): RichSegment[] {
  const out: RichSegment[] = [];
  type St = { bold: boolean; italic: boolean; underline: boolean };
  const NONE: St = { bold: false, italic: false, underline: false };
  const add = (text: string, st: St) => {
    if (text) out.push({ text, ...(st.bold ? { bold: true } : {}), ...(st.italic ? { italic: true } : {}), ...(st.underline ? { underline: true } : {}) });
  };
  const walk = (node: Node, st: St) => {
    if (node.nodeType === Node.TEXT_NODE) return add((node.textContent ?? "").replace(/ /g, " "), st);
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === "BR") return add("\n", NONE);
    const css = node.style;
    const next = {
      bold: st.bold || ["B", "STRONG"].includes(node.tagName) || css.fontWeight === "bold" || Number(css.fontWeight) >= 600,
      italic: st.italic || ["I", "EM"].includes(node.tagName) || css.fontStyle === "italic",
      underline: st.underline || node.tagName === "U" || css.textDecorationLine.includes("underline") || css.textDecoration.includes("underline"),
    };
    const block = node.tagName === "DIV" || node.tagName === "P";
    if (block && out.length && !out[out.length - 1].text.endsWith("\n")) add("\n", NONE);
    node.childNodes.forEach((c) => walk(c, next));
  };
  root.childNodes.forEach((c) => walk(c, NONE));
  // Browsers keep one empty <br> at the very end so the last empty line shows; it is not a real line.
  const last = out[out.length - 1];
  if (last && root.lastChild instanceof HTMLElement && root.lastChild.tagName === "BR" && last.text.endsWith("\n")) last.text = last.text.slice(0, -1);
  return out;
}

const readValue = (el: HTMLElement) => serializeRich(fromDom(el));

export function RichNotesField({
  value,
  onChange,
  onBlur,
  placeholder,
  maxLength,
  minRows = 3,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  maxLength?: number;
  minRows?: number;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Only rewrite the box when the value changed from outside (another step selected, undo, suggestion): never while typing.
  useEffect(() => {
    const el = ref.current;
    if (el && readValue(el) !== value) el.innerHTML = toHtml(value);
  }, [value]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const next = readValue(el);
    if (maxLength && next.length > maxLength) {
      el.innerHTML = toHtml(value);
      return;
    }
    onChange(next);
  };

  const format = (command: "bold" | "italic" | "underline") => {
    ref.current?.focus();
    document.execCommand(command);
    emit();
  };

  const btn = "inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="rounded-md border border-input bg-card focus-within:border-ring focus-within:ring-2 focus-within:ring-ring">
      <div className="flex items-center gap-0.5 border-b border-border px-1 py-0.5" role="toolbar" aria-label="Text formatting">
        {([["bold", Bold, "Bold (Ctrl/⌘ + B)"], ["italic", Italic, "Italic (Ctrl/⌘ + I)"], ["underline", Underline, "Underline (Ctrl/⌘ + U)"]] as const).map(([cmd, Icon, title]) => (
          <button key={cmd} type="button" className={btn} title={title} aria-label={title} onMouseDown={(e) => e.preventDefault()} onClick={() => format(cmd)}>
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label={label ?? "Notes"}
        data-placeholder={placeholder}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={onBlur}
        onKeyDown={(e) => {
          // One kind of line break everywhere, instead of the <div> lines some browsers add.
          if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            document.execCommand("insertLineBreak");
          }
        }}
        onPaste={(e) => {
          e.preventDefault();
          document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
        }}
        style={{ minHeight: `${minRows * 1.5 + 1}rem` }}
        className="w-full whitespace-pre-wrap break-words px-3 py-2 text-sm text-foreground outline-none empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
      />
    </div>
  );
}
