"use client";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { EditableTable } from "@/components/shared/EditableTable";
import { useChecklistContext } from "@/lib/checklist-context";
import { DROPDOWN_OPTIONS } from "@/lib/validations";
import { defaultPrescreening } from "@/lib/template-data";
import type { ColumnDef, QuestionRow } from "@/lib/types";

const columns: ColumnDef[] = [
  { key: "category", label: "Category", type: "dropdown", options: ["Pre-screening", "Follow-up"], description: "Whether this is a pre-screening or follow-up question" },
  { key: "question", label: "Question", type: "textarea", description: "The actual question text shown to candidates" },
  { key: "questionType", label: "Question Type", type: "dropdown", options: [...DROPDOWN_OPTIONS.questionTypes], description: "The format/type of response expected from the candidate" },
  { key: "answerOptions", label: "Answer Options", type: "textarea", description: "For Multiple Choice/Dropdown types, list the available options separated by commas" },
  { key: "applicableCampaigns", label: "Applicable Campaigns", type: "text", description: "Which campaigns this question applies to (leave blank for all)" },
  { key: "autoReject", label: "Auto-Reject", type: "dropdown", options: [...DROPDOWN_OPTIONS.yesNo], description: "Should incorrect answers automatically reject the candidate?" },
  { key: "rejectCondition", label: "Reject Condition", type: "text", description: "The condition that triggers auto-rejection (e.g., answer = 'No')" },
  { key: "rejectReason", label: "Reject Reason", type: "text", description: "Message shown to rejected candidates" },
  { key: "comments", label: "Comments", type: "text" },
];

const referenceData = [
  { type: "Text", description: "Free-form text response" },
  { type: "Number", description: "Numeric input" },
  { type: "Multiple Choice", description: "Select one or more from predefined options" },
  { type: "Dropdown", description: "Select one from a dropdown list" },
  { type: "Audio", description: "Voice recording response" },
  { type: "Audio or Text", description: "Candidate can choose voice or text" },
  { type: "Video", description: "Video recording response" },
  { type: "File Upload", description: "Upload a document or file" },
  { type: "Play Media", description: "Play a media file (informational, no response)" },
  { type: "Geolocation", description: "Capture candidate's location" },
];

export function PrescreeningSheet() {
  const { data, updateField } = useChecklistContext();
  const questions = (data.prescreening as QuestionRow[]) || defaultPrescreening;

  const handleUpdate = (index: number, field: string, value: string | boolean) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    updateField("prescreening", updated);
  };

  const handleAdd = () => {
    updateField("prescreening", [
      ...questions,
      { id: Math.random().toString(36).substring(2, 9), category: "Pre-screening", question: "", questionType: "", answerOptions: "", applicableCampaigns: "", autoReject: "", rejectCondition: "", rejectReason: "", comments: "" },
    ]);
  };

  const handleDelete = (index: number) => {
    updateField("prescreening", questions.filter((_, i) => i !== index));
  };

  const handleDuplicate = (index: number) => {
    const clone = { ...questions[index], id: Math.random().toString(36).substring(2, 9) };
    const updated = [...questions];
    updated.splice(index + 1, 0, clone);
    updateField("prescreening", updated);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCsvImport = (rows: Record<string, any>[]) => {
    const newRows = rows.map((row) => ({
      id: Math.random().toString(36).substring(2, 9),
      category: "Pre-screening", question: "", questionType: "", answerOptions: "", applicableCampaigns: "", autoReject: "", rejectCondition: "", rejectReason: "", comments: "",
      ...row,
    }));
    updateField("prescreening", [...questions, ...newRows]);
  };

  return (
    <div>
      <SectionHeader
        title="Pre-screening & Follow-up Questions"
        description="Define the questions candidates will answer during the screening process."
      />

      <div className="mb-6 rounded-lg border">
        <div className="bg-gray-100 px-4 py-2 text-sm font-medium">Question Type Reference</div>
        <div className="divide-y">
          {referenceData.map((r) => (
            <div key={r.type} className="flex gap-4 px-4 py-2 text-sm">
              <span className="w-32 shrink-0 font-medium">{r.type}</span>
              <span className="text-muted-foreground">{r.description}</span>
            </div>
          ))}
        </div>
      </div>

      <EditableTable
        columns={columns}
        data={questions}
        onUpdate={handleUpdate}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        addLabel="Add Question"
        csvConfig={{
          sampleRow: { category: "Pre-screening", question: "Are you available to start immediately?", questionType: "Multiple Choice", answerOptions: "Yes, No", autoReject: "Yes", rejectCondition: "No" },
          onImport: handleCsvImport,
          sheetName: "Pre-screening Questions",
        }}
      />
    </div>
  );
}
