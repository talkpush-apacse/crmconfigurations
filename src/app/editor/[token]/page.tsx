import { redirect } from "next/navigation";

export default async function EditorPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/editor/${token}/welcome`);
}
