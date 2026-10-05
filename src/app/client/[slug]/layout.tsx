import { loadPublicChecklistBySlug } from "@/lib/checklist-loaders";
import { ClientChecklistShell } from "@/components/layout/ClientChecklistShell";
import type { ChecklistData } from "@/lib/types";

// Per-visitor data: never cache or prerender this layout.
export const dynamic = "force-dynamic";

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let initialData: ChecklistData | null = null;
  try {
    initialData = await loadPublicChecklistBySlug(slug);
  } catch (err) {
    // Fall back to the browser loading it, which also reports "not found" the way it always did.
    console.error("[client layout] could not preload checklist:", err instanceof Error ? err.message : err);
  }
  return (
    <ClientChecklistShell slug={slug} initialData={initialData}>
      {children}
    </ClientChecklistShell>
  );
}
