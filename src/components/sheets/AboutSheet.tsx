"use client";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { ChangelogSection } from "@/components/about/ChangelogSection";
import changelog from "../../../CHANGELOG.json";

const currentVersion = (changelog as { version: string }[])[0]?.version ?? "1.0.0";

export function AboutSheet() {
  return (
    <div>
      <SectionHeader title="About" />
      <div className="space-y-6 rounded-lg border bg-white p-8">
        <div className="text-center">
          <h1 className="text-[24px] font-semibold text-gray-900">
            Talkpush CRM Configuration Checklist
          </h1>
          <p className="mt-2 inline-flex items-center rounded-full bg-teal-50 px-3 py-1 font-mono text-sm font-medium text-teal-700">
            v{currentVersion}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Built by the Talkpush Solutions Engineering team to streamline CRM
            setup for enterprise clients.
          </p>
        </div>

        <div>
          <h3 className="mb-3 text-base font-medium text-gray-800">
            Version History
          </h3>
          <ChangelogSection />
        </div>
      </div>
    </div>
  );
}
