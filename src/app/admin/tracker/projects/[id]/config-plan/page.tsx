import { ConfigPlanView } from "@/components/tracker/ConfigPlanView";

export default async function ConfigPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConfigPlanView projectId={id} />;
}
