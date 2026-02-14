"use client";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { KeyValueForm, type KeyValueField } from "@/components/shared/KeyValueForm";
import { EditableTable } from "@/components/shared/EditableTable";
import { VoicePreview } from "@/components/shared/VoicePreview";
import { useChecklistContext } from "@/lib/checklist-context";
import { defaultAiCallData } from "@/lib/template-data";
import type { ColumnDef, AiCallData, AiCallFaqRow } from "@/lib/types";

const configFields: KeyValueField[] = [
  {
    key: "measureEnglish",
    label: "Measure English Language Skills",
    description: "Enable Talkscore AI language skills assessment during the call.",
    type: "boolean",
    link: {
      url: "https://drive.google.com/file/d/1_0399mBTtdbs2yZoqts11V03IlVTiKYY/view?usp=sharing",
      label: "Learn more about Talkscore AI Bias Accuracy and Internal Controls",
    },
  },
  {
    key: "gender",
    label: "Gender",
    description: "Select the preferred AI voice gender for the call.",
    type: "dropdown",
    options: ["Male", "Female"],
  },
  {
    key: "callType",
    label: "Call Type",
    description: "How candidates will connect to the AI call.",
    type: "dropdown",
    options: ["Web", "Phone", "Both"],
  },
  {
    key: "interviewRole",
    label: "Interview Role",
    description: "The role/position that interview questions relate to.",
    type: "text",
  },
  {
    key: "interviewQuestions",
    label: "Interview Questions",
    description: "Free-text interview questions the AI should ask candidates.",
    type: "textarea",
  },
];

const faqColumns: ColumnDef[] = [
  { key: "faq", label: "FAQ Topic", type: "text", description: "The topic or category of the FAQ" },
  { key: "example", label: "Example Question", type: "text", description: "A sample question a candidate might ask about this topic" },
  { key: "faqResponse", label: "FAQ Response", type: "textarea", description: "The response the AI should give when asked about this topic. Use placeholders like {{interview_location}}, {{company_name}} for dynamic content.", width: "40%" },
];

export function AICallFAQsSheet() {
  const { data, updateField } = useChecklistContext();

  // Backward compatibility: detect old array format vs new object format
  const rawData = data.aiCallFaqs;
  const aiCallData: AiCallData = Array.isArray(rawData)
    ? { ...defaultAiCallData, faqs: rawData as AiCallFaqRow[] }
    : (rawData as AiCallData) || defaultAiCallData;

  const faqs = aiCallData.faqs || [];

  const handleConfigChange = (key: string, value: string | boolean) => {
    updateField("aiCallFaqs", { ...aiCallData, [key]: value });
  };

  const handleFaqUpdate = (index: number, field: string, value: string | boolean) => {
    const updated = [...faqs];
    updated[index] = { ...updated[index], [field]: value };
    updateField("aiCallFaqs", { ...aiCallData, faqs: updated });
  };

  const handleFaqAdd = () => {
    const newFaq: AiCallFaqRow = {
      id: Math.random().toString(36).substring(2, 9),
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
    const clone = { ...faqs[index], id: Math.random().toString(36).substring(2, 9) };
    const updated = [...faqs];
    updated.splice(index + 1, 0, clone);
    updateField("aiCallFaqs", { ...aiCallData, faqs: updated });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCsvImport = (rows: Record<string, any>[]) => {
    const newRows = rows.map((row) => ({
      id: Math.random().toString(36).substring(2, 9),
      faq: "",
      example: "",
      faqResponse: "",
      ...row,
    }));
    updateField("aiCallFaqs", { ...aiCallData, faqs: [...faqs, ...newRows] });
  };

  return (
    <div>
      <SectionHeader
        title="AI Call"
        description="Configure your AI call settings and define FAQ responses."
      />

      <KeyValueForm
        fields={configFields}
        data={aiCallData as unknown as Record<string, string | boolean>}
        onChange={handleConfigChange}
      />

      <VoicePreview selectedGender={aiCallData.gender} />

      <div className="mt-8">
        <SectionHeader
          title="AI Call FAQs"
          description="Define the frequently asked questions and responses for the AI call system."
        />

        <div className="mb-4 rounded-lg border bg-purple-50 p-3">
          <p className="text-xs text-purple-700">
            <strong>Available placeholders:</strong>{" "}
            {"{{interview_location}}, {{company_name}}, {{site_name}}, {{interview_format}}, {{dress_code}}"}
          </p>
        </div>

        <EditableTable
          columns={faqColumns}
          data={faqs}
          onUpdate={handleFaqUpdate}
          onAdd={handleFaqAdd}
          onDelete={handleFaqDelete}
          onDuplicate={handleFaqDuplicate}
          addLabel="Add FAQ"
          csvConfig={{
            sampleRow: { faq: "Working Hours", example: "What are the working hours?", faqResponse: "Working hours are 9AM to 6PM, Monday to Friday." },
            onImport: handleCsvImport,
            sheetName: "AI Call FAQs",
          }}
        />
      </div>
    </div>
  );
}
