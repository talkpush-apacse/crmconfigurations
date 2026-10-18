"use client";

import { Columns3, Rows2, Rows3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { COLUMN_LABELS, OPTIONAL_COLUMNS, type Density, type ListPrefs, type OptionalColumn } from "@/lib/tracker/list-prefs";
import { cn } from "@/lib/utils";

interface Props {
  prefs: ListPrefs;
  onChange: (next: ListPrefs) => void;
  /** True when the list is sorted by a column and so has no phase headers: Phase is then always shown. */
  phaseForced: boolean;
}

const DENSITY_BUTTONS: { value: Density; label: string; Icon: typeof Rows3 }[] = [
  { value: "compact", label: "Compact", Icon: Rows3 },
  { value: "comfortable", label: "Comfortable", Icon: Rows2 },
];

/** Row density (compact or comfortable) and the column chooser. Table view only; phone cards ignore both. */
export function ListViewOptions({ prefs, onChange, phaseForced }: Props) {
  const toggleColumn = (c: OptionalColumn, on: boolean) => onChange({ ...prefs, columns: { ...prefs.columns, [c]: on } });
  return (
    <div className="hidden items-center gap-2 md:flex">
      <div role="group" aria-label="Row density" className="flex overflow-hidden rounded-md border border-input">
        {DENSITY_BUTTONS.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            aria-pressed={prefs.density === value}
            aria-label={label}
            title={label}
            onClick={() => onChange({ ...prefs, density: value })}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/70",
              prefs.density === value && "bg-secondary text-foreground"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        ))}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label="Choose columns" title="Choose columns">
            <Columns3 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Columns</DropdownMenuLabel>
          {OPTIONAL_COLUMNS.map((c) => {
            const forced = c === "phase" && phaseForced;
            return (
              <DropdownMenuCheckboxItem
                key={c}
                checked={forced || prefs.columns[c]}
                disabled={forced}
                onCheckedChange={(on) => toggleColumn(c, on === true)}
                // Keep the menu open so several columns can be switched in one go.
                onSelect={(e) => e.preventDefault()}
                className="cursor-pointer"
              >
                <span>
                  {COLUMN_LABELS[c]}
                  {forced && <span className="block text-xs text-muted-foreground">Shown while sorted by a column</span>}
                </span>
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
