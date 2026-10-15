"use client";

import { useEffect, useRef } from "react";
import { Bold, Italic, Underline } from "lucide-react";
import { readRichValue, richToHtml } from "../RichNotesField";

/**
 * Edit a step's text right on the diagram. Opens on double-click, sits over the step (so it zooms with the canvas),
 * and has Bold / Italic / Underline buttons (or Cmd/Ctrl + B, I, U). Enter or clicking away saves, Esc cancels.
 * The text is one line of words (it wraps by itself); underneath it is the same light markers Notes use.
 */

const BUTTONS = [
  ["bold", Bold, "Bold (Ctrl/⌘ + B)"],
  ["italic", Italic, "Italic (Ctrl/⌘ + I)"],
  ["underline", Underline, "Underline (Ctrl/⌘ + U)"],
] as const;

export function InlineLabelEditor({
  value,
  width,
  minHeight,
  font,
  fontSize,
  onCommit,
  onCancel,
}: {
  value: string;
  width: number;
  minHeight: number;
  font: string;
  fontSize: number;
  onCommit: (next: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = richToHtml(value);
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // Set once when the editor opens; the text is the editor's own from then on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    const el = ref.current;
    const next = el ? readRichValue(el).replace(/\s*\n\s*/g, " ").trim() : "";
    if (save && next && next !== value) onCommit(next);
    else onCancel();
  };

  const format = (command: "bold" | "italic" | "underline") => {
    ref.current?.focus();
    document.execCommand(command);
  };

  return (
    // nodrag / nopan / nowheel keep React Flow from dragging the step or panning the canvas while you type.
    <div className="nodrag nopan nowheel pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
      <div className="pointer-events-auto relative" style={{ width }}>
      <div
        className="absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 items-center gap-0.5 whitespace-nowrap rounded-md border border-border bg-card px-1 py-0.5 shadow-md"
        role="toolbar"
        aria-label="Text formatting"
      >
        {BUTTONS.map(([cmd, Icon, title]) => (
          <button
            key={cmd}
            type="button"
            title={title}
            aria-label={title}
            // Keep the typing cursor in the text when a button is pressed.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => format(cmd)}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
        <span className="px-1.5 text-[11px] text-muted-foreground">Enter to save · Esc to cancel</span>
      </div>
      <div
        ref={ref}
        role="textbox"
        aria-label="Step text"
        contentEditable
        suppressContentEditableWarning
        onBlur={() => finish(true)}
        onKeyDown={(e) => {
          // Typing here is not a diagram shortcut (F to fit, Delete, and so on).
          e.stopPropagation();
          if (e.key === "Escape") {
            e.preventDefault();
            finish(false);
          } else if (e.key === "Enter") {
            e.preventDefault();
            finish(true);
          }
        }}
        onPaste={(e) => {
          e.preventDefault();
          document.execCommand("insertText", false, e.clipboardData.getData("text/plain").replace(/\s*\r?\n\s*/g, " "));
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        style={{ minHeight, fontFamily: font, fontSize }}
        className="block w-full whitespace-pre-wrap break-words rounded-md border-2 border-dashed border-blue-600 bg-white px-3 py-3 text-center leading-[18px] text-slate-900 shadow-lg outline-none"
      />
      </div>
    </div>
  );
}
