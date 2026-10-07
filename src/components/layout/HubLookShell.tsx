"use client";

import { ChecklistLookProvider, useChecklistLookState } from "@/components/layout/ChecklistLook";
import type { ChecklistLook } from "@/lib/checklist-look";

/**
 * The page frame for the Companies pages: the Hub top bar and the page under it, in the same
 * Modern / Classic look as the checklists. The look is read from a cookie on the server so the
 * first paint is right. The switch is in the account menu (AdminHeader).
 */
export function HubLookShell({
  fontClass,
  initialLook,
  children,
}: {
  fontClass: string;
  initialLook: ChecklistLook;
  children: React.ReactNode;
}) {
  const { value, rootClass } = useChecklistLookState(initialLook, fontClass);
  return (
    <ChecklistLookProvider value={value}>
      <div className={`${rootClass} flex min-h-screen flex-col bg-background text-foreground`}>{children}</div>
    </ChecklistLookProvider>
  );
}
