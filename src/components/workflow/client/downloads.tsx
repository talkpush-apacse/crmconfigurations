"use client";

import DownloadMenu from "@/components/workflow/process-map/DownloadMenu";
import type { ViewerExportContext } from "./ClientWorkflowViewer";

/** The Download button on the client page. Only Process Map diagrams have downloads; what is exported is what this person may see. */
export function clientDownloadMenu(ctx: ViewerExportContext) {
  if (ctx.workflow.diagramStyle !== "process_map") return null;
  const when = ctx.view.publishedAt ?? ctx.workflow.updatedAt;
  return (
    <DownloadMenu
      pages={ctx.pages}
      activePageId={ctx.activePageId}
      meta={{
        clientName: ctx.workflow.clientName,
        workflowName: ctx.workflow.workflowName,
        versionLabel: ctx.view.versionNumber ? `v${ctx.view.versionNumber}` : "Draft",
        fileVersion: ctx.view.versionNumber ? `v${ctx.view.versionNumber}` : "draft",
        date: new Date(when).toISOString().slice(0, 10),
        author: ctx.view.publishedBy ?? "Talkpush",
      }}
    />
  );
}
