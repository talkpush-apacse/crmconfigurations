import { NewChecklistForm } from "@/components/admin/NewChecklistForm";

export default async function NewChecklistPage({ searchParams }: { searchParams: Promise<{ account?: string | string[] }> }) {
  const { account } = await searchParams;
  return <NewChecklistForm fromCompany={typeof account === "string" && account ? account : null} />;
}
