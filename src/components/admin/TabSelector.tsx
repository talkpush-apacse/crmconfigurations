"use client";

import { SELECTABLE_TABS, ALWAYS_ENABLED_SLUGS, TAB_CONFIG, getAllSelectableTabSlugs } from "@/lib/tab-config";
import {
  Home,
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
  Tags,
  ThumbsDown,
  PlugZap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Home,
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
  Tags,
  ThumbsDown,
  PlugZap,
};

interface TabSelectorProps {
  selectedTabs: string[];
  onChange: (tabs: string[]) => void;
}

export function TabSelector({ selectedTabs, onChange }: TabSelectorProps) {
  const allSelected = selectedTabs.length === SELECTABLE_TABS.length;
  const clientTabs = SELECTABLE_TABS.filter((tab) => tab.filledBy === "client");
  const talkpushTabs = SELECTABLE_TABS.filter((tab) => tab.filledBy === "talkpush");
  const alwaysEnabledTabs = TAB_CONFIG.filter((tab) =>
    ALWAYS_ENABLED_SLUGS.includes(tab.slug)
  );
  const alwaysEnabledByOwner = {
    client: alwaysEnabledTabs.filter((tab) => tab.filledBy === "client"),
    talkpush: alwaysEnabledTabs.filter((tab) => tab.filledBy === "talkpush"),
  };

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

  const renderSelectableTab = (tab: (typeof SELECTABLE_TABS)[number]) => {
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
  };

  const renderAlwaysEnabledTab = (tab: (typeof TAB_CONFIG)[number]) => {
    const Icon = iconMap[tab.icon];

    return (
      <label
        key={tab.slug}
        className="flex cursor-not-allowed items-center gap-2 rounded-lg border bg-gray-50 px-3 py-2 text-sm opacity-60"
      >
        <input type="checkbox" checked disabled className="h-4 w-4" />
        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <span className="text-muted-foreground">{tab.label}</span>
        <span className="ml-auto text-xs text-muted-foreground">Always on</span>
      </label>
    );
  };

  const renderGroup = ({
    title,
    description,
    tabs,
    alwaysEnabled = [],
  }: {
    title: string;
    description: string;
    tabs: typeof SELECTABLE_TABS;
    alwaysEnabled?: typeof TAB_CONFIG;
  }) => {
    const selectedCount = tabs.filter((tab) => selectedTabs.includes(tab.slug)).length;
    const totalCount = tabs.length + alwaysEnabled.length;

    return (
      <section className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
            {selectedCount + alwaysEnabled.length}/{totalCount}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {alwaysEnabled.map(renderAlwaysEnabledTab)}
          {tabs.map(renderSelectableTab)}
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Enabled Tabs</p>
        <Button className="max-md:min-h-11" type="button" variant="ghost" size="sm" onClick={toggleAll}>
          {allSelected ? "Deselect All" : "Select All"}
        </Button>
      </div>

      <div className="space-y-3">
        {renderGroup({
          title: "Client fills out",
          description: "Shown to the client as checklist work.",
          tabs: clientTabs,
          alwaysEnabled: alwaysEnabledByOwner.client,
        })}
        {renderGroup({
          title: "Talkpush fills out",
          description: "Internal setup tabs kept out of the client-facing checklist.",
          tabs: talkpushTabs,
          alwaysEnabled: alwaysEnabledByOwner.talkpush,
        })}
      </div>
    </div>
  );
}
