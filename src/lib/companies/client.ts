import { api } from "@/lib/tracker/client-api";

export type LinkKind = "checklist" | "workflow";

const noun = (kind: LinkKind) => (kind === "checklist" ? "checklists" : "workflows");

/** File a checklist or workflow under a company, or take it out (accountId null). */
export function linkItem(kind: LinkKind, id: string, accountId: string | null) {
  return api<{ id: string; accountId: string | null }>(`/api/${noun(kind)}/${id}/account`, { method: "PUT", body: { accountId } });
}

export const openItemHref = (kind: LinkKind, id: string) => (kind === "checklist" ? `/admin/checklists/${id}/welcome` : `/admin/workflows/${id}`);
