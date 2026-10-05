import WorkflowDashboard from "@/components/workflow/WorkflowDashboard";
import { WorkflowToaster } from "@/components/workflow/ui/toast";

export const metadata = {
  title: "Workflow builder | Talkpush Implementation Hub",
};

export default function WorkflowsPage() {
  return (
    <>
      <WorkflowDashboard />
      <WorkflowToaster />
    </>
  );
}
