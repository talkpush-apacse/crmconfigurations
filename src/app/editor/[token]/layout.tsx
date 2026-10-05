import { loadPublicChecklistByToken } from "@/lib/checklist-loaders";
import { EditorChecklistShell } from "@/components/layout/EditorChecklistShell";
import type { ChecklistData } from "@/lib/types";

// Per-visitor data: never cache or prerender this layout.
export const dynamic = "force-dynamic";

export default async function EditorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let initialData: ChecklistData | null = null;
  try {
    initialData = await loadPublicChecklistByToken(token);
  } catch (err) {
    // Fall back to the browser loading it, which also reports "not found" the way it always did.
    console.error("[editor layout] could not preload checklist:", err instanceof Error ? err.message : err);
  }
  return (
    <EditorChecklistShell token={token} initialData={initialData}>
      {children}
    </EditorChecklistShell>
  );
}
