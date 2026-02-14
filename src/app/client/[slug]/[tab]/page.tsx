"use client";

import { useParams } from "next/navigation";
import { getTabBySlug, getEnabledTabs } from "@/lib/tab-config";
import { useChecklistContext } from "@/lib/checklist-context";
import { WelcomeSheet } from "@/components/sheets/WelcomeSheet";
import { ReadMeSheet } from "@/components/sheets/ReadMeSheet";
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
  "read-me": ReadMeSheet,
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
  const tab = params.tab as string;
  const { data } = useChecklistContext();
  const tabConfig = getTabBySlug(tab);

  if (!tabConfig) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Tab not found</p>
      </div>
    );
  }

  // Guard against disabled tabs
  const enabledTabs = getEnabledTabs(data?.enabledTabs ?? null);
  if (!enabledTabs.find((t) => t.slug === tab)) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">This section is not enabled for this client.</p>
      </div>
    );
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
