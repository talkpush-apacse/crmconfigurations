import { redirect } from "next/navigation";

/** Fallback for the read-only view link: next.config.ts normally redirects /view/:token to the welcome page first. */
export default async function ViewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/view/${token}/welcome`);
}
