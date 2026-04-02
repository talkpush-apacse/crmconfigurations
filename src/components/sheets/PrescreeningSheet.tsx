"use client";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { ExampleHint } from "@/components/shared/ExampleHint";
import { EditableTable } from "@/components/shared/EditableTable";
import { useChecklistContext } from "@/lib/checklist-context";
import { uid, defaultPrescreening } from "@/lib/template-data";
import type { ColumnDef, QuestionRow } from "@/lib/types";
import { DROPDOWN_OPTIONS } from "@/lib/validations";
import { SectionFooter } from "@/components/shared/SectionFooter";

const columns: ColumnDef[] = [
  {
    key: "category",
    label: "Category",
    type: "dropdown",
    options: ["Pre-screening", "Follow-up"],
    required: true,
    description: "Whether this question appears in the pre-screening or follow-up flow",
  },
  {
    key: "question",
    label: "Question",
    type: "textarea",
    required: true,
    description: "The question text shown to candidates",
  },
  {
    key: "questionType",
    label: "Question Type",
    type: "dropdown",
    options: [...DROPDOWN_OPTIONS.questionTypes],
    required: true,
    description: "The input format candidates will use to answer",
  },
];

const detailColumns: ColumnDef[] = [
  {
    key: "answerOptions",
    label: "Answer Options",
    type: "text",
    description: "Comma-separated list of choices (required for Multiple Choice and Dropdown types)",
    example: "Yes, No, Maybe",
  },
  {
    key: "applicableCampaigns",
    label: "Applicable Campaigns",
    type: "text",
    description: "Comma-separated campaign names. Leave blank to apply globally.",
    example: "CSR - Makati, TSR - BGC Night",
  },
  {
    key: "autoReject",
    label: "Auto-Reject",
    type: "dropdown",
    options: [...DROPDOWN_OPTIONS.yesNo],
    description: "Whether specific answers should automatically disqualify the candidate",
  },
  {
    key: "rejectCondition",
    label: "Reject Condition",
    type: "text",
    description: "The answer or threshold that triggers automatic rejection",
    example: "Answer equals \"No\"",
  },
  {
    key: "rejectReason",
    label: "Reject Reason",
    type: "text",
    description: "Reason shown to candidate or logged internally when auto-rejected",
    example: "Night shift availability is required",
  },
  {
    key: "comments",
    label: "Comments",
    type: "textarea",
    description: "Internal notes for reviewers or implementation guidance",
  },
];

const referenceData = [
  { type: "Text", description: "Free-form text response from the candidate." },
  { type: "Number", description: "Numeric input only." },
  { type: "Multiple Choice", description: "Candidate picks one or more from predefined options." },
  { type: "Dropdown", description: "Single selection from a dropdown list of options." },
  { type: "Audio", description: "Candidate records a voice response." },
  { type: "Audio or Text", description: "Candidate can respond with voice or text." },
  { type: "Video", description: "Candidate records a video response." },
  { type: "File Upload", description: "Candidate uploads a file (resume, ID, etc.)." },
  { type: "Play Media", description: "Plays a media file to the candidate (no response collected)." },
  { type: "Geolocation", description: "Captures the candidate's GPS location." },
];

const EMPTY_QUESTION: Omit<QuestionRow, "id"> = {
  category: "Pre-screening",
  question: "",
  questionType: "",
  answerOptions: "",
  applicableCampaigns: "",
  autoReject: "",
  rejectCondition: "",
  rejectReason: "",
  comments: "",
};

export function PrescreeningSheet() {
  const { data, updateField } = useChecklistContext();
  const questions = (data.prescreening as QuestionRow[]) || defaultPrescreening;

  const handleUpdate = (index: number, field: string, value: string | boolean) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value as string };
    updateField("prescreening", updated);
  };

  const handleAdd = () => {
    updateField("prescreening", [...questions, { id: uid(), ...EMPTY_QUESTION }]);
  };

  const handleDelete = (index: number) => {
    updateField("prescreening", questions.filter((_, i) => i !== index));
  };

  const handleDuplicate = (index: number) => {
    const clone = { ...questions[index], id: uid() };
    const updated = [...questions];
    updated.splice(index + 1, 0, clone);
    updateField("prescreening", updated);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCsvImport = (rows: Record<string, any>[]) => {
    const newRows = rows.map((row) => ({
      id: uid(),
      ...EMPTY_QUESTION,
      ...row,
    }));
    updateField("prescreening", [...questions, ...newRows]);
  };

  return (
    <div>
      <SectionHeader
        title="Pre-Screening Questions"
        description="Define the questions candidates will answer during the screening process. Use answer options for Multiple Choice and Dropdown types."
      />

      <ExampleHint>
        <p className="mb-1 font-medium">Sample questions:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li><strong>Are you willing to work night shifts?</strong> | Multiple Choice | Yes, No | Auto-reject if &quot;No&quot;</li>
          <li><strong>How many years of BPO experience do you have?</strong> | Number | No options needed</li>
          <li><strong>Please upload your latest resume</strong> | File Upload | Follow-up question</li>
        </ul>
      </ExampleHint>

      <div className="mb-6 rounded-lg border border-gray-200 bg-slate-50 overflow-hidden">
        <div className="bg-slate-100 border-b border-gray-200 px-4 py-2.5 text-[13px] font-semibold text-gray-700">
          Question Type Reference
        </div>
        <div className="divide-y divide-gray-200">
          {referenceData.map((r) => (
            <div key={r.type} className="grid px-4 py-2.5" style={{ gridTemplateColumns: "160px 1fr" }}>
              <span className="text-[14px] font-medium text-gray-900">{r.type}</span>
              <span className="text-[14px] text-gray-500">{r.description}</span>
            </div>
          ))}
        </div>
      </div>

      <EditableTable
        columns={columns}
        detailColumns={detailColumns}
        data={questions}
        onUpdate={handleUpdate}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        addLabel="Add Question"
        sampleRow={{
          category: "Pre-screening",
          question: "Are you willing to work night shifts?",
          questionType: "Multiple Choice",
        }}
        csvConfig={{
          sampleRow: {
            category: "Pre-screening",
            question: "Are you willing to work night shifts?",
            questionType: "Multiple Choice",
            answerOptions: "Yes, No",
            applicableCampaigns: "CSR - Makati, TSR - BGC Night",
            autoReject: "Yes",
            rejectCondition: "Answer equals \"No\"",
            rejectReason: "Night shift availability is required",
            comments: "Critical for night-shift campaigns",
          },
          onImport: handleCsvImport,
          sheetName: "Pre-Screening Questions",
        }}
      />
      <SectionFooter />
    </div>
  );
}
