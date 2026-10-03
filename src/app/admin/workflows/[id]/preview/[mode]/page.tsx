import PreviewClient from "./PreviewClient";

export const metadata = { title: "Preview | Workflow Builder" };

const LABELS: Record<string, string> = {
  viewer: "a Viewer",
  commenter: "a Commenter",
  "editor-direct": "an Editor (editing directly)",
  "editor-suggesting": "an Editor (suggesting)",
};

/** Staff "Preview as...": the real client page for a made-up visitor. Read only. */
export default async function PreviewPage({ params }: { params: Promise<{ id: string; mode: string }> }) {
  const { id, mode } = await params;
  return <PreviewClient workflowId={id} mode={mode} label={LABELS[mode] ?? mode} />;
}
