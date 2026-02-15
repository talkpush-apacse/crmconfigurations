"use client";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { ExampleHint } from "@/components/shared/ExampleHint";
import { useChecklistContext } from "@/lib/checklist-context";
import { uid, defaultMessaging } from "@/lib/template-data";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Copy } from "lucide-react";
import type { MessagingTemplateRow, CommunicationChannels } from "@/lib/types";

const allChannels = [
  { key: "email" as const, label: "Email", templateKey: "emailTemplate" as const, activeKey: "emailActive" as const },
  { key: "sms" as const, label: "SMS", templateKey: "smsTemplate" as const, activeKey: "smsActive" as const },
  { key: "whatsapp" as const, label: "WhatsApp", templateKey: "whatsappTemplate" as const, activeKey: "whatsappActive" as const },
  { key: "messenger" as const, label: "Messenger", templateKey: "messengerTemplate" as const, activeKey: "messengerActive" as const },
];

export function MessagingSheet() {
  const { data, updateField } = useChecklistContext();
  const templates = (data.messaging as MessagingTemplateRow[]) || defaultMessaging;

  // Filter channels based on communication channels setting
  const enabledChannels = data.communicationChannels as CommunicationChannels | null;
  const channels = enabledChannels
    ? allChannels.filter((ch) => enabledChannels[ch.key as keyof CommunicationChannels] !== false)
    : allChannels; // null = show all (backward compat for old checklists)

  const handleUpdate = (index: number, field: string, value: string | boolean) => {
    const updated = [...templates];
    updated[index] = { ...updated[index], [field]: value };
    updateField("messaging", updated);
  };

  const handleAdd = () => {
    updateField("messaging", [
      ...templates,
      {
        id: uid(),
        name: "",
        purpose: "",
        language: "English",
        folder: "",
        emailTemplate: "",
        emailActive: false,
        smsTemplate: "",
        smsActive: false,
        whatsappTemplate: "",
        whatsappActive: false,
        messengerTemplate: "",
        messengerActive: false,
        comments: "",
      },
    ]);
  };

  const handleDelete = (index: number) => {
    updateField("messaging", templates.filter((_, i) => i !== index));
  };

  const handleDuplicate = (index: number) => {
    const clone = { ...templates[index], id: uid() };
    const updated = [...templates];
    updated.splice(index + 1, 0, clone);
    updateField("messaging", updated);
  };

  return (
    <div>
      <SectionHeader
        title="Messaging Templates"
        description="Configure message templates for each communication channel. Use tokens like <Candidate First Name> or <Scheduler URL> for personalization."
      />

      <ExampleHint>
        <p className="mb-1 font-medium">Typical messaging flow:</p>
        <ol className="list-decimal pl-4 space-y-0.5">
          <li><strong>Invitation to Apply</strong> &mdash; First outreach to candidates via SMS/WhatsApp</li>
          <li><strong>Application Acknowledgment</strong> &mdash; Confirm receipt of their application</li>
          <li><strong>Invite to Book Interview</strong> &mdash; Ask shortlisted candidates to schedule</li>
          <li><strong>Invite to AI Interview</strong> &mdash; Direct candidates to complete AI screening</li>
          <li><strong>Follow-ups</strong> &mdash; Reminders for incomplete applications, unbooked schedules, or pending AI interviews</li>
          <li><strong>Schedule Confirmation</strong> &mdash; Confirm interview date, time, and location</li>
        </ol>
        <p className="mt-1">The 8 pre-populated templates below cover this full flow. Edit them to match your branding and tone.</p>
      </ExampleHint>

      <div className="mb-4 rounded-lg border bg-purple-50 p-3">
        <p className="text-xs text-purple-700">
          <strong>Available tokens:</strong>{" "}
          {"<Candidate First Name>, <Candidate Last Name>, <Campaign Name>, <Scheduler URL>, <Company Name>, <Site Name>"}
        </p>
      </div>

      <Accordion type="multiple" className="space-y-3">
        {templates.map((template, idx) => (
          <AccordionItem
            key={template.id || idx}
            value={template.id || String(idx)}
            className="rounded-lg border"
          >
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-3 text-left">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#535FC1] text-xs text-white">
                  {idx + 1}
                </span>
                <div>
                  <p className="font-medium">{template.name || "Untitled Template"}</p>
                  <p className="text-xs text-muted-foreground">{template.purpose || "No purpose set"}</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Template Name</Label>
                    <Input
                      value={template.name}
                      onChange={(e) => handleUpdate(idx, "name", e.target.value)}
                      placeholder="e.g., Invitation"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Language</Label>
                    <Input
                      value={template.language}
                      onChange={(e) => handleUpdate(idx, "language", e.target.value)}
                      placeholder="e.g., English"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Purpose</Label>
                    <Input
                      value={template.purpose}
                      onChange={(e) => handleUpdate(idx, "purpose", e.target.value)}
                      placeholder="What this template is used for"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Folder</Label>
                    <Input
                      value={template.folder}
                      onChange={(e) => handleUpdate(idx, "folder", e.target.value)}
                      placeholder="e.g., Inbox"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="rounded-lg border">
                  <div className="grid grid-cols-[120px_1fr_60px] bg-gray-100 px-3 py-2 text-xs font-medium">
                    <span>Channel</span>
                    <span>Template Content</span>
                    <span className="text-center">Active</span>
                  </div>
                  {channels.map((ch) => (
                    <div
                      key={ch.key}
                      className="grid grid-cols-[120px_1fr_60px] items-start border-t px-3 py-2"
                    >
                      <span className="pt-2 text-sm font-medium">{ch.label}</span>
                      <Textarea
                        value={String(template[ch.templateKey] || "")}
                        onChange={(e) => handleUpdate(idx, ch.templateKey, e.target.value)}
                        placeholder={`Enter ${ch.label} template...`}
                        className="min-h-[60px] text-sm"
                      />
                      <div className="flex items-center justify-center pt-2">
                        <Checkbox
                          checked={!!template[ch.activeKey]}
                          onCheckedChange={(checked) => handleUpdate(idx, ch.activeKey, !!checked)}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <Label className="text-xs">Comments</Label>
                  <Textarea
                    value={template.comments}
                    onChange={(e) => handleUpdate(idx, "comments", e.target.value)}
                    placeholder="Additional notes..."
                    className="mt-1"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary"
                    onClick={() => handleDuplicate(idx)}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Duplicate
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleDelete(idx)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Delete Template
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <div className="mt-4">
        <Button variant="outline" onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Template
        </Button>
      </div>
    </div>
  );
}
