"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { formatDate } from "@/lib/tracker/format";

export type Orientation = "portrait" | "landscape";

interface Props {
  account: string;
  project: string;
  /** For example "List" or "Timeline". */
  viewName: string;
  /** The suggested PDF file name (browsers use the page title). */
  fileTitle: string;
  today: string;
  orientation: Orientation;
  /** Plain-language filters, shown under the title. */
  filterNote?: string;
  /** Hold the print dialog back until the content has its data. */
  ready: boolean;
  /** Fires when the print dialog closes, whether the PDF was saved or cancelled. */
  onDone: () => void;
  children: React.ReactNode;
}

/**
 * Only ever rendered after a click (never on the server). Renders a report into its own container at the end of <body> and opens the print dialog (where "Save as PDF" is
 * offered). While it is mounted, body.exporting hides the rest of the app for printing only (see globals.css), so
 * nothing changes on screen. The report is real text and vector graphics, so it stays sharp at any zoom.
 */
/** Text for a CSS string: no quotes, backslashes or line breaks to break out of it. */
const cssText = (text: string) => text.replace(/["\\\n\r]/g, " ");

export function PrintFrame({ account, project, viewName, fileTitle, today, orientation, filterNote, ready, onDone, children }: Props) {
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const previousTitle = document.title;
    document.title = fileTitle;
    document.body.classList.add("exporting");

    const finish = () => {
      if (!cancelled) onDone();
    };
    window.addEventListener("afterprint", finish, { once: true });

    // Let the report lay out (and fonts load) before the dialog takes a snapshot of the page.
    const start = async () => {
      try {
        await document.fonts?.ready;
      } catch {
        // fonts API unavailable: print anyway
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      if (!cancelled) window.print();
    };
    void start();

    return () => {
      cancelled = true;
      window.removeEventListener("afterprint", finish);
      document.body.classList.remove("exporting");
      document.title = previousTitle;
    };
  }, [ready, fileTitle, onDone]);

  return createPortal(
    <div id="print-root" className="print-root" data-orientation={orientation}>
      {/* Page size and the running footer cannot be set from a class, so they are written here. Browsers without
          page-margin support (Safari, Firefox) simply leave the footer out; the label in the header still prints. */}
      <style>{`@page {
        size: A4 ${orientation};
        margin: 12mm 10mm 14mm;
        @bottom-left { content: "Internal, not for clients. ${cssText(project)}"; font: 8px system-ui, sans-serif; color: #6b6b6b; }
        @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8px system-ui, sans-serif; color: #6b6b6b; }
      }`}</style>
      <header className="print-header">
        <p className="print-eyebrow">Talkpush, {account}</p>
        <h1 className="print-title">{project}</h1>
        <p className="print-meta">
          <strong>{viewName}</strong>
          <span aria-hidden="true"> · </span>
          Exported {formatDate(today)}
          <span className="print-internal">Internal, not for clients</span>
        </p>
        {filterNote && <p className="print-filter">{filterNote}</p>}
      </header>
      {children}
    </div>,
    document.body
  );
}
