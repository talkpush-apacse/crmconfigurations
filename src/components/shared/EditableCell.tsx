"use client";

import { useState, useRef, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Pencil, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useChecklistContext } from "@/lib/checklist-context";
import { parseClipboardGrid, useGridNav } from "./grid-nav";

type ValidationType = "email" | "url" | "phone";

/**
 * Tallest a textarea gets in a spreadsheet grid before it is cut off (about six lines).
 * Without a cap a long cell (an AI call script, a message template) makes its whole row
 * hundreds of pixels tall and pushes the row's short cells off screen. "Show all" lifts it.
 */
const GRID_TEXTAREA_MAX_PX = 144;

const VALIDATION_RULES: Record<ValidationType, { regex: RegExp; message: string }> = {
  email: { regex: /.+@.+\..+/, message: "Please enter a valid email address" },
  url: { regex: /^https?:\/\/.+/, message: "URL must start with http:// or https://" },
  phone: { regex: /(?:\D*\d){7,}/, message: "Phone number must have at least 7 digits" },
};

// Matches a markdown-style link `[label](url)`, e.g. text transcribed from a
// spreadsheet cell that had a hyperlink on part of its text — see
// normalizeCellValue in spreadsheet-infer.ts, which produces this same shape
// on import. A bare "https://..." run is also linkified, so a plain URL typed
// or pasted into a text cell becomes clickable without any special syntax.
const MARKDOWN_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/\S+)/g;

/** True as soon as a value has anything `renderTextWithLinks` would linkify. */
function hasLinkableContent(value: string): boolean {
  MARKDOWN_LINK_RE.lastIndex = 0;
  return MARKDOWN_LINK_RE.test(value);
}

/**
 * Renders plain text with any `[label](url)` or bare URL substrings turned
 * into real, clickable anchors — everything else stays as plain text. Used
 * for read-mode display only; editing still works on the underlying string.
 */
