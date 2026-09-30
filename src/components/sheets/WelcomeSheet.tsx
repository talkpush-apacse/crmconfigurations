"use client";

import Link from "next/link";
import { CheckCircle, Info, ArrowRight, Circle, Clock3 } from "lucide-react";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { EditableCell } from "@/components/shared/EditableCell";
import { useChecklistContext } from "@/lib/checklist-context";
import { getEnabledTabs, excludeTalkpushTabs, isClientView } from "@/lib/tab-config";
import { getSectionState } from "@/lib/section-status";
import type { ChecklistData, CompanyInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

const DEFAULT_CHECKLIST_TITLE = "Talkpush CRM Configuration Checklist";
const DEFAULT_WELCOME_SUBTITLE = "Complete each section to configure your Talkpush CRM platform.";

const STATUS_META = {
  complete: { label: "Complete", dot: "bg-green-600", icon: CheckCircle, iconClass: "text-green-600" },
  "in-progress": { label: "In progress", dot: "bg-amber-500", icon: Clock3, iconClass: "text-amber-500" },
  "not-started": { label: "Not started", dot: "border-2 border-gray-400 bg-transparent", icon: Circle, iconClass: "text-gray-300" },
} as const;

function SectionCard({
  label,
  status,
  href,
}: {
  label: string;
  status: keyof typeof STATUS_META;
  href: string;
}) {
  const meta = STATUS_META[status];
  const StatusIcon = meta.icon;
  return (
    <Link
      href={href}
      className="group flex items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-3.5 py-3 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <StatusIcon className={cn("h-4 w-4 shrink-0", meta.iconClass)} />
      <span className="min-w-0 flex-1 truncate font-medium text-gray-800">{label}</span>
    </Link>
  );
}

function StatTile({ count, label, dotClass }: { count: number; label: string; dotClass: string }) {
  return (
    <div className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", dotClass)} />
        <span className="text-[13px] font-medium text-gray-500">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{count}</p>
    </div>
  );
}

export function WelcomeSheet() {
  const { data, basePath, includeAdminTabs, updateField } = useChecklistContext();

  // Only Talkpush's admin/editor views may rename the page — the client's own
  // link renders whatever was set, but never shows an edit affordance for it.
  const canEditWelcomeCopy = !isClientView(basePath);
  const companyInfo = (data?.companyInfo ?? {}) as Partial<CompanyInfo>;
  // `.trim()` so clearing the field down to whitespace still falls back to the
  // default, instead of rendering a blank-looking title.
  const checklistTitle = companyInfo.checklistTitle?.trim() || DEFAULT_CHECKLIST_TITLE;
  const welcomeSubtitle = companyInfo.welcomeSubtitle?.trim() || DEFAULT_WELCOME_SUBTITLE;

  const handleTitleChange = (value: string | boolean) => {
    updateField("companyInfo", { ...(data?.companyInfo as CompanyInfo), checklistTitle: String(value) });
  };
  const handleSubtitleChange = (value: string | boolean) => {
    updateField("companyInfo", { ...(data?.companyInfo as CompanyInfo), welcomeSubtitle: String(value) });
  };

  // `tabFilledBy` has to be passed here: without it this reads the TAB_CONFIG
  // defaults and the cards below disagree with the sidebar on any checklist
  // where a tab was moved between the client and Talkpush groups.
  const allTabs = getEnabledTabs(
    data?.enabledTabs ?? null,
    !!includeAdminTabs,
    data?.tabOrder ?? null,
    null,
    (data?.tabFilledBy as Record<string, "talkpush" | "client"> | null) ?? null,
  );
  // On the client route, hide the tabs Talkpush fills in — otherwise this page
  // advertises sections the client can't open from the sidebar.
  const enabledTabs = isClientView(basePath)
    ? excludeTalkpushTabs(allTabs)
    : allTabs;
  const contentTabs = enabledTabs.filter((t) => t.dataKey);

  const statuses = contentTabs.map((t) => {
    const val = (data as ChecklistData)[t.dataKey as keyof ChecklistData];
    return { tab: t, status: getSectionState(val, t.dataKey) };
  });

  const completedCount = statuses.filter((s) => s.status === "complete").length;
  const inProgressCount = statuses.filter((s) => s.status === "in-progress").length;
  const notStartedCount = statuses.filter((s) => s.status === "not-started").length;

  const totalCount = contentTabs.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const firstContentTab = contentTabs[0];

  return (
    <div>
      <SectionHeader title="Welcome" />

      {/* Hero */}
      <div className="mb-5">
        {canEditWelcomeCopy ? (
          <>
            <EditableCell
              type="text"
              value={checklistTitle}
              onChange={handleTitleChange}
              className="border-none p-0 text-[22px] font-semibold text-gray-900 shadow-none hover:border-none"
              placeholder={DEFAULT_CHECKLIST_TITLE}
            />
            <div className="mt-1">
              <EditableCell
                type="text"
                value={welcomeSubtitle}
                onChange={handleSubtitleChange}
                className="border-none p-0 text-[14px] text-gray-500 shadow-none hover:border-none"
                placeholder={DEFAULT_WELCOME_SUBTITLE}
              />
            </div>
          </>
        ) : (
          <>
            <h1 className="text-[22px] font-semibold text-gray-900">{checklistTitle}</h1>
            <p className="mt-1 text-[14px] text-gray-500">{welcomeSubtitle}</p>
          </>
        )}
      </div>

      {/* Main content — a wide sidebar layout instead of one narrow stacked
          column, so the page uses the space next to the nav rather than
          leaving most of it blank. */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {/* Stat tiles */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <StatTile count={completedCount} label="Complete" dotClass="bg-green-600" />
            <StatTile count={inProgressCount} label="In progress" dotClass="bg-amber-500" />
            <StatTile count={notStartedCount} label="Not started" dotClass="border-2 border-gray-400 bg-transparent" />
          </div>

          {/* Progress + section grid */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-[16px] font-semibold text-gray-900">
                {completedCount} of {totalCount} sections complete
              </p>
              <span className="text-sm font-medium text-gray-500">
                {Math.round(progressPercent)}%
              </span>
            </div>
            <div className="mt-3 h-1.5 w-full rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-green-600 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {statuses.map(({ tab, status }) => (
                <SectionCard key={tab.slug} label={tab.label} status={status} href={`${basePath}/${tab.slug}`} />
              ))}
            </div>
          </div>

          {/* CTA button */}
          {firstContentTab && (
            <div className="flex justify-end">
              <Link
                href={`${basePath}/${firstContentTab.slug}`}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-[14px] font-semibold text-primary-foreground hover:bg-primary/85 transition-colors"
              >
                Continue to {firstContentTab.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3">
            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
            <p className="text-[13px] text-gray-500">
              All changes auto-save 2 seconds after you stop typing.
            </p>
          </div>

          <div className="rounded-lg border-l-4 border-brand-amber bg-brand-amber-lightest p-4">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-brand-amber-darker shrink-0" />
              <span className="text-[15px] font-semibold text-foreground">Important Notes</span>
            </div>
            <ul className="mt-3 space-y-2 text-[13px] leading-5 text-foreground/80">
              <li>Do not skip sections — complete each tab in order when possible.</li>
              <li>Dropdown fields have predefined options — select from the list.</li>
              <li>For tables, use the &quot;Add Row&quot; button to create new entries.</li>
              <li>You can delete rows using the trash icon on the right side.</li>
              <li>Hover over the ⓘ icon next to field labels for detailed descriptions.</li>
              <li>Export your completed checklist using the &quot;Export XLS&quot; button in the header.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
