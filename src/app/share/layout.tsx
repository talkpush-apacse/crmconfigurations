import type { Metadata } from "next";

// Client links are private: never indexed, and never leak the secret URL through a Referer header.
export const metadata: Metadata = {
  title: "Project status",
  description: "Project status shared by Talkpush.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
