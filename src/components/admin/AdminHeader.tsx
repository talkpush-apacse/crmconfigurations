"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, Eye, LayoutGrid, LogOut, PlugZap, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PORTAL_MODULES, getActiveModule } from "@/lib/modules";
import { ROLE_LABELS } from "@/lib/roles";
import { resetCurrentUser, useCurrentUser } from "@/lib/use-current-user";

export function AdminHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const activeModule = PORTAL_MODULES.find((m) => m.id === getActiveModule(pathname));
  const { user, canEdit } = useCurrentUser();

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    resetCurrentUser();
    router.push("/admin/login");
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center border-b border-border bg-card px-4">
      <div className="flex items-center gap-2">
        <Link
          href="/admin/home"
          className="flex min-h-11 items-center rounded-md text-sm font-semibold text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/70 sm:text-base md:min-h-0"
        >
          <span className="hidden sm:inline">Talkpush Implementation Hub</span>
          <span className="sm:hidden">Implementation Hub</span>
        </Link>
        {activeModule && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex min-h-11 items-center gap-1 rounded-md bg-primary/10 px-3 py-1 text-xs font-medium text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/70 md:min-h-6 md:px-2"
                aria-label={`Switch module (current: ${activeModule.label})`}
              >
                {activeModule.shortLabel}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {PORTAL_MODULES.map((m) => (
                <DropdownMenuItem key={m.id} asChild className="cursor-pointer">
                  <Link href={m.href} className="flex min-h-11 items-center justify-between gap-2 md:min-h-0">
                    {m.label}
                    {m.id === activeModule.id && <Check className="h-4 w-4" />}
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href="/admin/home" className="flex min-h-11 items-center gap-2 md:min-h-0">
                  <LayoutGrid className="h-4 w-4" />
                  All modules
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {user && !canEdit && (
          <span
            className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-foreground"
            title="You can look at everything but cannot change anything. Ask an editor if something needs changing."
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            {ROLE_LABELS[user.role]}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="min-h-11 min-w-11 gap-2 md:min-h-0 md:min-w-0" aria-label="User menu">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-4 w-4" />
              </span>
              <span className="hidden text-sm font-medium sm:block">{user?.email ?? "Admin"}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {canEdit && (
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href="/admin/users" className="flex min-h-11 items-center gap-2 md:min-h-0">
                  <Users className="h-4 w-4" />
                  Users
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/admin/connections" className="flex min-h-11 items-center gap-2 md:min-h-0">
                <PlugZap className="h-4 w-4" />
                Connected apps
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="min-h-11 cursor-pointer text-destructive focus:text-destructive md:min-h-0"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
