"use client";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { KeyValueForm, type KeyValueField } from "@/components/shared/KeyValueForm";
import { EditableTable } from "@/components/shared/EditableTable";
import { useChecklistContext } from "@/lib/checklist-context";
import { uid, defaultInstagram } from "@/lib/template-data";
import type { ColumnDef, InstagramData, FaqEntry } from "@/lib/types";

const requirementsList = [
  "Provide your Instagram Business Account details",
  "Coordinate two-factor authentication setup with Talkpush",
  "Confirm your Instagram Business Account is connected to Facebook",
];

const fields: KeyValueField[] = [
  { key: "instagramAccount", label: "Instagram Account", description: "Your Instagram Business Account username or handle.", type: "text" },
  { key: "twoFactorAuth", label: "Two-Factor Authentication", description: "Has two-factor authentication been coordinated with Talkpush?", type: "text" },
  { key: "businessAccountConnection", label: "Business Account Connection", description: "Is your Instagram Business Account connected to your Facebook page?", type: "text" },
  { key: "chatbotName", label: "Chatbot Name", description: "The name that will appear as the chatbot identity in Instagram conversations.", type: "text" },
  { key: "chatbotPersona", label: "Chatbot Persona", description: "The personality/tone the chatbot should use in Instagram messages.", type: "text" },
];

const faqColumns: ColumnDef[] = [
  { key: "category", label: "Category", type: "text", description: "Category of the FAQ (e.g., General, Technical, Process)" },
  { key: "faq", label: "FAQ", type: "text", description: "The frequently asked question topic" },
  { key: "description", label: "Description", type: "text", description: "Brief description of the FAQ" },
  { key: "example", label: "Example Question", type: "text", description: "A sample question a candidate might ask" },
  { key: "faqResponse", label: "Response", type: "textarea", description: "The chatbot's response to this FAQ", width: "30%" },
];

export function InstagramSheet() {
  const { data, updateField } = useChecklistContext();
  const igData = (data.instagram as InstagramData) || defaultInstagram;
  const faqs = igData.faqs || [];

  const handleChange = (key: string, value: string | boolean) => {
    updateField("instagram", { ...igData, [key]: value });
  };

  const handleFaqUpdate = (index: number, field: string, value: string | boolean) => {
    const updated = [...faqs];
    updated[index] = { ...updated[index], [field]: value };
    updateField("instagram", { ...igData, faqs: updated });
  };

  const handleFaqAdd = () => {
    const newFaq: FaqEntry = {
      id: uid(),
      category: "",
      faq: "",
      description: "",
      example: "",
      faqResponse: "",
    };
    updateField("instagram", { ...igData, faqs: [...faqs, newFaq] });
  };

  const handleFaqDelete = (index: number) => {
    updateField("instagram", { ...igData, faqs: faqs.filter((_, i) => i !== index) });
  };

  const handleFaqDuplicate = (index: number) => {
    const clone = { ...faqs[index], id: uid() };
    const updated = [...faqs];
    updated.splice(index + 1, 0, clone);
    updateField("instagram", { ...igData, faqs: updated });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleFaqCsvImport = (rows: Record<string, any>[]) => {
    const newRows = rows.map((row) => ({
      id: uid(),
      category: "", faq: "", description: "", example: "", faqResponse: "",
      ...row,
    }));
    updateField("instagram", { ...igData, faqs: [...faqs, ...newRows] });
  };

  return (
    <div>
      <SectionHeader
        title="Instagram Chatbot"
        description="Configure your Instagram chatbot integration."
      />

      <div className="mb-6 rounded-lg border">
        <div className="bg-gray-100 px-4 py-2 text-sm font-medium">Setup Requirements</div>
        <div className="p-4">
          <ol className="space-y-2 text-sm text-muted-foreground">
            {requirementsList.map((req, i) => (
              <li key={i} className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#535FC1] text-xs text-white">
                  {i + 1}
                </span>
                {req}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <KeyValueForm
        fields={fields}
        data={igData as unknown as Record<string, string | boolean>}
        onChange={handleChange}
      />

      <div className="mt-8">
        <SectionHeader
          title="Chatbot FAQs"
          description="Define frequently asked questions and responses for the Instagram chatbot."
        />
        <EditableTable
          columns={faqColumns}
          data={faqs}
          onUpdate={handleFaqUpdate}
          onAdd={handleFaqAdd}
          onDelete={handleFaqDelete}
          onDuplicate={handleFaqDuplicate}
          addLabel="Add FAQ"
          csvConfig={{
            sampleRow: { category: "General", faq: "Working Hours", description: "Office hours question", example: "What are your working hours?", faqResponse: "Our office hours are 9AM to 6PM." },
            onImport: handleFaqCsvImport,
            sheetName: "Instagram FAQs",
          }}
        />
      </div>
    </div>
  );
}
