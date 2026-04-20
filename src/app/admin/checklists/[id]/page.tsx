import { redirect } from "next/navigation";

export default async function AdminChecklistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/checklists/${id}/welcome`);
}
