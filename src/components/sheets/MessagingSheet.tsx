"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { SheetIntro } from "@/components/shared/SheetIntro";
import { EditableTable } from "@/components/shared/EditableTable";
import { TabUploadBanner, TabUploadSkippedNotice } from "@/components/shared/TabUploadBanner";
import { SectionFooter } from "@/components/shared/SectionFooter";
import { useTabUpload } from "@/hooks/useTabUpload";
import { useChecklistContext } from "@/lib/checklist-context";
import { uid, defaultMessaging, defaultCommunicationChannels } from "@/lib/template-data";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AlertCircle } from "lucide-react";
import type { ColumnDef, MessagingTemplateRow, CommunicationChannels } from "@/lib/types";
import { softDeleteByIds } from "@/lib/duplicate-row";

const AVAILABLE_TOKENS = [
  "<Candidate First Name>",
  "<Candidate Last Name>",
  "<Campaign Name>",
  "<Scheduler URL>",
  "<Company Name>",
  "<Site Name>",
];

const allChannels = [
  { key: "email" as const, label: "Email", templateKey: "emailTemplate" as const, activeKey: "emailActive" as const },
  { key: "sms" as const, label: "SMS", templateKey: "smsTemplate" as const, activeKey: "smsActive" as const },
  { key: "whatsapp" as const, label: "WhatsApp", templateKey: "whatsappTemplate" as const, activeKey: "whatsappActive" as const },
  { key: "messenger" as const, label: "Messenger", templateKey: "messengerTemplate" as const, activeKey: "messengerActive" as const },
];

type Channel = (typeof allChannels)[number];

const baseColumns: ColumnDef[] = [
  {
    key: "name",
    label: "Template Name",
    type: "text",
    required: true,
    width: 200,
    description: "What Talkpush will call this template in the platform, e.g. \"Invitation to Apply\".",
  },
  {
    key: "purpose",
    label: "Purpose",
    type: "text",
    required: true,
    width: 240,
    description: "When this message goes out, in your own words — this is what tells us where to wire it into the candidate journey.",
  },
  { key: "language", label: "Language", type: "text", width: 120 },
  {
    key: "folder",
    label: "Folder",
    type: "text",
    width: 130,
    description: "The candidate folder this template is sent from, if it is tied to one.",
  },
];

/**
 * Messaging Templates as a grid.
 *
 * This tab used to be the odd one out: a drag-and-drop accordion of stacked
 * forms, each holding a nested channel table. One template open ran past the
 * fold, so a client with a dozen templates could see one in detail or none at
 * all — and which channels a template actually used was only discoverable by
 * opening every template in turn.
 *
 * One row per template now, with the channel toggles as columns so the matrix
 * reads at a glance, and the message bodies in the row's drawer where
 * paragraphs have room. The stored shape is untouched — same field names, so
 * the XLS export and the section-status logic are unaffected.
 */
