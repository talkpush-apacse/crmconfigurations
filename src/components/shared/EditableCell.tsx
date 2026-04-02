"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useChecklistContext } from "@/lib/checklist-context";

type ValidationType = "email" | "url" | "phone";

const VALIDATION_RULES: Record<ValidationType, { regex: RegExp; message: string }> = {
  email: { regex: /.+@.+\..+/, message: "Please enter a valid email address" },
  url: { regex: /^https?:\/\/.+/, message: "URL must start with http:// or https://" },
  phone: { regex: /\d{7,}/, message: "Phone number must have at least 7 digits" },
};

interface EditableCellProps {
  value: string | boolean;
  type: "text" | "textarea" | "dropdown" | "boolean" | "readonly";
  options?: string[];
  onChange: (value: string | boolean) => void;
  className?: string;
  placeholder?: string;
  validation?: ValidationType;
  required?: boolean;
  showRequiredError?: boolean;
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
}: EditableCellProps) {
  const { isReadOnly } = useChecklistContext();
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const committedValue = String(value ?? "");
  const currentValue = draftValue ?? committedValue;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

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

  const commitDraftValue = () => {
    const nextValue = draftValue ?? committedValue;
    setDraftValue(null);
    if (nextValue !== committedValue) onChange(nextValue);
  };

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
        onBlur={() => {
          commitDraftValue();
        }}
        placeholder={placeholder}
        aria-invalid={!!errorMessage}
        className={cn(
          "min-h-[80px] resize-y text-sm",
          errorMessage && "border-red-400 focus-visible:ring-red-400",
          className
        )}
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
      />
    );
  }

  // Default: text
  if (!editing) {
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
        <span className="min-w-0 flex-1 truncate">{currentValue || placeholder || "Click to edit"}</span>
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
        commitDraftValue();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          setEditing(false);
          commitDraftValue();
        }
        if (e.key === "Escape") {
          setEditing(false);
          setDraftValue(null);
        }
      }}
      placeholder={placeholder}
      aria-invalid={!!errorMessage}
      className={cn("h-9 text-sm", errorMessage && "border-red-400 focus-visible:ring-red-400", className)}
    />
  );
}
