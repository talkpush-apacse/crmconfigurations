import { AdminHeader } from "@/components/admin/AdminHeader";

export default function ConnectionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AdminHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
