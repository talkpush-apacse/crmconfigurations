import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { ConfiguratorPageClient } from "@/components/configurator/ConfiguratorPageClient";

export default async function AdminConfiguratorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const auth = await getAuthUser();
  if (!auth) redirect("/admin/login");

  const { slug } = await params;
  const checklist = await prisma.checklist.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!checklist) redirect("/admin");

  return <ConfiguratorPageClient checklistId={checklist.id} />;
}
