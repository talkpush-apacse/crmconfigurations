import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";

/**
 * Landing page for a client link.
 *
 * This used to redirect to /editor/<editorToken>, so anyone given a client
 * link ended up in the editor view — which shows the tabs Talkpush fills in
 * and can reorder tabs and reassign who fills them. It also meant the
 * client-view filtering never applied to real users, because nobody stayed on
 * this route. Clients now land on their own view; the editor link stays
 * separate for Talkpush staff.
 */
export default async function ClientPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const checklist = await prisma.checklist.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!checklist) {
    notFound();
  }

  redirect(`/client/${slug}/welcome`);
}
