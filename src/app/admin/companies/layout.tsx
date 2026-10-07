import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/AdminHeader";

export const metadata: Metadata = {
  title: { default: "Companies | Talkpush Implementation Hub", template: "%s | Talkpush Implementation Hub" },
};

export default function CompaniesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AdminHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
