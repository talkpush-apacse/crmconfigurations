"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, LayoutGrid, LogOut, PlugZap, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PORTAL_MODULES, getActiveModule } from "@/lib/modules";

export function AdminHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const activeModule = PORTAL_MODULES.find((m) => m.id === getActiveModule(pathname));

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/admin/login");
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center border-b border-border bg-card px-4">
      <div className="flex items-center gap-2">
        <Link href="/admin/home" className="text-sm font-semibold text-foreground sm:text-base">
          <span className="hidden sm:inline">Talkpush Implementation Hub</span>
          <span className="sm:hidden">Implementation Hub</span>
        </Link>
        {activeModule && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex min-h-6 items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                aria-label={`Switch module (current: ${activeModule.label})`}
              >
                {activeModule.shortLabel}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {PORTAL_MODULES.map((m) => (
                <DropdownMenuItem key={m.id} asChild className="cursor-pointer">
                  <Link href={m.href} className="flex items-center justify-between gap-2">
                    {m.label}
                    {m.id === activeModule.id && <Check className="h-4 w-4" />}
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href="/admin/home" className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  All modules
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2" aria-label="User menu">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-4 w-4" />
              </span>
              <span className="hidden text-sm font-medium sm:block">
                Admin
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/admin/connections" className="flex items-center gap-2">
                <PlugZap className="h-4 w-4" />
                Connected apps
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
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
