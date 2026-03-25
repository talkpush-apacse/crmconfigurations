import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function ClientPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const checklist = await prisma.checklist.findUnique({
    where: { slug },
    select: { editorToken: true },
  });

  if (!checklist) {
    notFound();
  }

  redirect(`/editor/${checklist.editorToken}/welcome`);
}
