"use client";

import { useState, useEffect } from "react";
import { AlertCircle, CheckCircle, Edit3, ChevronDown, ChevronRight } from "lucide-react";
import { SectionHeader } from "@/components/shared/SectionHeader";

interface InfoCardProps {
  icon: React.ReactNode;
  title: string;
  colorClasses: string; // border + bg classes
  storageKey: string;
  children: React.ReactNode;
}

function InfoCard({ icon, title, colorClasses, storageKey, children }: InfoCardProps) {
  // Start open on first visit; persist collapsed state across sessions
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) setOpen(stored !== "false");
  }, [storageKey]);

  const handleToggle = () => {
    setOpen((v) => {
      const next = !v;
      localStorage.setItem(storageKey, String(next));
      return next;
    });
  };

  return (
    <div className={`rounded-lg border-l-4 ${colorClasses}`}>
      <button
        className="flex w-full items-center gap-3 p-4 text-left"
        onClick={handleToggle}
        aria-expanded={open}
      >
        <span className="shrink-0">{icon}</span>
        <span className="flex-1 font-semibold">{title}</span>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-current opacity-60" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-current opacity-60" />
        )}
      </button>
      {open && <div className="px-4 pb-4 pt-0">{children}</div>}
    </div>
  );
}

export function WelcomeSheet() {
  return (
    <div>
      <SectionHeader title="Welcome" />
      <div className="space-y-6 rounded-lg border bg-white p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary">
            Talkpush CRM Configuration Checklist
          </h1>
          <p className="mt-2 text-muted-foreground">
            Welcome to your configuration checklist. This tool helps you set up your Talkpush CRM
            platform by guiding you through each section of the configuration process.
          </p>
        </div>

        <InfoCard
          icon={<Edit3 className="h-5 w-5 text-yellow-600" />}
          title="Editable Fields"
          colorClasses="border-yellow-400 bg-yellow-50 text-yellow-800"
          storageKey="welcome-card-editable-fields"
        >
          <p className="text-sm text-yellow-900">
            Fields with a yellow background are editable. Click on them to enter your information.
            Your changes are saved automatically.
          </p>
        </InfoCard>

        <InfoCard
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          title="Auto-Save"
          colorClasses="border-green-400 bg-green-50 text-green-800"
          storageKey="welcome-card-auto-save"
        >
          <p className="text-sm text-green-700">
            All changes are automatically saved 2 seconds after you stop typing.
            The save status is shown in the top-right corner of the header.
          </p>
        </InfoCard>

        <InfoCard
          icon={<AlertCircle className="h-5 w-5 text-blue-600" />}
          title="Important Notes"
          colorClasses="border-blue-400 bg-blue-50 text-blue-800"
          storageKey="welcome-card-important-notes"
        >
          <ul className="space-y-1 text-sm text-blue-700">
            <li>Do not skip sections — complete each tab in order when possible.</li>
            <li>Dropdown fields have predefined options — select from the list.</li>
            <li>For tables, use the &quot;Add Row&quot; button to create new entries.</li>
            <li>You can delete rows using the trash icon on the right side.</li>
            <li>Hover over column headers for detailed descriptions.</li>
            <li>Export your completed checklist using the &quot;Export XLS&quot; button in the header.</li>
          </ul>
        </InfoCard>

        <div className="rounded-lg bg-blue-50 p-4">
          <h3 className="font-semibold text-blue-900">Sections Overview</h3>
          <ul className="mt-2 space-y-1 text-sm text-blue-800">
            <li><strong>Company Information</strong> — Basic company settings</li>
            <li><strong>User List</strong> — Platform users and access levels</li>
            <li><strong>Campaigns List</strong> — Job campaigns configuration</li>
            <li><strong>Sites</strong> — Interview locations</li>
            <li><strong>Pre-screening Questions</strong> — Candidate screening setup</li>
            <li><strong>Messaging Templates</strong> — Communication templates</li>
            <li><strong>Sources</strong> — Candidate sourcing channels</li>
            <li><strong>Folders</strong> — Workflow stage configuration</li>
            <li><strong>Document Collection</strong> — Required documents setup</li>
            <li><strong>Facebook &amp; WhatsApp</strong> — Messaging platform integration</li>
            <li><strong>Instagram Chatbot</strong> — Instagram integration</li>
            <li><strong>AI Call</strong> — AI call configuration and FAQs</li>
            <li><strong>Agency Portal</strong> — Agency management</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
