"use client";

import { SELECTABLE_TABS, ALWAYS_ENABLED_SLUGS, getAllSelectableTabSlugs } from "@/lib/tab-config";
import {
  Building2,
  Users,
  Megaphone,
  MapPin,
  HelpCircle,
  MessageSquare,
  Link as LinkIcon,
  Folder,
  FileText,
  MessagesSquare,
  Camera,
  Phone,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2,
  Users,
  Megaphone,
  MapPin,
  HelpCircle,
  MessageSquare,
  Link: LinkIcon,
  Folder,
  FileText,
  MessagesSquare,
  Camera,
  Phone,
  Briefcase,
};

interface TabSelectorProps {
  selectedTabs: string[];
  onChange: (tabs: string[]) => void;
}

export function TabSelector({ selectedTabs, onChange }: TabSelectorProps) {
  const allSelected = selectedTabs.length === SELECTABLE_TABS.length;

  const toggleAll = () => {
    onChange(allSelected ? [] : getAllSelectableTabSlugs());
  };

  const toggleTab = (slug: string) => {
    if (selectedTabs.includes(slug)) {
      onChange(selectedTabs.filter((s) => s !== slug));
    } else {
      onChange([...selectedTabs, slug]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Enabled Tabs</p>
        <Button type="button" variant="ghost" size="sm" onClick={toggleAll}>
          {allSelected ? "Deselect All" : "Select All"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {/* Always-enabled tabs (shown as disabled) */}
        {ALWAYS_ENABLED_SLUGS.map((slug) => (
          <label
            key={slug}
            className="flex cursor-not-allowed items-center gap-2 rounded-lg border bg-gray-50 px-3 py-2 text-sm opacity-60"
          >
            <input type="checkbox" checked disabled className="h-4 w-4" />
            <span className="text-muted-foreground">
              {slug === "welcome" ? "Welcome" : "Read Me - How To Use"}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">Always on</span>
          </label>
        ))}

        {/* Selectable tabs */}
        {SELECTABLE_TABS.map((tab) => {
          const Icon = iconMap[tab.icon];
          const isChecked = selectedTabs.includes(tab.slug);

          return (
            <label
              key={tab.slug}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                isChecked
                  ? "border-primary/50 bg-primary/5"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleTab(tab.slug)}
                className="h-4 w-4"
              />
              {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <span>{tab.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
