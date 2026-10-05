import { ContributorView } from "@/components/tracker/ContributorView";

/**
 * The page a client contact opens from their private contributor link. No sign-in, no staff chrome.
 * All data and every change goes through /api/contribute/[token], which checks the link each time.
 */
export default async function ContributePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ContributorView token={token} />;
}
