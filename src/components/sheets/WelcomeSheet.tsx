"use client";

import { SectionHeader } from "@/components/shared/SectionHeader";

export function WelcomeSheet() {
  return (
    <div>
      <SectionHeader title="Welcome" />
      <div className="space-y-6 rounded-lg border bg-white p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#230F59]">
            Talkpush CRM Configuration Checklist
          </h1>
          <p className="mt-2 text-muted-foreground">
            Welcome to your configuration checklist. This tool helps you set up your Talkpush CRM
            platform by guiding you through each section of the configuration process.
          </p>
        </div>

        <div className="mx-auto max-w-2xl space-y-4">
          <div className="rounded-lg bg-purple-50 p-4">
            <h3 className="font-semibold text-[#230F59]">How to use this checklist</h3>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              <li>Navigate through the tabs on the left sidebar to access each section.</li>
              <li>Fields highlighted in yellow are editable — fill them in with your information.</li>
              <li>Gray fields contain descriptions and examples for reference.</li>
              <li>Your changes are automatically saved as you type.</li>
              <li>Use the &quot;Export XLS&quot; button to download the completed checklist.</li>
            </ul>
          </div>

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
              <li><strong>Facebook & WhatsApp</strong> — Messaging platform integration</li>
              <li><strong>Instagram Chatbot</strong> — Instagram integration</li>
              <li><strong>AI Call</strong> — AI call configuration and FAQs</li>
              <li><strong>Agency Portal</strong> — Agency management</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
