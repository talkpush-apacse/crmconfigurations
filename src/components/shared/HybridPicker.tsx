"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface HybridPickerOption {
  value: string;
  label: string;
  group?: string;
}

interface HybridPickerProps {
  value: string;
  onChange: (value: string) => void;
  options: HybridPickerOption[];
  placeholder?: string;
  disabled?: boolean;
  warningBadge?: React.ReactNode;
}

function normalized(value: string) {
  return value.trim().toLowerCase();
}

export function HybridPicker({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  warningBadge,
}: HybridPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredOptions = useMemo(() => {
    const query = normalized(value);
    if (!query) return options;
    return options.filter((option) => {
      const haystack = `${option.label} ${option.value}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [options, value]);

  const hasExactMatch = options.some((option) => normalized(option.value) === normalized(value));
  const showCustom = value.trim() !== "" && !hasExactMatch;
  const selectableCount = filteredOptions.length + (showCustom ? 1 : 0);

  const selectValue = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    setActiveIndex(0);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.min(current + 1, Math.max(selectableCount - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      const selectedOption = filteredOptions[activeIndex];
      if (selectedOption) {
        selectValue(selectedOption.value);
      } else if (showCustom) {
        selectValue(value.trim());
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div className="flex min-w-[180px] items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Input
              value={value}
              disabled={disabled}
              placeholder={placeholder}
              onFocus={() => setOpen(true)}
              onClick={() => setOpen(true)}
              onChange={(event) => {
                onChange(event.target.value);
                setOpen(true);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              className="h-9 pr-8 text-sm"
              role="combobox"
              aria-expanded={open}
              aria-autocomplete="list"
            />
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          </div>
          {warningBadge}
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="z-50 max-h-[280px] min-w-[var(--radix-popover-trigger-width)] overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-lg"
        >
          {filteredOptions.length === 0 && !showCustom ? (
            <div className="px-2 py-2 text-sm text-muted-foreground">No options found</div>
          ) : (
            <>
              {filteredOptions.map((option, index) => {
                const showGroup = option.group && option.group !== filteredOptions[index - 1]?.group;
                return (
                  <div key={`${option.group ?? "ungrouped"}-${option.value}`}>
                    {showGroup && (
                      <div className="px-2 pb-1 pt-2 text-xs font-semibold uppercase text-gray-500">
                        {option.group}
                      </div>
                    )}
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectValue(option.value)}
                      className={cn(
                        "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-blue-50",
                        activeIndex === index && "bg-blue-50"
                      )}
                    >
                      <span className="min-w-0 truncate">{option.label}</span>
                      {normalized(value) === normalized(option.value) && (
                        <Check className="ml-2 h-4 w-4 shrink-0 text-blue-600" />
                      )}
                    </button>
                  </div>
                );
              })}
              {showCustom && (
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(filteredOptions.length)}
                  onClick={() => selectValue(value.trim())}
                  className={cn(
                    "mt-1 flex w-full items-center rounded border-t px-2 py-1.5 text-left text-sm text-blue-700 hover:bg-blue-50",
                    activeIndex === filteredOptions.length && "bg-blue-50"
                  )}
                >
                  Use custom: <span className="ml-1 min-w-0 truncate font-medium">&quot;{value.trim()}&quot;</span>
                </button>
              )}
            </>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
