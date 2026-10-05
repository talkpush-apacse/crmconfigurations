import { redirect } from "next/navigation";

/**
 * Landing page for a client link. Normally never reached: next.config.ts redirects /client/:slug to
 * /client/:slug/welcome before any code runs. Kept as a fallback, and deliberately free of database
 * calls — an unknown slug is reported by the checklist layout ("Checklist not found").
 *
 * Clients land on their own view, not /editor/<token>, which shows Talkpush-filled tabs and can
 * reorder tabs.
 */
export default async function ClientPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/client/${slug}/welcome`);
}
