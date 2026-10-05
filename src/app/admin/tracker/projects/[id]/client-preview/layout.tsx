import type { Metadata } from "next";

export const metadata: Metadata = { title: "Client preview" };

export default function ClientPreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
