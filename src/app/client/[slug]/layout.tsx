"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useChecklist } from "@/hooks/useChecklist";
import { TopNav } from "@/components/layout/TopNav";
import { LegendBar } from "@/components/layout/LegendBar";
import { Header } from "@/components/layout/Header";
import { ChecklistContext } from "@/lib/checklist-context";
import { getEnabledTabs } from "@/lib/tab-config";
import { getSectionState } from "@/lib/section-status";
import type { ChecklistData, Role } from "@/lib/types";
import type { NavItem } from "@/components/layout/TopNav";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const slug = params.slug as string;
  const { data, loading, error, saveStatus, saveError, updateField, retrySave, hasPendingChangesRef } = useChecklist(slug);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<Role | null>(null);

  // Check auth status to determine role and admin-only tab visibility
  useEffect(() => {
    fetch("/api/auth/check")
      .then((res) => res.json())
      .then((json) => {
        if (json.authenticated && json.role) {
          setUserRole(json.role as Role);
          setIsAdmin(json.role === "ADMIN");
        } else {
          // Backward compat: old response format
          setIsAdmin(json.isAdmin === true);
        }
      })
      .catch(() => {
        setIsAdmin(false);
        setUserRole(null);
      });
  }, []);

  const isReadOnly = userRole === "VIEWER";

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Loading checklist...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-destructive">Checklist not found</p>
          <p className="mt-2 text-sm text-muted-foreground">{error || "This checklist does not exist."}</p>
        </div>
      </div>
    );
  }

  const enabledTabs = getEnabledTabs(data.enabledTabs ?? null, isAdmin);

  const tabsWithData = enabledTabs.filter((t) => t.dataKey);
  const filledCount = tabsWithData.filter((t) => {
    const val = (data as ChecklistData)[t.dataKey as keyof ChecklistData];
    if (val === null || val === undefined) return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === "object") return Object.values(val as unknown as Record<string, unknown>).some((v) => v !== "" && v !== null);
    return true;
  }).length;
  const totalCount = tabsWithData.length;

  const navItems: NavItem[] = enabledTabs.map((tab) => {
    let status: NavItem["status"] = null;
    if (tab.dataKey && data) {
      status = getSectionState((data as ChecklistData)[tab.dataKey as keyof ChecklistData]);
    }
    return {
      label: tab.label,
      href: `/client/${slug}/${tab.slug}`,
      status,
      icon: tab.icon,
    };
  });

  return (
    <ChecklistContext.Provider value={{ data, updateField, saveStatus, saveError, retrySave, isReadOnly, userRole }}>
      <div className="flex h-screen flex-col overflow-hidden">
        <Header
          clientName={data.clientName}
          slug={slug}
          saveStatus={saveStatus}
          saveError={saveError}
          onRetrySave={retrySave}
          filledCount={filledCount}
          totalCount={totalCount}
          isReadOnly={isReadOnly}
        />
        <div className="flex flex-1 overflow-hidden">
          <TopNav items={navItems} hasPendingChangesRef={hasPendingChangesRef} />
          <div className="flex flex-col flex-1 overflow-hidden">
            <LegendBar />
            <main className="flex-1 overflow-y-auto">
              <div className="px-4 py-5 sm:px-6 lg:px-8">{children}</div>
            </main>
          </div>
        </div>
      </div>
    </ChecklistContext.Provider>
  );
}
