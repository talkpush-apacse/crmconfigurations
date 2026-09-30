"use client";

import { SheetIntro } from "@/components/shared/SheetIntro";
import { SubSectionHeader } from "@/components/shared/SubSectionHeader";
import { KeyValueForm, type KeyValueField } from "@/components/shared/KeyValueForm";
import { EditableTable } from "@/components/shared/EditableTable";
import { VoicePreview, VOICE_FILES } from "@/components/shared/VoicePreview";
import { TabUploadBanner, TabUploadSkippedNotice } from "@/components/shared/TabUploadBanner";
import { useTabUpload } from "@/hooks/useTabUpload";
import { useChecklistContext } from "@/lib/checklist-context";
import { uid, defaultAiCallData } from "@/lib/template-data";
import type { ColumnDef, AiCallData, AiCallFaqRow, FeatureToggles } from "@/lib/types";
import { SectionFooter } from "@/components/shared/SectionFooter";

function getConfigFields(selectedGender: string): KeyValueField[] {
  const voiceOptions = selectedGender
    ? VOICE_FILES.filter((v) => v.gender === selectedGender).map((v) => v.name)
    : [];

  return [
    {
      key: "agentName",
      label: "Agent Name",
      description: "What the AI caller should call itself during the call.",
      type: "text",
      example: "Ailyn",
    },
    {
      key: "measureEnglish",
      label: "Measure English Language Skills",
      description: "Enable Talkscore AI language skills assessment during the call.",
      type: "boolean",
      link: {
        url: "https://drive.google.com/file/d/1_0399mBTtdbs2yZoqts11V03IlVTiKYY/view?usp=sharing",
        label: "Learn more about Talkscore AI Bias Accuracy and Internal Controls",
      },
      example: "Yes",
    },
    {
      key: "gender",
      label: "Gender",
      description: "Select the preferred AI voice gender for the call.",
      type: "dropdown",
      options: ["Male", "Female"],
      example: "Female",
    },
    {
      key: "preferredVoice",
      label: "Preferred Voice",
      description: selectedGender
        ? "Select the AI voice to use for this client."
        : "Select a gender first to see available voices.",
      type: "dropdown",
      options: voiceOptions,
      example: "Clara",
    },
    {
      key: "warmth",
      label: "Warmth",
      description: "How warm or friendly the AI caller should sound.",
      type: "dropdown",
      options: ["Friendly", "Warm", "Neutral", "Reserved"],
      example: "Friendly",
    },
    {
      key: "formality",
      label: "Formality",
      description: "How formal the AI caller should be with candidates.",
      type: "dropdown",
      options: ["Casual", "Professional", "Formal"],
      example: "Casual",
    },
    {
      key: "pace",
      label: "Pace",
      description: "How quickly the AI caller should speak and move through the call.",
      type: "dropdown",
      options: ["Unhurried", "Balanced", "Fast"],
      example: "Unhurried",
    },
    {
      key: "callType",
      label: "Call Type",
      description: "How candidates will connect to the AI call.",
      type: "dropdown",
      options: ["Web", "Phone", "Both"],
      example: "Web",
    },
    {
      key: "callScheduleWindow",
      label: "Call Schedule Window",
      description: "When candidates may receive or complete AI calls.",
      type: "text",
      example: "9am to 6pm (Monday to Friday only)",
    },
    {
      key: "callLength",
      label: "Call Length",
      description: "Target or maximum call duration.",
      type: "text",
      example: "Max of 2 minutes",
    },
    {
      key: "callStatus",
      label: "Call Status",
      description: "Allowed status values Talkpush should use for AI calls.",
      type: "text",
      example: "Completed, Declined, Rescheduled, Not Taken, Unfinished",
    },
    {
      key: "interviewRole",
      label: "Job Title",
      description: "The role or position used in the AI call scripts.",
      type: "text",
      example: "Customer Service Representative",
    },
    {
      key: "jobDescription",
      label: "Job Description",
      description: "Role overview and responsibilities the AI caller can use as context.",
      type: "textarea",
      example: "Answer customer inquiries, resolve billing concerns, and route complex issues to the right team.",
    },
    {
      key: "interviewQuestions",
      label: "Interview Questions",
      description: "Free-text interview questions the AI should ask candidates.",
      type: "textarea",
      example: "Tell me about yourself. Why are you interested in this role?",
    },
  ];
}

const faqColumns: ColumnDef[] = [
  { key: "faq", label: "FAQ Topic", type: "text", description: "The topic or category of the FAQ" },
  { key: "example", label: "Example Question", type: "text", description: "A sample question a candidate might ask about this topic" },
  { key: "faqResponse", label: "FAQ Response", type: "textarea", description: "The response the AI should give when asked about this topic. Use placeholders like {{interview_location}}, {{company_name}} for dynamic content.", width: "40%" },
];

