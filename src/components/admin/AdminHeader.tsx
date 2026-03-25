"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Role } from "@/lib/types";

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  EDITOR: "Editor",
  VIEWER: "Viewer",
};

export function AdminHeader() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<Role | null>(null);

  useEffect(() => {
    fetch("/api/auth/check")
      .then((res) => res.json())
      .then((json) => {
        if (json.authenticated && json.role) setUserRole(json.role as Role);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/admin/login");
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center border-b border-gray-200 bg-white px-4">
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold text-gray-900">Talkpush CRM</span>
        <span className="hidden rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary sm:inline">
          Config Checklist
        </span>
      </div>

      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2" aria-label="User menu">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-4 w-4" />
              </span>
              <span className="hidden text-sm font-medium sm:block">
                {userRole ? ROLE_LABELS[userRole] : "..."}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {userRole && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                Role: {ROLE_LABELS[userRole]}
              </div>
            )}
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
