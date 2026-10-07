import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { HubLookShell } from "@/components/layout/HubLookShell";
import { figtree } from "@/lib/client-form-font";
import { LOOK_COOKIE, parseLook } from "@/lib/checklist-look";
import { CompanyGallery } from "@/components/companies/CompanyGallery";
import { PENDING_CONNECT_COOKIE } from "@/lib/mcp/oauth/session";

export const metadata = { title: "Accounts | Talkpush Implementation Hub" };

export default async function AdminHomePage() {
  // Someone who started connecting Claude before signing in is sent back to finish it.
  const jar = await cookies();
  if (jar.get(PENDING_CONNECT_COOKIE)?.value) redirect("/oauth/resume");
  const look = parseLook(jar.get(LOOK_COOKIE)?.value);

  return (
    <HubLookShell fontClass={figtree.variable} initialLook={look}>
      <AdminHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl p-4 md:p-8">
          <CompanyGallery />
        </div>
      </main>
    </HubLookShell>
  );
}