export function AICallFAQsSheet() {
  const { data, updateField } = useChecklistContext();
  const { isSkipped, uploadedFiles } = useTabUpload("aiCallFaqs");

  // Backward compatibility: detect old array format vs new object format
  const rawData = data.aiCallFaqs;
  const aiCallData: AiCallData = Array.isArray(rawData)
    ? { ...defaultAiCallData, faqs: rawData as AiCallFaqRow[] }
    : (rawData as AiCallData) || defaultAiCallData;

  const faqs = aiCallData.faqs || [];

  const allowVoiceSelection =
    (data.featureToggles as FeatureToggles | null)?.aiCallVoiceSelection !== false;

  const configFields = getConfigFields(aiCallData.gender).filter(
    (f) => allowVoiceSelection || !["gender", "preferredVoice"].includes(f.key)
  );

  const handleConfigChange = (key: string, value: string | boolean) => {
    // Clear preferred voice when gender changes
    if (key === "gender") {
      updateField("aiCallFaqs", { ...aiCallData, gender: value as string, preferredVoice: "" });
      return;
    }
    updateField("aiCallFaqs", { ...aiCallData, [key]: value });
  };

  const handleFaqUpdate = (index: number, field: string, value: string | boolean) => {
    const updated = [...faqs];
    updated[index] = { ...updated[index], [field]: value };
    updateField("aiCallFaqs", { ...aiCallData, faqs: updated });
  };

  const handleFaqAdd = () => {
    const newFaq: AiCallFaqRow = {
      id: uid(),
      faq: "",
      example: "",
      faqResponse: "",
    };
    updateField("aiCallFaqs", { ...aiCallData, faqs: [...faqs, newFaq] });
  };

  const handleFaqDelete = (index: number) => {
    updateField("aiCallFaqs", { ...aiCallData, faqs: faqs.filter((_, i) => i !== index) });
  };

  const handleFaqDuplicate = (index: number) => {
    const clone = { ...faqs[index], id: uid() };
    const updated = [...faqs];
    updated.splice(index + 1, 0, clone);
    updateField("aiCallFaqs", { ...aiCallData, faqs: updated });
  };

  const handleFaqReorder = (reordered: AiCallFaqRow[]) => {
    updateField("aiCallFaqs", { ...aiCallData, faqs: reordered });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCsvImport = (rows: Record<string, any>[], mode: "append" | "replace" = "append") => {
    const newRows = rows.map((row) => ({
      id: uid(),
      faq: "",
      example: "",
      faqResponse: "",
      ...row,
    }));
    updateField("aiCallFaqs", { ...aiCallData, faqs: mode === "replace" ? newRows : [...faqs, ...newRows] });
  };

  return (
    <div>
      <SheetIntro
        title="AI Call"
        description="Configure your AI call settings and define FAQ responses."
      />

      <TabUploadBanner tabKey="aiCallFaqs" tabLabel="AI Call" compact />

      {isSkipped ? (
        <TabUploadSkippedNotice fileCount={uploadedFiles.length} />
      ) : (
        <>
      <KeyValueForm
        fields={configFields}
        data={aiCallData as unknown as Record<string, string | boolean>}
        onChange={handleConfigChange}
      />

      {allowVoiceSelection && <VoicePreview selectedGender={aiCallData.gender} />}

      <div className="mt-8">
        <SubSectionHeader
          title="AI Call FAQs"
          description="Define the frequently asked questions and responses for the AI call system."
        />

        <div className="mb-4 rounded-lg border bg-brand-lavender-lightest p-3">
          <p className="text-xs text-brand-lavender-darker">
            <strong>Available placeholders:</strong>{" "}
            {"{{interview_location}}, {{company_name}}, {{site_name}}, {{interview_format}}, {{dress_code}}"}
          </p>
        </div>

        <EditableTable
          spreadsheetMode
          tableId="ai-call-faqs"
          columns={faqColumns}
          data={faqs}
          onUpdate={handleFaqUpdate}
          onAdd={handleFaqAdd}
          onDelete={handleFaqDelete}
          onDuplicate={handleFaqDuplicate}
          onReorder={handleFaqReorder}
          addLabel="Add FAQ"
          sampleRow={{ faq: "Salary", example: "How much is the starting salary?", faqResponse: "Starting salary is PHP 18,000-22,000/month depending on experience." }}
          csvConfig={{
            sampleRow: { faq: "Working Hours", example: "What are the working hours?", faqResponse: "Working hours are 9AM to 6PM, Monday to Friday." },
            onImport: handleCsvImport,
            sheetName: "AI Call FAQs",
          }}
        />
      </div>
        </>
      )}
      <SectionFooter />
    </div>
  );
}
