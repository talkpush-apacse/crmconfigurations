"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface EditableCellProps {
  value: string | boolean;
  type: "text" | "textarea" | "dropdown" | "boolean" | "readonly";
  options?: string[];
  onChange: (value: string | boolean) => void;
  className?: string;
  placeholder?: string;
}

export function EditableCell({ value, type, options, onChange, className, placeholder }: EditableCellProps) {
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
        <SelectTrigger className={cn("h-8 text-sm", className)}>
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
        className={cn("min-h-[60px] resize-y text-sm", className)}
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
      />
    );
  }

  // Default: text
  if (!editing) {
    return (
      <div
        className={cn(
          "cursor-text rounded px-2 py-1.5 text-sm hover:bg-yellow-50",
          !localValue && "text-muted-foreground",
          className
        )}
        onClick={() => setEditing(true)}
      >
        {localValue || placeholder || "Click to edit"}
      </div>
    );
  }

  return (
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
      className={cn("h-8 text-sm", className)}
    />
  );
}
