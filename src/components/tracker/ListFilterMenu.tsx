"use client";

import { useSyncExternalStore } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface FilterOption {
  value: string;
  label: string;
  /** How many items this choice would show, when known. */
  count?: number;
}

/** One pick-one filter: Status, Owner, Phase or Due. The first option is the "no filter" choice. */
export interface FilterCategory {
  key: string;
  /** Menu heading and chip prefix, e.g. "Owner". */
  label: string;
  value: string;
  defaultValue: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}

/** An on/off filter such as "Needs attention". */
export interface FilterToggle {
  key: string;
  label: string;
  on: boolean;
  count: number;
  onChange: (on: boolean) => void;
}

interface Props {
  categories: FilterCategory[];
  toggles: FilterToggle[];
  /** Also clears the search box; the menu only shows the entry while something is active. */
  onClearAll: () => void;
}

interface Chip {
  key: string;
  label: string;
  remove: () => void;
}

/** One removable chip per filter that is not at its "no filter" value. */
export function activeChips(categories: FilterCategory[], toggles: FilterToggle[]): Chip[] {
  const chips: Chip[] = [];
  for (const c of categories) {
    if (c.value === c.defaultValue) continue;
    const label = c.options.find((o) => o.value === c.value)?.label ?? c.value;
    chips.push({ key: c.key, label: `${c.label}: ${label}`, remove: () => c.onChange(c.defaultValue) });
  }
  for (const t of toggles) if (t.on) chips.push({ key: t.key, label: t.label, remove: () => t.onChange(false) });
  return chips;
}

const PHONE_QUERY = "(max-width: 639px)";
function subscribePhone(onChange: () => void) {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
/** True on a phone-sized screen, where a side-by-side submenu would run off the edge. */
function usePhone() {
  return useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false
  );
}

/** One Filter button with a two-level menu: pick a category, then a value. Replaces the four dropdowns. */
export function ListFilterMenu({ categories, toggles, onClearAll }: Props) {
  const active = activeChips(categories, toggles).length;
  const phone = usePhone();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" aria-label={active > 0 ? `Filter, ${active} active` : "Filter"} className={active > 0 ? "bg-secondary" : undefined}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filter
          {active > 0 && (
            <span aria-hidden="true" className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-foreground px-1.5 text-[11px] font-bold text-background">
              {active}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {categories.map((c) => {
          const current = c.options.find((o) => o.value === c.value);
          return (
            <DropdownMenuSub key={c.key}>
              <DropdownMenuSubTrigger className="min-h-11 md:min-h-9">
                <span>{c.label}</span>
                <span className="ml-auto max-w-24 truncate text-xs text-muted-foreground">{c.value !== c.defaultValue ? current?.label : ""}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent sideOffset={phone ? -176 : 0} collisionPadding={8} className="max-h-80 w-56 overflow-y-auto">
                  <DropdownMenuRadioGroup value={c.value} onValueChange={c.onChange}>
                    {c.options.map((o) => (
                      <DropdownMenuRadioItem key={o.value} value={o.value} className="min-h-11 cursor-pointer md:min-h-8">
                        <span className="min-w-0 flex-1 truncate">{o.label}</span>
                        {o.count !== undefined && <span className="ml-2 text-xs tabular-nums text-muted-foreground">{o.count}</span>}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          );
        })}
        {toggles.length > 0 && <DropdownMenuSeparator />}
        {toggles.map((t) => (
          <DropdownMenuCheckboxItem key={t.key} checked={t.on} onCheckedChange={t.onChange} className="min-h-11 cursor-pointer md:min-h-9">
            <span className="flex-1">{t.label}</span>
            <span className="ml-2 text-xs tabular-nums text-muted-foreground">{t.count}</span>
          </DropdownMenuCheckboxItem>
        ))}
        {active > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onClearAll} className="min-h-11 cursor-pointer font-medium md:min-h-9">
              Clear all filters
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The active filters as chips you can remove one at a time. */
export function FilterChips({ categories, toggles }: Pick<Props, "categories" | "toggles">) {
  const chips = activeChips(categories, toggles);
  if (chips.length === 0) return null;
  return (
    <ul className="contents" aria-label="Active filters">
      {chips.map((c) => (
        <li key={c.key} className="inline-flex h-8 max-w-full items-center rounded-full border border-foreground bg-card pl-3 text-sm max-md:min-h-11">
          <span className="truncate">{c.label}</span>
          <button
            type="button"
            onClick={c.remove}
            aria-label={`Remove filter ${c.label}`}
            className="inline-flex h-full w-8 items-center justify-center rounded-r-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/70 max-md:w-11"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