export function MessagingSheet() {
  const { data, updateField, isReadOnly } = useChecklistContext();
  const { isSkipped, uploadedFiles } = useTabUpload("messaging");
  const [tokensOpen, setTokensOpen] = useState(false);

  const allTemplates = (data.messaging as MessagingTemplateRow[]) || defaultMessaging;
  const templates = useMemo(
    () => allTemplates.filter((t) => !t.deletedAt),
    [allTemplates]
  );

  // The visible list hides soft-deleted rows, so an index from the UI has to be
  // mapped back to the full array before writing.
  const fullIndexOf = (visibleIdx: number) => {
    const target = templates[visibleIdx];
    if (!target) return -1;
    return allTemplates.findIndex((t) => t.id === target.id);
  };

  // Only the channels this client actually uses (falls back to defaults for
  // older checklists).
  const enabledChannels =
    (data.communicationChannels as CommunicationChannels | null) ?? defaultCommunicationChannels;
  const channels = useMemo(
    () =>
      allChannels.filter(
        (ch) => enabledChannels[ch.key as keyof CommunicationChannels] !== false
      ),
    [enabledChannels]
  );

  const columns = useMemo<ColumnDef[]>(
    () => [
      ...baseColumns,
      ...channels.map<ColumnDef>((ch) => ({
        key: ch.activeKey,
        label: ch.label,
        type: "boolean",
        width: 96,
        description: `Tick this if the template goes out over ${ch.label}. Write the message itself in the row's panel — open it with the chevron on the left.`,
      })),
    ],
    [channels]
  );

  const sampleRow = useMemo(() => {
    const row: Record<string, string> = {
      name: "Invitation to Apply",
      purpose: "First outreach message sent to candidate after sourcing",
      language: "English",
      folder: "Inbox",
    };
    for (const ch of channels) {
      row[ch.activeKey] = ch.key === "email" || ch.key === "sms" ? "Yes" : "";
    }
    return row;
  }, [channels]);

  // A template with no name or purpose isn't ready to be built.
  const hasValidationErrors = templates.some(
    (t) => t.notApplicable !== true && (!t.name.trim() || !t.purpose.trim())
  );

  const handleUpdate = (index: number, field: string, value: string | boolean) => {
    const fullIdx = fullIndexOf(index);
    if (fullIdx < 0) return;
    const updated = [...allTemplates];
    updated[fullIdx] = { ...updated[fullIdx], [field]: value };
    updateField("messaging", updated);
  };

  const handleAdd = () => {
    // Guarded rather than disabled: EditableTable owns the add button, and a
    // pile of nameless templates is what this stops.
    if (hasValidationErrors) return;
    updateField("messaging", [
      ...allTemplates,
      {
        id: uid(),
        name: "",
        purpose: "",
        language: "English",
        folder: "",
        emailSubject: "",
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
    const target = templates[index];
    if (!target) return;
    updateField("messaging", softDeleteByIds(allTemplates, [target.id]));
  };

  const handleDuplicate = (index: number) => {
    const fullIdx = fullIndexOf(index);
    if (fullIdx < 0) return;
    const clone = { ...allTemplates[fullIdx], id: uid() };
    const updated = [...allTemplates];
    updated.splice(fullIdx + 1, 0, clone);
    updateField("messaging", updated);
  };

  /**
   * mergeVisibleRows keeps the full array's own order, so it can't express a
   * reorder. The new visible order is written out in full, with soft-deleted
   * rows kept on the end where they stay out of the way but recoverable.
   */
  const handleReorder = (reordered: MessagingTemplateRow[]) => {
    const removed = allTemplates.filter((t) => t.deletedAt);
    updateField("messaging", [...reordered, ...removed]);
  };

  /** One block per channel, plus comments — the row's expanded panel. */
  const renderChannelBlock = (
    row: MessagingTemplateRow,
    rowIdx: number,
    ch: Channel
  ) => (
    <div key={ch.key}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-600">
          {ch.label}
        </span>
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
          <Checkbox
            checked={!!row[ch.activeKey]}
            onCheckedChange={(checked) => handleUpdate(rowIdx, ch.activeKey, !!checked)}
            aria-label={`${ch.label} active`}
            className="h-3.5 w-3.5"
          />
          Active
        </label>
      </div>
      {ch.key === "email" && (
        <Input
          value={row.emailSubject || ""}
          onChange={(e) => handleUpdate(rowIdx, "emailSubject", e.target.value)}
          placeholder="Subject line"
          className="mb-1.5 h-8 text-[13px]"
        />
      )}
      <Textarea
        value={String(row[ch.templateKey] || "")}
        onChange={(e) => handleUpdate(rowIdx, ch.templateKey, e.target.value)}
        placeholder={`Enter the ${ch.label} message…`}
        className="min-h-[88px] text-[13px]"
      />
    </div>
  );

  const renderDetail = ({
    row,
    rowIdx,
  }: {
    row: MessagingTemplateRow;
    rowIdx: number;
  }) => {
    const notApplicable = row.notApplicable === true;
    return (
      <div className="space-y-3">
        {/*
          Marking a template not applicable keeps the row and its purpose text
          — which is the reference for what it was for — while taking it out of
          scope. Deleting is still available in the row itself.
        */}
        {!isReadOnly && (
          <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border bg-card px-2.5 py-1.5">
            <Checkbox
              checked={notApplicable}
              onCheckedChange={(checked) =>
                handleUpdate(rowIdx, "notApplicable", checked === true)
              }
              className="h-3.5 w-3.5"
            />
            <span className="text-xs text-foreground">
              Not applicable to us — leave this template out of the build
            </span>
          </label>
        )}

        <div className={notApplicable ? "pointer-events-none opacity-50" : undefined}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {channels.map((ch) => renderChannelBlock(row, rowIdx, ch))}
            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-600">
                Comments
              </span>
              <Textarea
                value={row.comments}
                onChange={(e) => handleUpdate(rowIdx, "comments", e.target.value)}
                placeholder="Anything Talkpush should know about this template"
                className="min-h-[56px] text-[13px]"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <SheetIntro
        title="Messaging Templates"
        description="The messages Talkpush sends candidates on your behalf. One row per template — open a row to write the message for each channel."
      />

      <TabUploadBanner tabKey="messaging" tabLabel="Messaging Templates" compact />

      {isSkipped ? (
        <TabUploadSkippedNotice fileCount={uploadedFiles.length} />
      ) : (
        <>
          {/*
            Collapsed by default. This was a permanent lavender banner listing
            every token, on screen whether or not anyone was writing a message.
          */}
          <Collapsible open={tokensOpen} onOpenChange={setTokensOpen} className="mb-3">
            <CollapsibleTrigger className="flex cursor-pointer items-center gap-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:text-brand-lavender-darker">
              <ChevronRight
                className={`h-3.5 w-3.5 transition-transform duration-200 ${tokensOpen ? "rotate-90" : ""}`}
              />
              Available tokens ({AVAILABLE_TOKENS.length})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {AVAILABLE_TOKENS.map((token) => (
                  <code
                    key={token}
                    className="rounded border border-brand-lavender-lighter bg-brand-lavender-lightest px-1.5 py-0.5 text-[11.5px] text-brand-lavender-darker"
                  >
                    {token}
                  </code>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-muted-foreground">
                Paste a token into any message and Talkpush fills it in per candidate.
              </p>
            </CollapsibleContent>
          </Collapsible>

          <EditableTable<MessagingTemplateRow>
            spreadsheetMode
            tableId="messaging"
            columns={columns}
            data={templates}
            onUpdate={handleUpdate}
            onAdd={handleAdd}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            onReorder={handleReorder}
            renderDetail={renderDetail}
            rowClassName={(row) =>
              row.notApplicable === true
                ? "opacity-60 [&_input]:line-through [&_input]:decoration-slate-400"
                : undefined
            }
            addLabel="Add template"
            sampleRow={sampleRow}
            deleteConfirmation={{
              title: "Delete this template?",
              getName: (row) => row.name || "Untitled template",
            }}
          />

          {!isReadOnly && hasValidationErrors && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Give every template a name and a purpose before adding another one.
            </p>
          )}
        </>
      )}
      <SectionFooter />
    </div>
  );
}
