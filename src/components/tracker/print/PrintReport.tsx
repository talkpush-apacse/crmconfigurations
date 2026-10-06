"use client";

import { useEffect, useRef } from "react";
import type { ItemDTO, ProjectDetailDTO } from "@/lib/tracker/client-types";
import type { ProjectSnapshot } from "@/lib/tracker/snapshot";
import { exportName } from "@/lib/tracker/print-layout";
import { useApiResource } from "@/lib/tracker/use-api-resource";
import { ExecSummary } from "../ExecSummary";
import { BoardPrint } from "./BoardPrint";
import { ListPrint } from "./ListPrint";
import { PrintFrame } from "./PrintFrame";
import { TimelinePrint } from "./TimelinePrint";

export type PrintView = "summary" | "list" | "board" | "timeline";

export const PRINT_VIEW_LABEL: Record<PrintView, string> = { summary: "Summary", list: "List", board: "Board", timeline: "Timeline" };

/** What the List and Board tabs are showing right now, so the file matches the screen. */
export interface VisibleItems {
  items: ItemDTO[];
  filterLabel: string;
}

interface Props {
  view: PrintView;
  detail: ProjectDetailDTO;
  /** Items on screen for the List or Board tab. Summary and Timeline always use everything. */
  visible: VisibleItems | null;
  onDone: () => void;
  onError: (message: string) => void;
}

type Readings = Record<string, { asOf: string; value: number }[]>;

export function PrintReport({ view, detail, visible, onDone, onError }: Props) {
  const { project, phases, items, today } = detail;
  const fileTitle = exportName({ account: project.accountName, project: project.title, view: PRINT_VIEW_LABEL[view], date: today });
  const shown = visible?.items ?? items;
  const filterNote = view === "list" || view === "board" ? (visible?.filterLabel ? `Showing ${shown.length} of ${items.length} items. ${visible.filterLabel}` : `Showing all ${items.length} items.`) : undefined;

  // The summary reads its own, fresh data; the other views already have everything they need.
  const snapshot = useApiResource<ProjectSnapshot>(view === "summary" ? `/api/tracker/projects/${project.id}/snapshot` : null);
  const metrics = useApiResource<{ readings: Readings }>(view === "summary" ? `/api/tracker/projects/${project.id}/metrics` : null);

  const failed = view === "summary" && snapshot.error && !snapshot.data ? snapshot.error : "";
  const reported = useRef(false);
  useEffect(() => {
    if (failed && !reported.current) {
      reported.current = true;
      onError(failed);
    }
  }, [failed, onError]);

  const ready = view === "summary" ? Boolean(snapshot.data) && (Boolean(metrics.data) || Boolean(metrics.error)) : true;
  if (failed) return null;

  return (
    <PrintFrame
      account={project.accountName}
      project={project.title}
      viewName={PRINT_VIEW_LABEL[view]}
      fileTitle={fileTitle}
      today={today}
      orientation={view === "board" || view === "timeline" ? "landscape" : "portrait"}
      filterNote={filterNote}
      ready={ready}
      onDone={onDone}
    >
      {view === "summary" && snapshot.data && <ExecSummary data={snapshot.data} context="staff" embedded readings={metrics.data?.readings} />}
      {view === "list" && <ListPrint items={shown} allItems={items} today={today} />}
      {view === "board" && <BoardPrint items={shown} allItems={items} today={today} />}
      {view === "timeline" && <TimelinePrint items={items} phases={phases} project={{ startDate: project.startDate, targetDate: project.targetDate, goLiveDate: project.goLiveDate }} today={today} />}
    </PrintFrame>
  );
}
