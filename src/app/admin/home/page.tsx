import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { CompanyGallery } from "@/components/companies/CompanyGallery";
import { PENDING_CONNECT_COOKIE } from "@/lib/mcp/oauth/session";

export const metadata = { title: "Accounts | Talkpush Implementation Hub" };

export default async function AdminHomePage() {
  // Someone who started connecting Claude before signing in is sent back to finish it.
  if ((await cookies()).get(PENDING_CONNECT_COOKIE)?.value) redirect("/oauth/resume");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AdminHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl p-4 md:p-8">
          <CompanyGallery />
        </div>
      </main>
    </div>
  );
}
