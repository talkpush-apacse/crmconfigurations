import { loadPublicChecklistByToken } from "@/lib/checklist-loaders";
import { EditorChecklistShell } from "@/components/layout/EditorChecklistShell";
import { figtree } from "@/lib/client-form-font";
import type { Viewport } from "next";
import type { ChecklistData } from "@/lib/types";

// Clients can pinch to zoom the text here. The root layout locks zoom at 100%, which fails WCAG 1.4.4.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The root layout sets maximumScale 1; a child layout inherits it unless it sets its own.
  maximumScale: 5,
  userScalable: true,
  themeColor: "#1B365D",
};

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
    <EditorChecklistShell token={token} initialData={initialData} fontClass={figtree.variable}>
      {children}
    </EditorChecklistShell>
  );
}
