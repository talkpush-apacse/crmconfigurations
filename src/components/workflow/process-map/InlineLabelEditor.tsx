"use client";

import { useEffect, useRef } from "react";
import { Bold, Italic, Underline } from "lucide-react";
import { readRichValue, richToHtml } from "../RichNotesField";

/**
 * Edit a step's text right on the diagram. Opens on double-click, sits over the step (so it zooms with the canvas),
 * and has Bold / Italic / Underline buttons (or Cmd/Ctrl + B, I, U). Enter or clicking away saves, Esc cancels.
 * The text is one line of words (it wraps by itself); underneath it is the same light markers Notes use.
 *
 * A note box has two texts, a bold title and the notes under it, so it passes `notes` and gets a second field:
 * Tab moves between the two, Shift + Enter starts a new line in the notes, and Enter saves both.
 */

const BUTTONS = [
  ["bold", Bold, "Bold (Ctrl/⌘ + B)"],
  ["italic", Italic, "Italic (Ctrl/⌘ + I)"],
  ["underline", Underline, "Underline (Ctrl/⌘ + U)"],
] as const;

const oneLine = (s: string) => s.replace(/\s*\n\s*/g, " ").trim();

export function InlineLabelEditor({
  value,
  notes,
  width,
  minHeight,
  notesMinHeight = 72,
  font,
  fontSize,
  onCommit,
  onCancel,
}: {
  value: string;
  /** Pass the notes text (even empty) to edit it too, under the title. */
  notes?: string;
  width: number;
  minHeight: number;
  notesMinHeight?: number;
  font: string;
  fontSize: number;
  onCommit: (label: string, notes?: string) => void;
  onCancel: () => void;
}) {
  const withNotes = notes !== undefined;
  const ref = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLDivElement | null>(null);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = richToHtml(value);
    if (notesRef.current) notesRef.current.innerHTML = richToHtml(notes ?? "");
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
    const label = el ? oneLine(readRichValue(el)) : "";
    if (!withNotes) {
      if (save && label && label !== value) onCommit(label);
      else onCancel();
      return;
    }
    const nextNotes = notesRef.current ? readRichValue(notesRef.current).trim() : "";
    // A note needs some text, but either part may be empty. Nothing changed means nothing to save.
    if (save && (label || nextNotes) && (label !== value || nextNotes !== (notes ?? "").trim())) onCommit(label, nextNotes);
    else onCancel();
  };

  const format = (command: "bold" | "italic" | "underline") => {
    (lastFocused.current ?? ref.current)?.focus();
    document.execCommand(command);
  };

  const fieldKeys = (multiline: boolean) => (e: React.KeyboardEvent) => {
    // Typing here is not a diagram shortcut (F to fit, Delete, and so on).
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      finish(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (multiline && e.shiftKey) document.execCommand("insertLineBreak");
      else finish(true);
    }
  };

  const onPaste = (multiline: boolean) => (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, multiline ? text.replace(/\r\n?/g, "\n") : text.replace(/\s*\r?\n\s*/g, " "));
  };

  return (
    // nodrag / nopan / nowheel keep React Flow from dragging the step or panning the canvas while you type.
    <div className="nodrag nopan nowheel pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
      <div
        ref={boxRef}
        className="pointer-events-auto relative"
        style={{ width }}
        // Clicking in the text is not "select this step": that would open the side panel and pull the typing cursor away.
        onClick={(e) => e.stopPropagation()}
        // Moving between the title and the notes (or onto a format button) is not "clicking away".
        onBlur={(e) => {
          if (e.relatedTarget instanceof Node && boxRef.current?.contains(e.relatedTarget)) return;
          finish(true);
        }}
      >
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
        <span className="px-1.5 text-[11px] text-muted-foreground">
          {withNotes ? "Enter to save · Shift+Enter new line · Esc to cancel" : "Enter to save · Esc to cancel"}
        </span>
      </div>
      {withNotes ? (
        <div className="rounded-md border-2 border-dashed border-blue-600 bg-white shadow-lg" style={{ fontFamily: font, fontSize }}>
          <div
            ref={ref}
            role="textbox"
            aria-label="Note title"
            data-placeholder="Title"
            contentEditable
            suppressContentEditableWarning
            onFocus={(e) => (lastFocused.current = e.currentTarget)}
            onKeyDown={fieldKeys(false)}
            onPaste={onPaste(false)}
            onDoubleClick={(e) => e.stopPropagation()}
            style={{ minHeight }}
            className="block w-full whitespace-pre-wrap break-words px-3 pb-1 pt-3 text-center font-bold leading-[18px] text-slate-900 outline-none empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]"
          />
          <div
            ref={notesRef}
            role="textbox"
            aria-multiline="true"
            aria-label="Note text"
            data-placeholder="Notes"
            contentEditable
            suppressContentEditableWarning
            onFocus={(e) => (lastFocused.current = e.currentTarget)}
            onKeyDown={fieldKeys(true)}
            onPaste={onPaste(true)}
            onDoubleClick={(e) => e.stopPropagation()}
            style={{ minHeight: notesMinHeight }}
            className="block w-full whitespace-pre-wrap break-words border-t border-dashed border-blue-300 px-3 pb-3 pt-2 text-center leading-[18px] text-slate-900 outline-none empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]"
          />
        </div>
      ) : (
      <div
        ref={ref}
        role="textbox"
        aria-label="Step text"
        contentEditable
        suppressContentEditableWarning
        onFocus={(e) => (lastFocused.current = e.currentTarget)}
        onKeyDown={fieldKeys(false)}
        onPaste={onPaste(false)}
        onDoubleClick={(e) => e.stopPropagation()}
        style={{ minHeight, fontFamily: font, fontSize }}
        className="block w-full whitespace-pre-wrap break-words rounded-md border-2 border-dashed border-blue-600 bg-white px-3 py-3 text-center leading-[18px] text-slate-900 shadow-lg outline-none"
      />
      )}
      </div>
    </div>
  );
}
