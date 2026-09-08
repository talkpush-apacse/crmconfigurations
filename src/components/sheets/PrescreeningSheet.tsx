"use client";

import { SheetIntro } from "@/components/shared/SheetIntro";
import { EditableTable } from "@/components/shared/EditableTable";
import { TabUploadBanner, TabUploadSkippedNotice } from "@/components/shared/TabUploadBanner";
import { useTabUpload } from "@/hooks/useTabUpload";
import { useChecklistContext } from "@/lib/checklist-context";
import { uid, defaultPrescreening } from "@/lib/template-data";
import type { ColumnDef, QuestionRow } from "@/lib/types";
import { DROPDOWN_OPTIONS } from "@/lib/validations";
import { SectionFooter } from "@/components/shared/SectionFooter";
import { softDeleteByIds, appendBulkDuplicates } from "@/lib/duplicate-row";

// Question type definitions, shown in the Question Type column tooltip.
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
    description: (
      <>
        <p>The input format candidates will use to answer.</p>
        {referenceData.map((r) => (
          <p key={r.type}>
            <strong>{r.type}</strong> — {r.description}
          </p>
        ))}
      </>
    ),
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
    label: "Applicable Jobs/Roles",
    type: "text",
    description: "Which role/job/account will this question apply for?",
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
  const { isSkipped, uploadedFiles } = useTabUpload("prescreening");
  const allQuestions = (data.prescreening as QuestionRow[]) || defaultPrescreening;
  const questions = allQuestions.filter((q) => !q.deletedAt);

  const fullIndexOf = (visibleIdx: number) => {
    const target = questions[visibleIdx];
    if (!target) return -1;
    return allQuestions.findIndex((q) => q.id === target.id);
  };

  const handleUpdate = (index: number, field: string, value: string | boolean) => {
    const fullIdx = fullIndexOf(index);
    if (fullIdx < 0) return;
    const updated = [...allQuestions];
    updated[fullIdx] = { ...updated[fullIdx], [field]: value as string };
    updateField("prescreening", updated);
  };

  const handleAdd = () => {
    updateField("prescreening", [...allQuestions, { id: uid(), ...EMPTY_QUESTION }]);
  };

  const handleDelete = (index: number) => {
    const target = questions[index];
    if (!target) return;
    updateField("prescreening", softDeleteByIds(allQuestions, [target.id]));
  };

  const handleDuplicate = (index: number) => {
    const target = questions[index];
    if (!target) return;
    updateField("prescreening", appendBulkDuplicates("prescreening", allQuestions, questions, [target.id]));
  };

  const handleBulkDelete = (ids: string[]) => {
    updateField("prescreening", softDeleteByIds(allQuestions, ids));
  };

  const handleBulkDuplicate = (ids: string[]) => {
    updateField("prescreening", appendBulkDuplicates("prescreening", allQuestions, questions, ids));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCsvImport = (rows: Record<string, any>[]) => {
    const newRows = rows.map((row) => ({
      id: uid(),
      ...EMPTY_QUESTION,
      ...row,
    }));
    updateField("prescreening", [...allQuestions, ...newRows]);
  };

  return (
    <div>
      <SheetIntro
        title="Pre-Screening Questions"
        description="Define the questions candidates will answer during the screening process. Use answer options for Multiple Choice and Dropdown types."
      />

      <TabUploadBanner tabKey="prescreening" tabLabel="Pre-Screening Questions" compact />

      {isSkipped ? (
        <TabUploadSkippedNotice fileCount={uploadedFiles.length} />
      ) : (
        <>
      <EditableTable
        columns={columns}
        detailColumns={detailColumns}
        data={questions}
        onUpdate={handleUpdate}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        spreadsheetMode
        tableId="prescreening"
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
        bulkActions={{
          itemLabel: "question",
          itemLabelPlural: "questions",
          onBulkDelete: handleBulkDelete,
          onBulkDuplicate: handleBulkDuplicate,
        }}
      />
        </>
      )}
      <SectionFooter />
    </div>
  );
}
