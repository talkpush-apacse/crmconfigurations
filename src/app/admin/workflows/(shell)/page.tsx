import WorkflowDashboard from "@/components/workflow/WorkflowDashboard";
import { WorkflowToaster } from "@/components/workflow/ui/toast";

export const metadata = {
  title: "Workflow Builder | Talkpush CRM",
};

export default function WorkflowsPage() {
  return (
    <>
      <WorkflowDashboard />
      <WorkflowToaster />
    </>
  );
}
