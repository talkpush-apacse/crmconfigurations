import { loadPublicChecklistByViewToken } from "@/lib/checklist-loaders";
import { ViewChecklistShell } from "@/components/layout/ViewChecklistShell";
import { figtree } from "@/lib/client-form-font";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { LOOK_COOKIE, parseLook } from "@/lib/checklist-look";
import type { ChecklistData } from "@/lib/types";

// Read-only link with a secret in the address: keep it out of search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Pinch to zoom the text, as on the client and editor links (WCAG 1.4.4).
  maximumScale: 5,
  userScalable: true,
  themeColor: "#1B365D",
};

// Per-visitor data, and a turned-off link must stop working at once: never cache or prerender this layout.
export const dynamic = "force-dynamic";

export default async function ViewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let initialData: ChecklistData | null = null;
  let failed = false;
  try {
    initialData = await loadPublicChecklistByViewToken(token);
  } catch (err) {
    failed = true;
    console.error("[view layout] could not load checklist:", err instanceof Error ? err.message : err);
  }
  const look = parseLook((await cookies()).get(LOOK_COOKIE)?.value);
  return (
    <ViewChecklistShell token={token} data={initialData} failed={failed} fontClass={figtree.variable} initialLook={look}>
      {children}
    </ViewChecklistShell>
  );
}
