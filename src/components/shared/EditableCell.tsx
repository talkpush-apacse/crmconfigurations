"use client";

import { useState, useRef, useEffect, useMemo } from "react";
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
}

export function EditableCell({ value, type, options, onChange, className, placeholder, validation }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(String(value ?? ""));
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalValue(String(value ?? ""));
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const validationError = useMemo(() => {
    if (!validation || !localValue) return null;
    const rule = VALIDATION_RULES[validation];
    if (!rule.regex.test(localValue)) return rule.message;
    return null;
  }, [validation, localValue]);

  if (type === "readonly") {
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

  if (type === "dropdown" && options) {
    return (
      <Select value={String(value || "")} onValueChange={(v) => onChange(v)}>
        <SelectTrigger className={cn("h-9 text-sm", className)}>
          <SelectValue placeholder={placeholder || "Select..."} />
        </SelectTrigger>
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
    return (
      <Textarea
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => {
          if (localValue !== String(value ?? "")) onChange(localValue);
        }}
        placeholder={placeholder}
        className={cn("min-h-[80px] resize-y text-sm", className)}
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
      />
    );
  }

  // Default: text
  const wrapWithValidation = (content: React.ReactElement) => {
    if (!validationError) return content;
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs bg-red-50 text-red-700 border-red-200">
          <p className="text-xs">{validationError}</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  if (!editing) {
    return wrapWithValidation(
      <div
        className={cn(
          "cursor-text rounded px-2 py-2 text-sm hover:bg-yellow-50",
          !localValue && "text-muted-foreground",
          validationError && "ring-1 ring-red-400 bg-red-50/50",
          className
        )}
        onClick={() => setEditing(true)}
      >
        {localValue || placeholder || "Click to edit"}
      </div>
    );
  }

  return wrapWithValidation(
    <Input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (localValue !== String(value ?? "")) onChange(localValue);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          setEditing(false);
          if (localValue !== String(value ?? "")) onChange(localValue);
        }
        if (e.key === "Escape") {
          setEditing(false);
          setLocalValue(String(value ?? ""));
        }
      }}
      placeholder={placeholder}
      className={cn("h-9 text-sm", validationError && "border-red-400 focus-visible:ring-red-400", className)}
    />
  );
}
