"use client";

import dynamic from "next/dynamic";

/**
 * Every checklist tab, loaded on demand. A visitor opening one tab downloads that tab's code, not all of them
 * (a client never opens the Talkpush-filled tabs, and the integrations sheets alone are over 2,000 lines).
 * Used by the client, editor and admin tab pages. Each import() is written out in full so the bundler can split it.
 */
function SheetLoading() {
  return (
    <div className="flex items-center justify-center py-20" role="status">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

export const LazyWelcomeSheet = dynamic(() => import("@/components/sheets/WelcomeSheet").then((m) => m.WelcomeSheet), { loading: SheetLoading });
export const LazyCompanyInfoSheet = dynamic(() => import("@/components/sheets/CompanyInfoSheet").then((m) => m.CompanyInfoSheet), { loading: SheetLoading });
export const LazyUserListSheet = dynamic(() => import("@/components/sheets/UserListSheet").then((m) => m.UserListSheet), { loading: SheetLoading });
export const LazyCampaignsSheet = dynamic(() => import("@/components/sheets/CampaignsSheet").then((m) => m.CampaignsSheet), { loading: SheetLoading });
export const LazySitesSheet = dynamic(() => import("@/components/sheets/SitesSheet").then((m) => m.SitesSheet), { loading: SheetLoading });
export const LazyPrescreeningSheet = dynamic(() => import("@/components/sheets/PrescreeningSheet").then((m) => m.PrescreeningSheet), { loading: SheetLoading });
export const LazyMessagingSheet = dynamic(() => import("@/components/sheets/MessagingSheet").then((m) => m.MessagingSheet), { loading: SheetLoading });
export const LazySourcesSheet = dynamic(() => import("@/components/sheets/SourcesSheet").then((m) => m.SourcesSheet), { loading: SheetLoading });
export const LazyFoldersSheet = dynamic(() => import("@/components/sheets/FoldersSheet").then((m) => m.FoldersSheet), { loading: SheetLoading });
export const LazyDocumentsSheet = dynamic(() => import("@/components/sheets/DocumentsSheet").then((m) => m.DocumentsSheet), { loading: SheetLoading });
export const LazyAttributesSheet = dynamic(() => import("@/components/sheets/AttributesSheet").then((m) => m.AttributesSheet), { loading: SheetLoading });
export const LazyFacebookWhatsAppSheet = dynamic(() => import("@/components/sheets/FacebookWhatsAppSheet").then((m) => m.FacebookWhatsAppSheet), { loading: SheetLoading });
export const LazyInstagramSheet = dynamic(() => import("@/components/sheets/InstagramSheet").then((m) => m.InstagramSheet), { loading: SheetLoading });
export const LazyAICallFAQsSheet = dynamic(() => import("@/components/sheets/AICallFAQsSheet").then((m) => m.AICallFAQsSheet), { loading: SheetLoading });
export const LazyRejectionReasonsSheet = dynamic(() => import("@/components/sheets/RejectionReasonsSheet").then((m) => m.RejectionReasonsSheet), { loading: SheetLoading });
export const LazyLabelsSheet = dynamic(() => import("@/components/sheets/LabelsSheet").then((m) => m.LabelsSheet), { loading: SheetLoading });
export const LazyAgencyPortalSheet = dynamic(() => import("@/components/sheets/AgencyPortalSheet").then((m) => m.AgencyPortalSheet), { loading: SheetLoading });
export const LazyAdminSettingsSheet = dynamic(() => import("@/components/sheets/AdminSettingsSheet").then((m) => m.AdminSettingsSheet), { loading: SheetLoading });
export const LazyAtsIntegrationsSheet = dynamic(() => import("@/components/sheets/AtsIntegrationsSheet").then((m) => m.AtsIntegrationsSheet), { loading: SheetLoading });
export const LazyIntegrationsSheet = dynamic(() => import("@/components/sheets/IntegrationsSheet").then((m) => m.IntegrationsSheet), { loading: SheetLoading });
export const LazyAutoflowsSheet = dynamic(() => import("@/components/sheets/AutoflowsSheet").then((m) => m.AutoflowsSheet), { loading: SheetLoading });
export const LazyCustomChecklistForm = dynamic(() => import("@/components/sheets/CustomChecklistForm").then((m) => m.CustomChecklistForm), { loading: SheetLoading });
export const LazyCustomTabSheet = dynamic(() => import("@/components/sheets/CustomTabSheet").then((m) => m.CustomTabSheet), { loading: SheetLoading });

export const sheetComponents: Record<string, React.ComponentType> = {
  welcome: LazyWelcomeSheet,
  "company-info": LazyCompanyInfoSheet,
  users: LazyUserListSheet,
  campaigns: LazyCampaignsSheet,
  sites: LazySitesSheet,
  prescreening: LazyPrescreeningSheet,
  messaging: LazyMessagingSheet,
  sources: LazySourcesSheet,
  folders: LazyFoldersSheet,
  documents: LazyDocumentsSheet,
  attributes: LazyAttributesSheet,
  "facebook-whatsapp": LazyFacebookWhatsAppSheet,
  instagram: LazyInstagramSheet,
  "ai-call-faqs": LazyAICallFAQsSheet,
  "rejection-reasons": LazyRejectionReasonsSheet,
  labels: LazyLabelsSheet,
  "agency-portal": LazyAgencyPortalSheet,
  "admin-settings": LazyAdminSettingsSheet,
  "ats-integrations": LazyAtsIntegrationsSheet,
  integrations: LazyIntegrationsSheet,
};
