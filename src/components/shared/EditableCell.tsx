"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { ChevronDown, Pencil } from "lucide-react";
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

const VALIDATION_RULES: Record<ValidationType, { regex: RegExp; message: string }> = {
  email: { regex: /.+@.+\..+/, message: "Please enter a valid email address" },
  url: { regex: /^https?:\/\/.+/, message: "URL must start with http:// or https://" },
  phone: { regex: /\d{7,}/, message: "Phone number must have at least 7 digits" },
};

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
        {String(value || "—")}
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
        <TooltipContent side="bottom" className="max-w-xs bg-red-50 text-red-700 border-red-200">
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
              "flex h-9 w-full items-center justify-between gap-2 rounded-md border-[1.5px] border-[#BDBDBD] bg-white px-3 py-2 text-left text-sm shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-[border-color,box-shadow] duration-200 ease-in-out hover:border-[#9E9E9E]",
              !selected.length && "text-[#757575]",
              errorMessage && "border-red-400 bg-red-50/50",
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
              "h-9 text-sm",
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
    return wrapWithValidation(
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
          spreadsheetMode &&
            currentValue.trim() === "" &&
            "bg-slate-50/70 placeholder:text-[#9AA0A6]",
          errorMessage && "border-red-400 focus-visible:ring-red-400",
          className
        )}
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
      />
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
          "group flex cursor-text items-center justify-between rounded-md border-[1.5px] border-[#BDBDBD] bg-white px-3 py-2 text-sm shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-[border-color,box-shadow] duration-200 ease-in-out hover:border-[#9E9E9E]",
          !currentValue && "text-[#757575]",
          errorMessage && "border-red-400 bg-red-50/50",
          className
        )}
        onClick={() => {
          setDraftValue(committedValue);
          setEditing(true);
        }}
      >
        <span className="min-w-0 flex-1 truncate">
          {currentValue || placeholder || "Click to edit"}
        </span>
        <Pencil className="ml-2 h-3 w-3 shrink-0 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    );
  }

  return wrapWithValidation(
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
        "h-9 text-sm",
        // An unfilled cell reads as unfilled, rather than looking answered by
        // its own placeholder.
        spreadsheetMode && isEmpty && "bg-slate-50/70 placeholder:text-[#9AA0A6]",
        errorMessage && "border-red-400 focus-visible:ring-red-400",
        className
      )}
    />
  );
}