function renderTextWithLinks(value: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  MARKDOWN_LINK_RE.lastIndex = 0;
  let key = 0;

  while ((match = MARKDOWN_LINK_RE.exec(value)) !== null) {
    if (match.index > lastIndex) {
      parts.push(value.slice(lastIndex, match.index));
    }
    const [full, label, labeledHref, bareHref] = match;
    const href = labeledHref ?? bareHref;
    parts.push(
      <a
        key={`link-${key++}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-lavender-darker underline hover:opacity-80"
        onClick={(e) => e.stopPropagation()}
      >
        {label ?? full}
      </a>
    );
    lastIndex = match.index + full.length;
  }
  if (lastIndex < value.length) {
    parts.push(value.slice(lastIndex));
  }
  return parts;
}

interface EditableCellProps {
  value: string | boolean;
  type: "text" | "textarea" | "dropdown" | "multiselect" | "boolean" | "readonly";
  options?: string[];
  onChange: (value: string | boolean) => void;
  className?: string;
  placeholder?: string;
  validation?: ValidationType;
  required?: boolean;
  showRequiredError?: boolean;
  /**
   * Position in the main grid. When supplied, the cell joins keyboard
   * navigation and multi-cell paste. Detail-panel fields omit it.
   */
  gridRow?: number;
  gridCol?: number;
}

export function EditableCell({
  value,
  type,
  options,
  onChange,
  className,
  placeholder,
  validation,
  required = false,
  showRequiredError = false,
  gridRow,
  gridCol,
}: EditableCellProps) {
  const { isReadOnly } = useChecklistContext();
  const [draftValue, setDraftValue] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  // Escape blurs the input, and the blur handler would otherwise commit the
  // very draft Escape was meant to discard — state updates don't land before
  // the blur fires. This flag lets blur know the edit was cancelled.
  const cancelledRef = useRef(false);
  const committedValue = String(value ?? "");
  const currentValue = draftValue ?? committedValue;

  const grid = useGridNav();
  // Spreadsheet behaviours (live input, empty-cell tint, compact textarea)
  // follow the table's mode. Keyboard navigation and paste additionally need
  // grid coordinates, which only main-grid cells carry.
  const spreadsheetMode = grid?.spreadsheetMode ?? false;
  const inGrid =
    spreadsheetMode && grid !== null && gridRow !== undefined && gridCol !== undefined;
  const [editing, setEditing] = useState(false);
  // Grid textareas stop growing at GRID_TEXTAREA_MAX_PX; `expanded` lifts the cap for this cell.
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  // Register with the grid so navigation and paste can reach this cell.
  useEffect(() => {
    if (!inGrid) return;
    const el = inputRef.current;
    grid!.registerCell(gridRow!, gridCol!, el);
    return () => grid!.registerCell(gridRow!, gridCol!, null);
  }, [inGrid, grid, gridRow, gridCol]);

  // Does the text need more than the cap? scrollHeight is the full content height whether or not
  // the cap is applied, so one check covers both the cut-off and the expanded state.
  useEffect(() => {
    if (!inGrid || type !== "textarea") return;
    const el = inputRef.current;
    if (!el) return;
    const measure = () => setOverflowing(el.scrollHeight > GRID_TEXTAREA_MAX_PX + 2);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [inGrid, type, currentValue]);

  const requiredError = useMemo(() => {
    if (!required || !showRequiredError || currentValue.trim() !== "") return null;
    return `${placeholder || "This field"} is required`;
  }, [required, showRequiredError, currentValue, placeholder]);

  const validationError = useMemo(() => {
    if (!validation || !currentValue) return null;
    const rule = VALIDATION_RULES[validation];
    if (!rule.regex.test(currentValue)) return rule.message;
    return null;
  }, [validation, currentValue]);

  const errorMessage = requiredError ?? validationError;

  const commitDraftValue = useCallback(() => {
    const nextValue = draftValue ?? committedValue;
    setDraftValue(null);
    if (nextValue !== committedValue) onChange(nextValue);
  }, [draftValue, committedValue, onChange]);

  /** Commits on blur, unless the edit was cancelled with Escape. */
  const handleBlur = useCallback(() => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setDraftValue(null);
      return;
    }
    commitDraftValue();
  }, [commitDraftValue]);

  /**
   * Spreadsheet key handling. Vertical arrows move between rows (they do
   * nothing useful inside a single-line input), Enter commits and moves down,
   * Escape reverts. Tab/Shift+Tab are left to the browser, which already walks
   * the inputs in row-major order, and Left/Right stay as caret movement.
   */
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        cancelledRef.current = true;
        setDraftValue(null);
        e.currentTarget.blur();
        return;
      }

      if (!inGrid) {
        if (e.key === "Enter" && e.currentTarget instanceof HTMLInputElement) {
          commitDraftValue();
        }
        return;
      }

      const move = (direction: "up" | "down") => {
        // Commit before moving so the next cell doesn't read a stale value.
        commitDraftValue();
        if (grid!.moveFocus(gridRow!, gridCol!, direction)) e.preventDefault();
      };

      if (e.key === "ArrowUp") {
        move("up");
      } else if (e.key === "ArrowDown") {
        move("down");
      } else if (e.key === "Enter") {
        // Shift+Enter goes up, matching Excel.
        move(e.shiftKey ? "up" : "down");
      }
    },
    [inGrid, grid, gridRow, gridCol, commitDraftValue]
  );

  /**
   * Pastes a block copied from a spreadsheet across cells. Falls through to the
   * browser's single-cell paste when the clipboard holds one plain value, or
   * when this table hasn't opted into batched edits.
   */
  const handleGridPaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!inGrid || !grid!.canPasteGrid) return;
      const text = e.clipboardData.getData("text/plain");
      const parsed = parseClipboardGrid(text);
      if (!parsed) return;
      if (grid!.pasteGrid(gridRow!, gridCol!, parsed)) {
        e.preventDefault();
        // Drop any in-flight draft — the batched edit is the source of truth.
        setDraftValue(null);
      }
    },
    [inGrid, grid, gridRow, gridCol]
  );


  if (type === "readonly" || isReadOnly) {
    if (type === "boolean") {
      return (
        <div className={cn("flex items-center justify-center px-2 py-1.5", className)}>
          <Checkbox checked={value === true || value === "true" || value === "Yes"} disabled />
        </div>
      );
    }
    return (
      <div className={cn("px-2 py-1.5 text-sm text-muted-foreground", className)}>
        {String(value || "Not set")}
      </div>
    );
  }

  if (type === "boolean") {
    return (
      <div className={cn("flex items-center justify-center px-2 py-1.5", className)}>
        <Checkbox
          checked={value === true || value === "true" || value === "Yes"}
          onCheckedChange={(checked) => onChange(!!checked)}
        />
      </div>
    );
  }

  const wrapWithValidation = (content: React.ReactElement) => {
    if (!errorMessage) return content;
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs border-destructive/30 bg-destructive/10 text-destructive">
          <p className="text-xs">{errorMessage}</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  // Multi-select is stored comma-joined so a cell value stays a plain string —
  // no widening of the shared `string | boolean` cell contract.
  if (type === "multiselect") {
    const selected = committedValue
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const selectedSet = new Set(selected.map((v) => v.toLowerCase()));

    const toggleOption = (option: string) => {
      const next = selectedSet.has(option.toLowerCase())
        ? selected.filter((v) => v.toLowerCase() !== option.toLowerCase())
        : [...selected, option];
      // Emit in the order the options were declared, so cells stay comparable.
      const ordered = options?.length
        ? options.filter((o) => next.some((n) => n.toLowerCase() === o.toLowerCase()))
        : next;
      onChange(ordered.join(", "));
    };

    return (
      <DropdownMenu>
        {wrapWithValidation(
          <DropdownMenuTrigger
            aria-invalid={!!errorMessage}
            className={cn(
              "cf-box flex h-11 w-full items-center justify-between gap-2 rounded-md border border-muted-foreground/40 bg-white px-3 py-2 text-left text-sm transition-[border-color,box-shadow] duration-200 ease-in-out hover:border-muted-foreground/60 md:h-9",
              !selected.length && "text-muted-foreground",
              errorMessage && "border-destructive bg-destructive/5",
              className
            )}
          >
            <span className="min-w-0 flex-1 truncate">
              {selected.length ? selected.join(", ") : placeholder || "Select..."}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          </DropdownMenuTrigger>
        )}
        <DropdownMenuContent align="start" className="max-h-64 w-56 overflow-y-auto p-1">
          {options?.length ? (
            options.map((opt) => (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={selectedSet.has(opt.toLowerCase())}
                  onCheckedChange={() => toggleOption(opt)}
                />
                <span className="min-w-0 flex-1 truncate">{opt}</span>
              </label>
            ))
          ) : (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              No options defined for this column.
            </p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (type === "dropdown" && options) {
    return (
      <Select value={String(value || "")} onValueChange={(v) => onChange(v)}>
        {wrapWithValidation(
          <SelectTrigger
            aria-invalid={!!errorMessage}
            className={cn(
              "h-11 text-sm data-[size=default]:h-11 md:h-9 md:data-[size=default]:h-9",
              errorMessage && "border-red-400 focus-visible:ring-red-400",
              className
            )}
          >
            <SelectValue placeholder={placeholder || "Select..."} />
          </SelectTrigger>
        )}
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (type === "textarea") {
    const clamped = inGrid && !expanded;
    const textarea = wrapWithValidation(
      <Textarea
        value={currentValue}
        onChange={(e) => setDraftValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleGridKeyDown}
        onPaste={handleGridPaste}
        placeholder={placeholder}
        aria-invalid={!!errorMessage}
        className={cn(
          // Compact in the grid, roomy in a detail panel.
          inGrid ? "min-h-[36px] resize-y text-sm" : "min-h-[80px] resize-y text-sm",
          clamped && "overflow-y-auto",
          spreadsheetMode &&
            currentValue.trim() === "" &&
            "bg-muted/50 placeholder:text-muted-foreground/70",
          errorMessage && "border-red-400 focus-visible:ring-red-400",
          className
        )}
        style={clamped ? { maxHeight: GRID_TEXTAREA_MAX_PX } : undefined}
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
      />
    );
    if (!inGrid) return textarea;
    return (
      <div>
        {textarea}
        {(overflowing || expanded) && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="mt-1 inline-flex min-h-7 items-center gap-1 rounded px-1 text-xs font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? "Show less" : "Show all"}
          </button>
        )}
      </div>
    );
  }

  // Default: text.
  //
  // In spreadsheet mode this is always a live input: a click-to-edit gate
  // costs a second interaction per cell and makes Tab skip the cell entirely.
  // Tabs that did not opt in keep the original click-to-edit affordance.
  const isEmpty = currentValue.trim() === "";

  if (!spreadsheetMode && !editing) {
    return wrapWithValidation(
      <div
        className={cn(
          "cf-box group flex min-h-11 cursor-text items-center justify-between rounded-md border border-muted-foreground/40 bg-white px-3 py-2 text-sm transition-[border-color,box-shadow] duration-200 ease-in-out hover:border-muted-foreground/60 md:min-h-0",
          !currentValue && "text-muted-foreground",
          errorMessage && "border-destructive bg-destructive/5",
          className
        )}
        onClick={() => {
          setDraftValue(committedValue);
          setEditing(true);
        }}
      >
        <span className="min-w-0 flex-1 truncate">
          {currentValue
            ? hasLinkableContent(currentValue)
              ? renderTextWithLinks(currentValue)
              : currentValue
            : placeholder || "Click to edit"}
        </span>
        <Pencil className="ml-2 h-3 w-3 shrink-0 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    );
  }

  // A URL-validated field is usually a live input the user still needs to
  // edit, so it can't become a plain anchor the way the read-only text box
  // above does — instead, a small button alongside it opens the link.
  const canOpenAsLink = validation === "url" && !validationError && currentValue.trim() !== "";

  return wrapWithValidation(
    <div className="flex items-center gap-1">
      <Input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        value={currentValue}
        onChange={(e) => setDraftValue(e.target.value)}
        onBlur={() => {
          setEditing(false);
          handleBlur();
        }}
        onKeyDown={(e) => {
          // Outside spreadsheet mode, Enter/Escape close the editor rather than
          // moving between rows.
          if (!spreadsheetMode && (e.key === "Enter" || e.key === "Escape")) {
            setEditing(false);
          }
          handleGridKeyDown(e);
        }}
        onPaste={handleGridPaste}
        placeholder={placeholder}
        aria-invalid={!!errorMessage}
        className={cn(
          "h-11 text-sm md:h-9",
          // An unfilled cell reads as unfilled, rather than looking answered by
          // its own placeholder.
          spreadsheetMode && isEmpty && "bg-muted/50 placeholder:text-muted-foreground/70",
          errorMessage && "border-red-400 focus-visible:ring-red-400",
          className
        )}
      />
      {canOpenAsLink && (
        <a
          href={currentValue}
          target="_blank"
          rel="noopener noreferrer"
          title="Open link"
          className="flex size-11 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-brand-lavender-darker md:size-9"
          onMouseDown={(e) => e.preventDefault()}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}
