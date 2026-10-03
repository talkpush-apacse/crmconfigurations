import WorkflowErrorBoundary from "@/components/workflow/WorkflowErrorBoundary";
import WorkflowEditor from "@/components/workflow/WorkflowEditor";
import { WorkflowToaster } from "@/components/workflow/ui/toast";

export const metadata = {
  title: "Workflow Editor | Talkpush CRM",
};

export default async function WorkflowEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <WorkflowErrorBoundary>
      <WorkflowEditor workflowId={id} />
      <WorkflowToaster />
    </WorkflowErrorBoundary>
  );
}
