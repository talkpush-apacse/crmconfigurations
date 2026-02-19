"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { getTabBySlug, getEnabledTabs } from "@/lib/tab-config";
import { useChecklistContext } from "@/lib/checklist-context";
import { WelcomeSheet } from "@/components/sheets/WelcomeSheet";
import { CompanyInfoSheet } from "@/components/sheets/CompanyInfoSheet";
import { UserListSheet } from "@/components/sheets/UserListSheet";
import { CampaignsSheet } from "@/components/sheets/CampaignsSheet";
import { SitesSheet } from "@/components/sheets/SitesSheet";
import { PrescreeningSheet } from "@/components/sheets/PrescreeningSheet";
import { MessagingSheet } from "@/components/sheets/MessagingSheet";
import { SourcesSheet } from "@/components/sheets/SourcesSheet";
import { FoldersSheet } from "@/components/sheets/FoldersSheet";
import { DocumentsSheet } from "@/components/sheets/DocumentsSheet";
import { FacebookWhatsAppSheet } from "@/components/sheets/FacebookWhatsAppSheet";
import { InstagramSheet } from "@/components/sheets/InstagramSheet";
import { AICallFAQsSheet } from "@/components/sheets/AICallFAQsSheet";
import { AgencyPortalSheet } from "@/components/sheets/AgencyPortalSheet";

const sheetComponents: Record<string, React.ComponentType> = {
  welcome: WelcomeSheet,
  "company-info": CompanyInfoSheet,
  users: UserListSheet,
  campaigns: CampaignsSheet,
  sites: SitesSheet,
  prescreening: PrescreeningSheet,
  messaging: MessagingSheet,
  sources: SourcesSheet,
  folders: FoldersSheet,
  documents: DocumentsSheet,
  "facebook-whatsapp": FacebookWhatsAppSheet,
  instagram: InstagramSheet,
  "ai-call-faqs": AICallFAQsSheet,
  "agency-portal": AgencyPortalSheet,
};

export default function TabPage() {
  const params = useParams();
  const router = useRouter();
  const tab = params.tab as string;
  const slug = params.slug as string;
  const { data } = useChecklistContext();
  const tabConfig = getTabBySlug(tab);

  const enabledTabs = getEnabledTabs(data?.enabledTabs ?? null);
  const isEnabled = enabledTabs.some((t) => t.slug === tab);

  // Auto-redirect to first enabled tab if current tab is disabled
  useEffect(() => {
    if (tabConfig && !isEnabled && enabledTabs.length > 0) {
      router.replace(`/client/${slug}/${enabledTabs[0].slug}`);
    }
  }, [tabConfig, isEnabled, enabledTabs, slug, router]);

  if (!tabConfig) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Tab not found</p>
      </div>
    );
  }

  // Guard against disabled tabs (render nothing while redirecting)
  if (!isEnabled) {
    return null;
  }

  const SheetComponent = sheetComponents[tab];
  if (!SheetComponent) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Coming soon</p>
      </div>
    );
  }

  return <SheetComponent />;
}
