import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ClipboardList, FolderKanban, GitBranch } from "lucide-react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { PORTAL_MODULES, type ModuleId } from "@/lib/modules";
import { PENDING_CONNECT_COOKIE } from "@/lib/mcp/oauth/session";

const ICONS: Record<ModuleId, typeof ClipboardList> = {
  checklist: ClipboardList,
  tracker: FolderKanban,
  workflows: GitBranch,
};

export const metadata = { title: "Talkpush Implementation Hub" };

export default async function AdminHomePage() {
  // Someone who started connecting Claude before signing in is sent back to finish it.
  if ((await cookies()).get(PENDING_CONNECT_COOKIE)?.value) redirect("/oauth/resume");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AdminHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl p-4 md:p-8">
          <section className="relative overflow-hidden rounded-xl border border-border bg-card">
            <div className="brand-gradient-strip h-1.5" aria-hidden="true" />
            <span aria-hidden="true" className="absolute right-10 top-8 h-3 w-3 rotate-12 bg-brand-sage opacity-50" />
            <span aria-hidden="true" className="absolute right-20 top-14 h-2.5 w-2.5 -rotate-12 bg-brand-pink opacity-50" />
            <span aria-hidden="true" className="absolute right-6 top-20 h-2 w-2 rotate-45 bg-brand-amber opacity-50" />
            <div className="p-6 md:p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Talkpush Implementation Hub
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                Pick a module to start
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Set up a client&apos;s CRM in the checklist, follow their implementation in the tracker, or map their hiring process in the workflow builder.
              </p>
            </div>
          </section>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {PORTAL_MODULES.map((module) => {
              const Icon = ICONS[module.id];
              return (
                <Link
                  key={module.id}
                  href={module.href}
                  className="group flex min-h-11 flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-sm outline-none transition-shadow hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/70"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-foreground">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">{module.label}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{module.description}</p>
                  </div>
                  <span className="flex items-center gap-1 text-sm font-medium text-foreground">
                    Open {module.label}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
