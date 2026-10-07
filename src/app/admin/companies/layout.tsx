import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { HubLookShell } from "@/components/layout/HubLookShell";
import { figtree } from "@/lib/client-form-font";
import { LOOK_COOKIE, parseLook } from "@/lib/checklist-look";

export const metadata: Metadata = {
  title: { default: "Companies | Talkpush Implementation Hub", template: "%s | Talkpush Implementation Hub" },
};

export default async function CompaniesLayout({ children }: { children: React.ReactNode }) {
  const look = parseLook((await cookies()).get(LOOK_COOKIE)?.value);
  return (
    <HubLookShell fontClass={figtree.variable} initialLook={look}>
      <AdminHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl p-4 md:p-8">{children}</div>
      </main>
    </HubLookShell>
  );
}
