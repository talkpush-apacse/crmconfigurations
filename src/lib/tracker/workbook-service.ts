import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Actor } from "./actor";
import { logActivity } from "./activity";
import { getClientViewForProject } from "./client-view-service";
import { listMetrics } from "./metric-service";
import { getProjectDetail } from "./project-service";
import { exportName } from "./print-layout";
import { buildSnapshot } from "./snapshot";
import { buildWorkbook, clientWorkbookData, staffWorkbookData, WORKBOOK_SHEETS, type WorkbookData } from "./workbook-export";

/**
 * Loads the data for the Excel workbook, builds it, and records the download.
 * The staff copy comes from the full project; the client copy ONLY from the client-safe view.
 */

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function loadStaffWorkbookData(projectId: string): Promise<WorkbookData> {
  const [detail, metrics] = await Promise.all([getProjectDetail(projectId), listMetrics(projectId)]);
  const snapshot = buildSnapshot({
    project: detail.project,
    health: detail.summary.health,
    items: detail.items,
    phases: detail.phases,
    metrics,
    checklist: detail.checklist,
    today: detail.today,
  });
  return staffWorkbookData({ today: detail.today, project: detail.project, phases: detail.phases, items: detail.items, snapshot });
}

export async function loadClientWorkbookData(projectId: string): Promise<WorkbookData> {
  return clientWorkbookData(await getClientViewForProject(projectId));
}

export function workbookFileName(data: WorkbookData): string {
  return `${exportName({ account: data.account, project: data.project, view: "Tracker", date: data.today })}.xlsx`;
}

/** Builds the file for a project. `audience` decides which data it is made from. */
export async function makeWorkbook(projectId: string, audience: "staff" | "client"): Promise<{ file: Buffer; name: string }> {
  const data = audience === "staff" ? await loadStaffWorkbookData(projectId) : await loadClientWorkbookData(projectId);
  return { file: await buildWorkbook(data), name: workbookFileName(data) };
}

/**
 * Records "who downloaded the workbook" in the project's activity. Staff see it; the client trail leaves it out.
 * A failure to write the record is logged but never blocks the download.
 */
export async function recordWorkbookDownload(projectId: string, actor: Actor, audience: "staff" | "client"): Promise<void> {
  try {
    await prisma.$transaction((tx) =>
      logActivity(tx, {
        projectId,
        entityType: "project",
        entityId: projectId,
        action: "export.downloaded",
        after: { format: "xlsx", views: [...WORKBOOK_SHEETS], audience },
        actor,
      })
    );
  } catch (err) {
    console.error("[export] could not record a workbook download:", err instanceof Error ? err.message : err);
  }
}

const FILE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

export function workbookResponse(file: Buffer, name: string): NextResponse {
  return new NextResponse(new Uint8Array(file), {
    headers: { ...FILE_HEADERS, "Content-Type": XLSX_TYPE, "Content-Disposition": `attachment; filename="${name}"` },
  });
}
