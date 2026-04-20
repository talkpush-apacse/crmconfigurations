"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { getTabBySlug, getEnabledTabs, getCustomTabBySlug } from "@/lib/tab-config";
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
import { AttributesSheet } from "@/components/sheets/AttributesSheet";
import { FacebookWhatsAppSheet } from "@/components/sheets/FacebookWhatsAppSheet";
import { InstagramSheet } from "@/components/sheets/InstagramSheet";
import { AICallFAQsSheet } from "@/components/sheets/AICallFAQsSheet";
import { RejectionReasonsSheet } from "@/components/sheets/RejectionReasonsSheet";
import { AgencyPortalSheet } from "@/components/sheets/AgencyPortalSheet";
import { AdminSettingsSheet } from "@/components/sheets/AdminSettingsSheet";
import { AtsIntegrationsSheet } from "@/components/sheets/AtsIntegrationsSheet";
import { IntegrationsSheet } from "@/components/sheets/IntegrationsSheet";
import { CustomChecklistForm } from "@/components/sheets/CustomChecklistForm";
import { CustomTabSheet } from "@/components/sheets/CustomTabSheet";

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
  attributes: AttributesSheet,
  "facebook-whatsapp": FacebookWhatsAppSheet,
  instagram: InstagramSheet,
  "ai-call-faqs": AICallFAQsSheet,
  "rejection-reasons": RejectionReasonsSheet,
  "agency-portal": AgencyPortalSheet,
  "admin-settings": AdminSettingsSheet,
  "ats-integrations": AtsIntegrationsSheet,
  integrations: IntegrationsSheet,
};

export default function AdminChecklistTabPage() {
  const params = useParams();
  const router = useRouter();
  const tab = params.tab as string;
  const id = params.id as string;
  const { data } = useChecklistContext();

  const isCustom = !!data?.isCustom;
  const tabConfig = isCustom ? null : getTabBySlug(tab);
  const customTab = isCustom ? null : getCustomTabBySlug(tab, data?.customTabs);
  const enabledTabs = useMemo(
    () =>
      isCustom
        ? []
        : getEnabledTabs(data?.enabledTabs ?? null, true, data?.tabOrder ?? null, data?.customTabs),
    [isCustom, data?.enabledTabs, data?.tabOrder, data?.customTabs]
  );
  const isEnabled = isCustom || enabledTabs.some((t) => t.slug === tab);

  useEffect(() => {
    if (!isCustom && !customTab && tabConfig && !isEnabled && enabledTabs.length > 0) {
      router.replace(`/admin/checklists/${id}/${enabledTabs[0].slug}`);
    }
  }, [isCustom, customTab, tabConfig, isEnabled, enabledTabs, id, router]);

  useEffect(() => {
    if (isCustom && data?.clientName) {
      document.title = `Custom Checklist - ${data.clientName} | Talkpush CRM`;
    } else if (customTab && data?.clientName) {
      document.title = `${customTab.label} - ${data.clientName} | Talkpush CRM`;
    } else if (tabConfig && data?.clientName) {
      document.title = `${tabConfig.label} - ${data.clientName} | Talkpush CRM`;
    }
  }, [isCustom, tab, tabConfig, customTab, data?.clientName]);

  if (isCustom) {
    return <CustomChecklistForm />;
  }

  if (customTab) {
    if (customTab.columns !== undefined) {
      return <CustomTabSheet customTab={customTab} />;
    }
    return <CustomChecklistForm customTabId={customTab.id} />;
  }

  if (!tabConfig) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Tab not found</p>
      </div>
    );
  }

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
