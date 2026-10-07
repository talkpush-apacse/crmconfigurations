import { loadPublicChecklistBySlug } from "@/lib/checklist-loaders";
import { ClientChecklistShell } from "@/components/layout/ClientChecklistShell";
import { figtree } from "@/lib/client-form-font";
import type { Viewport } from "next";
import { cookies } from "next/headers";
import { LOOK_COOKIE, parseLook } from "@/lib/checklist-look";
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
  const look = parseLook((await cookies()).get(LOOK_COOKIE)?.value);
  return (
    <ClientChecklistShell slug={slug} initialData={initialData} fontClass={figtree.variable} initialLook={look}>
      {children}
    </ClientChecklistShell>
  );
}
